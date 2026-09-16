import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {transform} from 'esbuild';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localMailboxSource,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';

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

const config={manifest:{version:2,name:'orders',web:{assets:'dist',fallback:'index.html'},actions:{entry:'actions.js'}},actions:[{
  name:actionName,description:'Inspect orders',effect:'read',
  inputSchema:{type:'object',properties:{orderId:{type:'string'}},required:['orderId'],additionalProperties:false},
  outputSchema:{type:'object',properties:{orderId:{type:'string'},personId:{type:'string'}},required:['orderId','personId'],additionalProperties:false},
},{
  name:hiddenActionName,description:'Export all orders',effect:'read',
  inputSchema:{type:'object',properties:{},additionalProperties:false},
  outputSchema:{type:'object',properties:{},additionalProperties:false},
}],assets:{'/index.html':{hash:assetHash,size:asset.byteLength,contentType:'text/html; charset=utf-8'}},assetPrefix:`assets/${releaseId}/`};

const frontSource=`export default {fetch(request,env) {const host=new URL(request.url).hostname;if(host==='api.atrax.test') return env.CONTROL.fetch(request);if(host==='orders.atrax.test') return env.GATEWAY.fetch(request);return new Response('Unknown host',{status:404});}};`;
const runtimeSource=`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Runtime extends WorkerEntrypoint {describe(){return this.env.DESCRIPTORS} invoke(_name,input,_context,caller){return {ok:true,result:{orderId:input.orderId,personId:caller.person.id}}}}`;
const service=(worker,exportName)=>({type:'worker',worker,...(exportName?{exportName}:{})});
const json=(value)=>({type:'json',value});
const hash=(value)=>createHash('sha256').update(value).digest('hex');

let consoleApi;
async function frontendSafeReturnTo(value) {
  consoleApi ??= (async()=>{
    const source=await readFile(new URL('../components/console/api.ts',import.meta.url),'utf8');
    const compiled=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
    return import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
  })();
  return (await consoleApi).safeReturnTo(value);
}

