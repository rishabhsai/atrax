import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localMailboxSource,localWorker,migrateControlPlane} from '../../cli/local-platform.mjs';

const apiOrigin='https://api.atrax.test';
const appOrigin='https://orders.atrax.test';
const workspaceId='paper-company';
const appId='orders-app';
const releaseId='orders-release';
const actionName='orders.inspect';
const hiddenActionName='orders.export';
const retiredActionName='orders.retired';
const asset=new TextEncoder().encode('<h1>Orders prototype</h1>');
const assetHash=createHash('sha256').update(asset).digest('hex');
const people={
  owner:{id:'owner',email:'owner@example.com',token:'1'.repeat(64),role:'owner'},
  admin:{id:'admin',email:'admin@example.com',token:'2'.repeat(64),role:'admin'},
  maintainer:{id:'maintainer',email:'maintainer@example.com',token:'3'.repeat(64),role:'member'},
  guest:{id:'guest',email:'guest@example.com',token:'4'.repeat(64)},
  former:{id:'former',email:'former@example.com',token:'5'.repeat(64),role:'member'},
};
const guestAgent={...people.guest,token:'6'.repeat(64)};
const guestAppToken='7'.repeat(64);
const guestCli={...people.guest,token:'8'.repeat(64)};
const secondAppId='other-app',secondOrigin='https://other.atrax.test';
const cli=resolve(import.meta.dirname,'../../bin/atrax.mjs');

const config={manifest:{version:2,name:'orders',web:{assets:'dist',fallback:'index.html'},actions:{entry:'actions.js'}},actions:[{
  name:actionName,description:'Inspect orders',effect:'read',
  inputSchema:{type:'object',properties:{orderId:{type:'string'}},required:['orderId'],additionalProperties:false},
  outputSchema:{type:'object',properties:{orderId:{type:'string'},personId:{type:'string'}},required:['orderId','personId'],additionalProperties:false},
},{
  name:hiddenActionName,description:'Export all orders',effect:'read',
  inputSchema:{type:'object',properties:{},additionalProperties:false},
  outputSchema:{type:'object',properties:{},additionalProperties:false},
}],assets:{'/index.html':{hash:assetHash,size:asset.byteLength,contentType:'text/html; charset=utf-8'}},assetPrefix:`assets/${releaseId}/`};

const frontSource=`export default {fetch(request,env) {const host=new URL(request.url).hostname;if(host==='api.atrax.test'||host==='127.0.0.1') return env.CONTROL.fetch(request);if(host==='orders.atrax.test') return env.GATEWAY.fetch(request);if(host==='other.atrax.test') return env.SECOND.fetch(request);return new Response('Unknown host',{status:404});}};`;

const service=(worker,exportName)=>({type:'worker',worker,...(exportName?{exportName}:{})});
const json=(value)=>({type:'json',value});
const hash=(value)=>createHash('sha256').update(value).digest('hex');

