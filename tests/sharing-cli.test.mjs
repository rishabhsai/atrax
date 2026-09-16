import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {buildApp} from '../cli/build.mjs';
import {bundlePlatform,localMailboxSource,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';

const cli=resolve(import.meta.dirname,'../bin/atrax.mjs');
const appId='orders-app',releaseId='orders-release',appOrigin='https://orders.atrax.test';
const consoleOrigin='https://console.atrax.test';
const service=(worker,exportName)=>({type:'worker',worker,...(exportName?{exportName}:{})});
const json=value=>({type:'json',value});
const okay=outcome=>{assert.equal(outcome.status,200,JSON.stringify(outcome.body));return outcome.body.result;};
const succeeded=outcome=>{assert.equal(outcome.code,0,outcome.stdout+outcome.stderr);return outcome.envelope.result;};

async function platform(t) {
  const directory=await mkdtemp(join(tmpdir(),'atrax-sharing-cli-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'public'));
  await writeFile(join(directory,'public/index.html'),'<h1>Private orders</h1>');
  await writeFile(join(directory,'atrax.json'),JSON.stringify({version:2,name:'orders',web:{assets:'public'},actions:{entry:'actions.js'}}));
  await writeFile(join(directory,'actions.js'),`const descriptor={description:'Inspect orders',effect:'read',inputSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:{type:'object',properties:{personId:{type:'string'}},required:['personId'],additionalProperties:false},handler:(_input,context)=>({personId:context.actor.person.id})};export const actions={'orders.inspect':descriptor,'orders.export':descriptor};`);
  const artifact=await buildApp(directory);
  const [control,gateway]=await Promise.all([bundlePlatform('control-plane/src/index.js'),bundlePlatform('gateway/src/index.js')]);
  // Inject a state change immediately before the real D1 commit to exercise admission races.
  const wrapped=await build({stdin:{contents:`import worker from 'control-under-test';export {Door} from 'control-under-test';export default {async fetch(request,env){
    const race=request.headers.get('x-test-race');if(!race)return worker.fetch(request,env);
    const db=env.CP_DB;const wrappedDb={prepare:db.prepare.bind(db),async batch(statements){
      if(race==='membership')await db.prepare(\"UPDATE workspace_members SET role='member' WHERE role='admin'\").run();
      if(race==='session')await db.prepare(\"UPDATE sessions SET revoked_at=1 WHERE person_id IN (SELECT person_id FROM people WHERE email='admin@example.com')\").run();
      if(race==='action')await db.prepare(\"UPDATE releases SET actions_json='[]' WHERE release_id='orders-release'\").run();
      return db.batch(statements);
    }};return worker.fetch(request,{...env,CP_DB:wrappedDb});
  }};`},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:*','node:*'],plugins:[{name:'control-under-test',setup(plugin){plugin.onResolve({filter:/^control-under-test$/},()=>({path:'control',namespace:'test'}));plugin.onLoad({filter:/.*/,namespace:'test'},()=>({contents:control,loader:'js'}));}}]});
  const gatewayWorker=localWorker('gateway',gateway,{APP_ID:json(appId),RELEASE_ID:json(releaseId),WORKSPACE_ID:json('company'),CONFIG_KEY:json('config.json'),CONSOLE_ORIGIN:json(consoleOrigin),ARTIFACTS:{type:'r2',name:'sharing-assets'},DOOR:service('control-plane','Door'),RUNTIME:service('runtime','AppRuntime')});
  gatewayWorker.config.triggers=[{type:'fetch',pattern:`${appOrigin}/*`}];
  const mf=new Miniflare({host:'127.0.0.1',port:0,workers:[
    localWorker('control-plane',wrapped.outputFiles[0].text,{CP_DB:{type:'d1',id:'sharing-cli'},CONSOLE_ORIGIN:json(consoleOrigin),EMAIL_FROM:json('test@atrax.test'),EMAIL:service('mailbox','Mail')}),
    gatewayWorker,
    localWorker('runtime',artifact.runtime),localWorker('mailbox',localMailboxSource),
  ]});
  t.after(()=>mf.dispose());
  const origin=(await mf.ready).origin;
  const db=await mf.getD1Database('CP_DB','control-plane');await migrateControlPlane(db);
  const bucket=await mf.getR2Bucket('ARTIFACTS','gateway');
  const assets=Object.fromEntries(Object.entries(artifact.assets).map(([path,{hash,size,contentType}])=>[path,{hash,size,contentType}]));
  await bucket.put('config.json',JSON.stringify({manifest:artifact.manifest,actions:artifact.actions,assets,assetPrefix:'assets/'}));
  for(const asset of Object.values(artifact.assets)) await bucket.put(`assets/${asset.hash}`,Buffer.from(asset.content,'base64'));
  const mailbox=async()=>await (await (await mf.getWorker('mailbox')).fetch('https://mailbox.test')).json();
  async function call(name,input={},person,headers={}) {
    const response=await fetch(`${origin}/v1/operations/${name}`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':crypto.randomUUID(),Origin:consoleOrigin,...(person?{Cookie:person.cookie}:{}),...headers},body:JSON.stringify(input)});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  async function signIn(email,returnTo='/home') {
    okay(await call('auth.email.start',{email,returnTo,purpose:'sign_in'}));
    const link=new URL((await mailbox()).at(-1).text.match(/https:\/\/\S+/)[0]);
    const proof=new URLSearchParams(link.hash.slice(1));
    const verified=await call('auth.email.verify',{challengeId:proof.get('challengeId'),secret:proof.get('secret')});
    const result=okay(verified);
    return {...result,cookie:verified.headers.get('set-cookie').split(';')[0]};
  }
  const people={};
  for(const name of ['owner','admin','maintainer','guest','outsider']) people[name]=await signIn(`${name}@example.com`);
  const now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company',?,?)").bind(people.owner.person.id,now),
    ...['owner','admin','maintainer'].map(name=>db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company',?,?,'active',?)").bind(people[name].person.id,name==='maintainer'?'member':name,now)),
    db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,active_release_id,created_by,created_at,updated_at) VALUES(?,'company','Orders','orders','orders-gateway',?,'ready','workspace',?,?,?,?)").bind(appId,appOrigin,releaseId,people.owner.person.id,now,now),
    db.prepare('INSERT INTO app_maintainers(app_id,person_id) VALUES(?,?)').bind(appId,people.maintainer.person.id),
    db.prepare('INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(releaseId,appId,artifact.hash,'config.json',JSON.stringify(artifact.manifest),JSON.stringify(artifact.actions),'[]',people.owner.person.id,now),
    db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,?,'live')").bind(new URL(appOrigin).hostname,appId,releaseId),
    ...artifact.actions.map(action=>db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(appId,action.name)),
  ]);
  await writeFile(join(directory,'atrax.lock.json'),JSON.stringify({version:2,apiOrigin:origin,workspaceId:'company',appId,url:appOrigin,activeReleaseId:releaseId}));
  async function run(person,args,{cwd=directory,human=false,approve=false}={}) {
    const config=join(directory,`config-${person}`);
    const child=spawn(process.execPath,[cli,...args,...(human?[]:['--json'])],{cwd,env:{...process.env,ATRAX_API_ORIGIN:origin,ATRAX_CONFIG_DIR:config},stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',pending='';const approvals=[];
    child.stdout.on('data',chunk=>{
      stdout+=chunk;pending+=chunk;
      while(pending.includes('\n')) {
        const i=pending.indexOf('\n'),line=pending.slice(0,i);pending=pending.slice(i+1);
        if(approve) {const result=JSON.parse(line).result;if(result.status==='authorization_required') approvals.push(call('auth.device.approve',{userCode:result.userCode,decision:'approve'},people[person]).then(okay));}
      }
    });
    child.stderr.on('data',chunk=>stderr+=chunk);
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    await Promise.all(approvals);
    const envelope=human?null:JSON.parse(stdout.trim().split('\n').at(-1));
    return {code,stdout,stderr,envelope};
  }
  for(const name of ['owner','admin','maintainer']) succeeded(await run(name,['login'],{approve:true}));
  const app=async(path='/',init={})=>mf.dispatchFetch(`${appOrigin}${path}`,{redirect:'manual',...init});
  async function open(person) {
    const navigation=await app('/',{headers:{accept:'text/html'}});
    const login=new URL(navigation.headers.get('location'));
    const loginCookie=navigation.headers.get('set-cookie').split(';')[0];
    const authorized=await call('apps.login',{appId,hostname:new URL(appOrigin).host,state:login.searchParams.get('state')},person);
    if(authorized.status!==200) return authorized;
    const callback=await app(new URL(authorized.body.result.redirectUrl).pathname+new URL(authorized.body.result.redirectUrl).search,{headers:{cookie:loginCookie}});
    assert.equal(callback.status,302,await callback.clone().text());
    const cookie=callback.headers.get('set-cookie').split(';')[0];
    const response=await app('/',{headers:{cookie,accept:'application/octet-stream'}});
    return {status:response.status,cookie,text:await response.text()};
  }
  const action=async(name,cookie)=>app(`/__atrax/actions/${name}`,{method:'POST',headers:{cookie,origin:appOrigin,'content-type':'application/json'},body:'{}'});
  return {directory,origin,db,people,run,call,signIn,mailbox,app,open,action};
}

test('linked and explicit sharing use verified device sessions, exact-email acceptance, and real app action access',{timeout:60000},async t=>{
  const api=await platform(t);
  const first=succeeded(await api.run('owner',['share','guest@example.com','--key','share-guest']));
  const repeated=succeeded(await api.run('owner',['share','guest@example.com','--key','share-guest']));
  assert.equal(repeated.invitation.id,first.invitation.id);
  assert.equal(first.appId,appId);assert.equal(first.url,appOrigin);assert.equal(first.invitation.status,'pending');
  assert.deepEqual(first.actionNames,[]);assert.equal(first.audience.publicWeb,false);
  assert.equal(first.audience.workspace.policy,'workspace');assert.equal(first.workspaceAccessRemainsInEffect,true);
  assert.deepEqual(first.audience.workspace.people.map(p=>p.email),['admin@example.com','maintainer@example.com','owner@example.com']);
  assert.equal(first.invitations.find(i=>i.id===first.invitation.id).status,'pending');
  assert.ok(first.observedAt>Date.now()-10000);
  assert.equal((await api.open(api.people.guest)).status,403);
  assert.equal((await api.open(api.people.outsider)).status,403);
  assert.equal((await api.call('apps.guests.accept',{invitationId:first.invitation.id},api.people.outsider)).body.error.code,'invitation_email_mismatch');
  okay(await api.call('apps.guests.accept',{invitationId:first.invitation.id},api.people.guest));
  const opened=await api.open(api.people.guest);assert.equal(opened.status,200);assert.match(opened.text,/Private orders/);
  assert.equal((await api.action('orders.inspect',opened.cookie)).status,403);
  assert.equal((await api.action('orders.export',opened.cookie)).status,403);
  assert.equal((await api.db.prepare("SELECT COUNT(*) count FROM workspace_members WHERE person_id=?").bind(api.people.guest.person.id).first()).count,0);
  const second=succeeded(await api.run('admin',['share','Guest@Example.com','--app',appId,'--actions','orders.inspect'],{cwd:tmpdir()}));
  assert.deepEqual(second.actionNames,['orders.inspect']);assert.equal(second.invitation.email,'guest@example.com');
  assert.deepEqual(second.guests.map(g=>g.email),['guest@example.com']);
  okay(await api.call('apps.guests.accept',{invitationId:second.invitation.id},api.people.guest));
  const allowed=await api.action('orders.inspect',opened.cookie);assert.equal(allowed.status,200,await allowed.clone().text());assert.equal((await allowed.json()).result.personId,api.people.guest.person.id);
  assert.equal((await api.action('orders.export',opened.cookie)).status,403);
  const human=await api.run('admin',['share','human-guest@example.com'],{human:true});
  assert.equal(human.code,0,human.stderr);assert.match(human.stdout,/workspace-wide/);assert.match(human.stdout,/Accepted guests: guest@example.com/);assert.match(human.stdout,/owner@example.com \(owner\)/);
  const newcomer=succeeded(await api.run('owner',['share','new-guest@example.com','--app',appId]));
  const returnTo=`/auth/guest-invite/?id=${newcomer.invitation.id}`;
  const signedIn=await api.signIn('new-guest@example.com',returnTo);assert.equal(signedIn.returnTo,returnTo);assert.deepEqual(signedIn.workspaces,[]);
  okay(await api.call('apps.guests.accept',{invitationId:newcomer.invitation.id},signedIn));
  assert.equal((await api.open(signedIn)).status,200);
  assert.ok((await api.mailbox()).every(message=>message.to.endsWith('@example.com')));
});

test('selected and public audience output preserves internal access and distinguishes expired invitations',{timeout:60000},async t=>{
  const api=await platform(t);
  const original=succeeded(await api.run('owner',['share','guest@example.com']));
  await api.db.batch([
    api.db.prepare("UPDATE apps SET audience='selected' WHERE app_id=?").bind(appId),
    api.db.prepare('INSERT INTO app_people(app_id,person_id) VALUES(?,?)').bind(appId,api.people.maintainer.person.id),
    api.db.prepare('UPDATE app_guest_invitations SET expires_at=? WHERE invitation_id=?').bind(Date.now()-1,original.invitation.id),
    api.db.prepare('INSERT INTO app_guests(app_id,person_id,expires_at) VALUES(?,?,?)').bind(appId,api.people.guest.person.id,Date.now()-1),
  ]);
  const selected=succeeded(await api.run('admin',['share','outsider@example.com']));
  assert.deepEqual(selected.audience.workspace.people,[{personId:api.people.maintainer.person.id,email:'maintainer@example.com',role:'member'}]);
  assert.equal(selected.audience.workspace.policy,'selected');assert.deepEqual(selected.guests,[]);
  assert.equal(selected.invitations.find(i=>i.id===original.invitation.id).status,'expired');
  const human=await api.run('admin',['share','another@example.com'],{human:true});assert.equal(human.code,0,human.stderr);
  assert.match(human.stdout,/Workspace access remains in effect \(selected people\)/);assert.match(human.stdout,/maintainer@example.com \(member\)/);assert.doesNotMatch(human.stdout,/only person|guest@example.com/);
  okay(await api.call('apps.public.publish',{appId,releaseId,publicationRevision:0,confirmation:'publish'},api.people.owner));
  const publicResult=succeeded(await api.run('admin',['share','public-guest@example.com']));assert.equal(publicResult.audience.publicWeb,true);
  const publicHuman=await api.run('admin',['share','public-other@example.com'],{human:true});assert.equal(publicHuman.code,0,publicHuman.stderr);assert.match(publicHuman.stdout,/public, anyone can open the web pages/);
  assert.equal((await api.app('/',{headers:{accept:'application/octet-stream'}})).status,200);
  assert.equal((await api.db.prepare('SELECT public_web FROM apps WHERE app_id=?').bind(appId).first()).public_web,1);
});

test('sharing rejects unpublished actions, unauthorized and ended sessions, and mismatched checkout identity',{timeout:60000},async t=>{
  const api=await platform(t);
  await api.db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,'orders.retired','workspace')").bind(appId).run();
  for(const name of ['orders.unknown','orders.retired']) {
    const result=await api.run('owner',['share','guest@example.com','--actions',name]);assert.equal(result.code,1);assert.equal(result.envelope.error.code,'action_not_found');
  }
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM app_guest_invitations').first()).count,0);
  const denied=await api.run('maintainer',['share','guest@example.com']);assert.equal(denied.envelope.error.code,'forbidden');
  for(const [person,column] of [['admin','revoked_at'],['owner','expires_at']]) {
    const saved=JSON.parse(await readFile(join(api.directory,`config-${person}`,'credentials.json'),'utf8'));
    await api.db.prepare(`UPDATE sessions SET ${column}=? WHERE session_id=?`).bind(Date.now()-1,saved.session.id).run();
    const result=await api.run(person,['share','guest@example.com']);assert.equal(result.code,1);assert.equal(result.envelope.error.code,'unauthorized');
  }
  const lockPath=join(api.directory,'atrax.lock.json');const lock=JSON.parse(await readFile(lockPath,'utf8'));
  await writeFile(lockPath,JSON.stringify({...lock,apiOrigin:'https://other.atrax.test'}));
  assert.equal((await api.run('maintainer',['share','guest@example.com'])).envelope.error.code,'api_origin_conflict');
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM app_guest_invitations').first()).count,0);
});


test('invitation commit rechecks workspace authority, session, and the current published release',{timeout:60000},async t=>{
  const api=await platform(t);
  const release=await api.db.prepare('SELECT actions_json FROM releases WHERE release_id=?').bind(releaseId).first();
  for(const race of ['membership','session','action']) {
    const response=await api.call('apps.guests.invite',{appId,email:'race@example.com',actionNames:['orders.inspect']},api.people.admin,{'x-test-race':race});
    assert.equal(response.status,409,JSON.stringify(response.body));assert.equal(response.body.error.code,'external_sharing_changed');
    assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM app_guest_invitations').first()).count,0);
    assert.equal((await api.db.prepare("SELECT COUNT(*) count FROM operation_receipts WHERE operation='apps.guests.invite'").first()).count,0);
    await api.db.batch([
      api.db.prepare("UPDATE workspace_members SET role='admin' WHERE person_id=?").bind(api.people.admin.person.id),
      api.db.prepare('UPDATE sessions SET revoked_at=NULL WHERE person_id=?').bind(api.people.admin.person.id),
      api.db.prepare('UPDATE releases SET actions_json=? WHERE release_id=?').bind(release.actions_json,releaseId),
    ]);
  }
});