async function platform(t) {
  const [control,gateway]=await Promise.all([bundlePlatform('control-plane/src/index.js'),bundlePlatform('gateway/src/index.js')]);
  const mf=new Miniflare({workers:[
    localWorker('front',frontSource,{CONTROL:service('control-plane'),GATEWAY:service('gateway')}),
    localWorker('control-plane',control,{CP_DB:{type:'d1',id:`external-${crypto.randomUUID()}`},AUTH_ORIGIN:json(apiOrigin),CONSOLE_ORIGIN:json('https://console.atrax.test'),EMAIL_FROM:json('mail@atrax.test'),EMAIL:service('mailbox','Mail')}),
    localWorker('gateway',gateway,{APP_ID:json(appId),RELEASE_ID:json(releaseId),WORKSPACE_ID:json(workspaceId),CONFIG_KEY:json(`configs/${releaseId}.json`),ARTIFACTS:{type:'r2',name:'external-artifacts'},DOOR:service('control-plane','Door'),RUNTIME:service('runtime')}),
    localWorker('runtime',runtimeSource,{DESCRIPTORS:json(config.actions)}),
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
  async function call(name,input,person=people.admin,key=crypto.randomUUID()) {
    const response=await mf.dispatchFetch(`${apiOrigin}/v1/operations/${name}`,{method:'POST',headers:{authorization:`Bearer ${person.token}`,'content-type':'application/json','idempotency-key':key},body:JSON.stringify(input)});
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
  return {db,call,browserCall,app,mailbox};
}

function failure(outcome,status,code) {
  assert.equal(outcome.response.status,status,JSON.stringify(outcome.body));
  assert.equal(outcome.body.error.code,code);
}

test('admins invite verified-email guests to one app with action grants, and revocation is immediate', {timeout:45_000}, async (t) => {
  const api=await platform(t);
  failure(await api.call('apps.guests.invite',{appId,email:people.guest.email,actionNames:[actionName]},people.maintainer),403,'forbidden');
  const invited=await api.call('apps.guests.invite',{appId,email:people.guest.email,actionNames:[actionName]},people.admin,'invite-guest');
  assert.equal(invited.response.status,200,JSON.stringify(invited.body));
  const message=(await api.mailbox()).at(-1);
  const link=new URL(message.text.match(/https:\/\/\S+/)[0]);
  assert.equal(link.pathname,'/auth/guest-invite');
  assert.equal(link.searchParams.get('id'),invited.body.result.invitation.id);
  const accepted=await api.call('apps.guests.accept',{invitationId:invited.body.result.invitation.id},people.guest,'accept-guest');
  assert.equal(accepted.response.status,200,JSON.stringify(accepted.body));
  assert.deepEqual(accepted.body.result.guest.actionNames,[actionName]);
  const acceptedReplay=await api.call('apps.guests.accept',{invitationId:invited.body.result.invitation.id},people.guest,'accept-guest');
  assert.equal(acceptedReplay.response.status,200,JSON.stringify(acceptedReplay.body));
  assert.deepEqual(acceptedReplay.body.result,accepted.body.result,'a lost successful response can be retried with the same key');
  const listed=await api.call('apps.guests.list',{appId},people.admin);
  assert.equal(listed.response.status,200,JSON.stringify(listed.body));
  assert.deepEqual(listed.body.result.guests,[{personId:people.guest.id,email:people.guest.email,actionNames:[actionName]}]);
  const guestApp=await api.call('apps.get',{appId},people.guest);
  assert.equal(guestApp.response.status,200,'guest can open only the granted app');
  assert.deepEqual(guestApp.body.result.release.actions.map((action)=>action.name),[actionName],'guest descriptors include only actions granted to that guest');
  assert.equal((await api.call('apps.get',{appId},guestAgent)).response.status,200,'the guest’s agent has the same exact app grant');
  const appSession=await api.app('/',{headers:{cookie:`__Host-atrax_app=${guestAppToken}`,accept:'text/html'}});
  assert.equal(appSession.status,200,'the existing app session honors the new exact guest grant');
  failure(await api.call('library.list',{workspaceId},people.guest),403,'forbidden');
  await api.db.prepare('INSERT INTO action_denials(app_id,action_name,person_id) VALUES(?,?,?)').bind(appId,actionName,people.guest.id).run();
  const explicitlyDenied=await api.app(`/__atrax/actions/${actionName}`,{method:'POST',headers:{authorization:`Bearer ${people.guest.token}`,'content-type':'application/json'},body:JSON.stringify({orderId:'42'})});
  assert.equal(explicitlyDenied.status,403);
  await api.db.prepare('DELETE FROM action_denials WHERE app_id=? AND action_name=? AND person_id=?').bind(appId,actionName,people.guest.id).run();
  const action=await api.app(`/__atrax/actions/${actionName}`,{method:'POST',headers:{authorization:`Bearer ${guestAgent.token}`,'content-type':'application/json'},body:JSON.stringify({orderId:'42'})});
  assert.equal(action.status,200,await action.clone().text());
  assert.deepEqual((await action.json()).result,{orderId:'42',personId:people.guest.id});
  const revoked=await api.call('apps.guests.revoke',{appId,personId:people.guest.id},people.owner,'revoke-guest');
  assert.equal(revoked.response.status,200,JSON.stringify(revoked.body));
  failure(await api.call('apps.guests.accept',{invitationId:invited.body.result.invitation.id},people.guest,'accept-guest'),410,'invitation_revoked');
  failure(await api.call('apps.get',{appId},people.guest),403,'forbidden');
  failure(await api.call('apps.get',{appId},guestAgent),403,'forbidden');
  const deniedSession=await api.app('/',{headers:{cookie:`__Host-atrax_app=${guestAppToken}`,accept:'application/octet-stream'}});
  assert.equal(deniedSession.status,403);
  const denied=await api.app(`/__atrax/actions/${actionName}`,{method:'POST',headers:{authorization:`Bearer ${people.guest.token}`,'content-type':'application/json'},body:JSON.stringify({orderId:'42'})});
  assert.equal(denied.status,403);
  assert.equal((await denied.json()).error.code,'forbidden');
});

test('a signed-out guest returns through email sign-in and accepts the original invitation', {timeout:45_000}, async (t) => {
  const api=await platform(t);
  const email='new-guest@example.com';
  const invited=await api.call('apps.guests.invite',{appId,email,actionNames:[actionName]},people.admin,'invite-new-guest');
  assert.equal(invited.response.status,200,JSON.stringify(invited.body));
  const invitationId=invited.body.result.invitation.id;
  const returnTo=`/auth/guest-invite/?id=${encodeURIComponent(invitationId)}`;
  assert.equal(await frontendSafeReturnTo(returnTo),returnTo,'the console keeps the guest invitation across sign-in');

  const started=await api.browserCall('auth.email.start',{email,returnTo,purpose:'sign_in'});
  assert.equal(started.response.status,200,JSON.stringify(started.body));
  const signInMessage=(await api.mailbox()).at(-1);
  const signInLink=new URL(signInMessage.text.match(/https:\/\/\S+/)[0]);
  const proof=new URLSearchParams(signInLink.hash.slice(1));
  const verified=await api.browserCall('auth.email.verify',{
    challengeId:proof.get('challengeId'),
    secret:proof.get('secret'),
  });
  assert.equal(verified.response.status,200,JSON.stringify(verified.body));
  assert.equal(verified.body.result.returnTo,returnTo);
  assert.equal(verified.body.result.person.email,email);
  assert.deepEqual(verified.body.result.workspaces,[],'guest sign-in does not add workspace membership');
  assert.match(verified.cookie,/^__Host-atrax_session=/);
  const cookie=verified.cookie.split(';')[0];

  const accepted=await api.browserCall('apps.guests.accept',{invitationId},cookie,'accept-new-guest');
  assert.equal(accepted.response.status,200,JSON.stringify(accepted.body));
  assert.deepEqual(accepted.body.result.guest.actionNames,[actionName]);
  const details=await api.browserCall('apps.get',{appId},cookie);
  assert.equal(details.response.status,200,JSON.stringify(details.body));
  assert.deepEqual(details.body.result.release.actions.map((action)=>action.name),[actionName]);
});

test('public web leaves selected app and action access unchanged', {timeout:45_000}, async (t) => {
  const api=await platform(t);
  await api.db.batch([
    api.db.prepare("UPDATE apps SET audience='selected' WHERE app_id=?").bind(appId),
    api.db.prepare('INSERT INTO app_people(app_id,person_id) VALUES(?,?)').bind(appId,people.owner.id),
    api.db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(appId,retiredActionName),
  ]);
  const adminApp=await api.call('apps.get',{appId},people.admin);
  assert.equal(adminApp.response.status,200,JSON.stringify(adminApp.body));
  assert.equal(adminApp.body.result.release,undefined,'an external-sharing administrator outside the app does not receive release data');
  const management=await api.call('apps.guests.list',{appId},people.admin);
  assert.equal(management.response.status,200,JSON.stringify(management.body));
  assert.deepEqual(management.body.result,{appId,guests:[],invitations:[],grantableActionNames:[hiddenActionName,actionName]},'external sharing receives only current grant names');
  assert.doesNotMatch(JSON.stringify(management.body.result),/Inspect orders|Export all orders|inputSchema|outputSchema|artifact/i);
  failure(await api.call('apps.guests.invite',{appId,email:'retired-action@example.com',actionNames:[retiredActionName]},people.admin,'retired-action-grant'),404,'action_not_found');
  const managedInvite=await api.call('apps.guests.invite',{appId,email:'guest-through-admin@example.com',actionNames:[hiddenActionName]},people.admin,'selected-admin-guest-grant');
  assert.equal(managedInvite.response.status,200,JSON.stringify(managedInvite.body));
  assert.deepEqual(managedInvite.body.result.invitation.actionNames,[hiddenActionName]);
  const memberAction=()=>api.app(`/__atrax/actions/${actionName}`,{method:'POST',headers:{authorization:`Bearer ${people.former.token}`,'content-type':'application/json'},body:JSON.stringify({orderId:'42'})});
  const privateBefore=await api.app('/',{headers:{accept:'application/octet-stream'}});
  assert.equal(privateBefore.status,401);
  assert.equal((await memberAction()).status,403,'a member outside the selected app cannot call its action');
  failure(await api.call('apps.public.publish',{appId,releaseId,publicationRevision:0,confirmation:'publish'},people.maintainer),403,'forbidden');
  failure(await api.call('apps.public.publish',{appId,releaseId:'different-release',publicationRevision:0,confirmation:'publish'},people.admin),409,'release_changed');
  const published=await api.call('apps.public.publish',{appId,releaseId,publicationRevision:0,confirmation:'publish'},people.admin,'publish-prototype');
  assert.equal(published.response.status,200,JSON.stringify(published.body));
  assert.deepEqual(published.body.result.publication,{appId,public:true,publicationRevision:1,activeReleaseId:releaseId});
  const assetResponse=await api.app('/',{headers:{accept:'text/html'}});
  assert.equal(assetResponse.status,200,await assetResponse.clone().text());
  assert.equal(await assetResponse.text(),new TextDecoder().decode(asset));
  assert.equal((await memberAction()).status,403,'publishing web pages does not widen selected action access');
  const anonymousAction=await api.app(`/__atrax/actions/${actionName}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:'42'})});
  assert.equal(anonymousAction.status,401);
  assert.equal((await anonymousAction.json()).error.code,'unauthorized');
  const unpublished=await api.call('apps.public.unpublish',{appId,publicationRevision:1,confirmation:'unpublish'},people.owner,'unpublish-prototype');
  assert.equal(unpublished.response.status,200,JSON.stringify(unpublished.body));
  assert.deepEqual(unpublished.body.result.publication,{appId,public:false,publicationRevision:2,activeReleaseId:releaseId});
  const access=await api.db.prepare('SELECT audience,access_revision,public_web,public_revision FROM apps WHERE app_id=?').bind(appId).first();
  assert.deepEqual(access,{audience:'selected',access_revision:1,public_web:0,public_revision:2});
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM app_people WHERE app_id=? AND person_id=?').bind(appId,people.owner.id).first()).count,1,'unpublishing preserves selected app access');
  const privateAgain=await api.app('/',{headers:{accept:'application/octet-stream'}});
  assert.equal(privateAgain.status,401);
  assert.equal((await privateAgain.json()).error.code,'unauthorized');
  assert.equal((await memberAction()).status,403,'unpublishing keeps the app’s selected action boundary');
});

test('removing a member clears any earlier guest grant, requiring a fresh admin invitation', {timeout:45_000}, async (t) => {
  const api=await platform(t);
  await api.db.batch([
    api.db.prepare('INSERT INTO app_guests(app_id,person_id) VALUES(?,?)').bind(appId,people.former.id),
    api.db.prepare('INSERT INTO app_guest_actions(app_id,person_id,action_name) VALUES(?,?,?)').bind(appId,people.former.id,actionName),
  ]);
  assert.equal((await api.call('apps.get',{appId},people.former)).response.status,200);
  const removed=await api.call('members.remove',{workspaceId,personId:people.former.id},people.owner,'remove-former');
  assert.equal(removed.response.status,200,JSON.stringify(removed.body));
  failure(await api.call('apps.get',{appId},people.former),403,'forbidden');
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM app_guests WHERE app_id=? AND person_id=?').bind(appId,people.former.id).first()).count,0);
});