export async function platform(t) {
  const [control,gateway]=await Promise.all([bundlePlatform('control-plane/src/index.js'),bundlePlatform('gateway/src/index.js')]);
  const directory=await mkdtemp(join(tmpdir(),'atrax-guest-lifecycle-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const runtime=await build({entryPoints:[resolve(import.meta.dirname,'../../runtime/entry.js')],bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:*'],plugins:[{name:'actions',setup(plugin){
    plugin.onResolve({filter:/^atrax:actions$/},()=>({path:'actions',namespace:'fixture'}));
    plugin.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const actions={${config.actions.map(action=>`${JSON.stringify(action.name)}:{...${JSON.stringify(action)},handler:(input,context)=>${action.name===actionName?'({orderId:input.orderId,personId:context.actor.person.id})':'({})'}}`).join(',')}};`,loader:'js'}));
  }}]});
  const wrapped=await build({stdin:{contents:`import worker from 'control-under-test';export {Door} from 'control-under-test';export default {async fetch(request,env){
    const race=request.headers.get('x-test-race');if(!race)return worker.fetch(request,env);
    const input=await request.clone().json();const db=env.CP_DB;const wrappedDb={prepare:db.prepare.bind(db),async batch(statements){
      if(race==='membership')await db.prepare("UPDATE workspace_members SET role='member' WHERE person_id='admin'").run();
      if(race==='session')await db.prepare("UPDATE sessions SET revoked_at=1 WHERE person_id='admin'").run();
      if(race==='action')await db.prepare("UPDATE releases SET actions_json='[]' WHERE release_id='orders-release'").run();
      if(race==='revision')await db.prepare("UPDATE app_guests SET revision='concurrent-revision' WHERE app_id=? AND person_id=?").bind(input.appId,input.personId).run();
      if(race==='cancel')await db.prepare("UPDATE app_guest_invitations SET status='cancelled' WHERE invitation_id=?").bind(input.invitationId).run();
      if(race==='target')await db.prepare("DELETE FROM app_guests WHERE app_id=? AND person_id=?").bind(input.appId,input.personId).run();
      return db.batch(statements);
    }};return worker.fetch(request,{...env,CP_DB:wrappedDb});
  }};`},bundle:true,write:false,format:'esm',platform:'neutral',external:['cloudflare:*','node:*'],plugins:[{name:'control-under-test',setup(plugin){plugin.onResolve({filter:/^control-under-test$/},()=>({path:'control',namespace:'test'}));plugin.onLoad({filter:/.*/,namespace:'test'},()=>({contents:control,loader:'js'}));}}]});
  const mf=new Miniflare({host:'127.0.0.1',port:0,workers:[
    localWorker('front',frontSource,{CONTROL:service('control-plane'),GATEWAY:service('gateway'),SECOND:service('second-gateway')}),
    localWorker('control-plane',wrapped.outputFiles[0].text,{CP_DB:{type:'d1',id:`external-${crypto.randomUUID()}`},AUTH_ORIGIN:json(apiOrigin),CONSOLE_ORIGIN:json('https://console.atrax.test'),EMAIL_FROM:json('mail@atrax.test'),EMAIL:service('mailbox','Mail')}),
    localWorker('gateway',gateway,{APP_ID:json(appId),RELEASE_ID:json(releaseId),WORKSPACE_ID:json(workspaceId),CONFIG_KEY:json(`configs/${releaseId}.json`),ARTIFACTS:{type:'r2',name:'external-artifacts'},DOOR:service('control-plane','Door'),RUNTIME:service('runtime','AppRuntime')}),
    localWorker('second-gateway',gateway,{APP_ID:json(secondAppId),RELEASE_ID:json('other-release'),WORKSPACE_ID:json(workspaceId),CONFIG_KEY:json(`configs/${releaseId}.json`),ARTIFACTS:{type:'r2',name:'external-artifacts'},DOOR:service('control-plane','Door'),RUNTIME:service('runtime','AppRuntime')}),
    localWorker('runtime',runtime.outputFiles[0].text),
    localWorker('mailbox',localMailboxSource),
  ]});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control-plane');
  await migrateControlPlane(db);
  const bucket=await mf.getR2Bucket('ARTIFACTS','gateway');
  await bucket.put(`configs/${releaseId}.json`,JSON.stringify(config));
  await bucket.put(`assets/${releaseId}/${assetHash}`,asset);
  const now=Date.now();
  await db.batch([
    ...Object.values(people).flatMap((person)=>[
      db.prepare('INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)').bind(person.id,person.email,now,now),
      db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,expires_at,created_at) VALUES(?,?,?,'browser',?,?)").bind(`browser-${person.id}`,hash(person.token),person.id,now+3_600_000,now),
    ]),
    db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,expires_at,created_at) VALUES('cli-guest',?,?,'cli',?,?)").bind(hash(guestCli.token),people.guest.id,now+3_600_000,now),
    db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,agent_label,expires_at,created_at) VALUES(?,?,?,'agent','Guest assistant',?,?)").bind(`agent-${people.guest.id}`,hash(guestAgent.token),people.guest.id,now+3_600_000,now),
    db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,parent_session_id,app_id,expires_at,created_at) VALUES(?,?,?,'app',?,?,?,?)").bind(`app-${people.guest.id}`,hash(guestAppToken),people.guest.id,`browser-${people.guest.id}`,appId,now+3_600_000,now),
    db.prepare('INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)').bind(workspaceId,'Paper Company','paper-company',people.owner.id,now),
    ...Object.values(people).filter((person)=>person.role).map((person)=>db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES(?,?,?,'active',?)").bind(workspaceId,person.id,person.role,now)),
    db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,active_release_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,'ready','workspace',?,?,?,?)").bind(appId,workspaceId,'Orders','orders','orders-gateway',appOrigin,releaseId,people.owner.id,now,now),
    db.prepare('INSERT INTO app_maintainers(app_id,person_id) VALUES(?,?)').bind(appId,people.maintainer.id),
    db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(releaseId,appId,'artifact',`configs/${releaseId}.json`,JSON.stringify(config.manifest),JSON.stringify(config.actions),'[]',people.owner.id,now),
    db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,?,'live')").bind(new URL(appOrigin).host,appId,releaseId),
    ...[actionName,hiddenActionName].map((name)=>db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(appId,name)),
  ]);
  await db.batch([
    db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at,active_release_id,access_revision,public_web,public_revision) SELECT ?,workspace_id,'Other','other','other-gateway',?,status,audience,created_by,created_at,updated_at,'other-release',access_revision,public_web,public_revision FROM apps WHERE app_id=?").bind(secondAppId,secondOrigin,appId),
    db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) SELECT 'other-release',?,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at FROM releases WHERE release_id=?").bind(secondAppId,releaseId),
    db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,'other-release','live')").bind(new URL(secondOrigin).host,secondAppId),
    ...config.actions.map(action=>db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(secondAppId,action.name)),
  ]);
  async function call(name,input,person=people.admin,key=crypto.randomUUID(),extraHeaders={}) {
    const response=await mf.dispatchFetch(`${apiOrigin}/v1/operations/${name}`,{method:'POST',headers:{authorization:`Bearer ${person.token}`,'content-type':'application/json','idempotency-key':key,...extraHeaders},body:JSON.stringify(input)});
    return {response,body:await response.json()};
  }
  async function browserCall(name,input,cookie,key=crypto.randomUUID()) {
    const headers={'content-type':'application/json','idempotency-key':key,origin:'https://console.atrax.test'};
    if(cookie) headers.cookie=cookie;
    const response=await mf.dispatchFetch(`${apiOrigin}/v1/operations/${name}`,{
      method:'POST',headers,body:JSON.stringify(input),
    });
    return {response,body:await response.json(),cookie:response.headers.get('set-cookie')};
  }
  async function app(path='/',init={}) {return mf.dispatchFetch(`${appOrigin}${path}`,{redirect:'manual',...init});}
  async function mailbox() {return (await (await mf.getWorker('mailbox')).fetch('https://mailbox.test')).json();}
  const origin=(await mf.ready).origin;
  async function configuration(person) {
    const config=join(directory,person.token.slice(0,4));await mkdir(config,{recursive:true});
    await writeFile(join(config,'credentials.json'),JSON.stringify({origin,accessToken:person.token,person:{id:person.id},session:{id:person.id}}));
    return {...process.env,ATRAX_API_ORIGIN:origin,ATRAX_CONFIG_DIR:config};
  }
  async function command(name,input,person=people.admin,key=crypto.randomUUID()) {
    const child=spawn(process.execPath,[cli,'call',name,'--input',JSON.stringify(input),'--key',key,'--json'],{env:await configuration(person),stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    const code=await new Promise((resolve,reject)=>{child.once('close',resolve);child.once('error',reject);});
    return {code,stdout,stderr,envelope:JSON.parse(stdout.trim())};
  }
  async function mcp(person=people.admin) {
    const transport=new StdioClientTransport({command:process.execPath,args:[cli,'mcp','--workspace',workspaceId],env:await configuration(person),stderr:'pipe'});
    const client=new Client({name:'guest-lifecycle-tests',version:'1.0.0'});await client.connect(transport);t.after(()=>client.close());return client;
  }
  return {db,mf,origin,call,browserCall,app,mailbox,command,mcp,secondApp:(path='/',init={})=>mf.dispatchFetch(`${secondOrigin}${path}`,{redirect:'manual',...init})};
}

export {asset,apiOrigin,appOrigin,workspaceId,appId,releaseId,actionName,hiddenActionName,retiredActionName,people,guestAgent,guestAppToken,guestCli,secondAppId,secondOrigin};
