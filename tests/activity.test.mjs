import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';

const workspaceId='company';
const appId='orders-app';
const releaseId='orders-release';
const actionName='orders.view';
const appUrl='https://orders.atrax.test';
const asset=new TextEncoder().encode('<h1>Orders</h1>');
const assetHash=createHash('sha256').update(asset).digest('hex');
const people={
  admin:{token:'a'.repeat(64),role:'admin'},
  member:{token:'b'.repeat(64),role:'member'},
};
const action={
  name:actionName,
  description:'View an order',
  effect:'read',
  inputSchema:{type:'object',properties:{orderId:{type:'string'}},required:['orderId'],additionalProperties:false},
  outputSchema:{type:'object',properties:{orderId:{type:'string'},personId:{type:'string'}},required:['orderId','personId'],additionalProperties:false},
};
const configuration={
  manifest:{version:2,name:'orders',web:{assets:'dist',fallback:'index.html'},actions:{entry:'actions.js'}},
  actions:[action],
  assets:{'/index.html':{hash:assetHash,size:asset.byteLength,contentType:'text/html; charset=utf-8'}},
  assetPrefix:`assets/${releaseId}/`,
};
const service=(worker,exportName)=>({type:'worker',worker,...(exportName?{exportName}:{})});
const json=value=>({type:'json',value});
const hash=value=>createHash('sha256').update(value).digest('hex');
const runtimeSource=`import {WorkerEntrypoint} from 'cloudflare:workers';export default class Runtime extends WorkerEntrypoint {invoke(_name,input,_context,caller){return {ok:true,result:{orderId:input.orderId,personId:caller.person.id}}}}`;

async function platform(t) {
  let mf;
  const control=localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),{
    CP_DB:{type:'d1',id:`activity-${crypto.randomUUID()}`},
    CONSOLE_ORIGIN:json('https://console.atrax.test'),
  });
  control.dev={outboundService:{type:'fetcher',handler:async request=>{
    if(new URL(request.url).hostname!==new URL(appUrl).hostname) return new Response('Unknown test host',{status:502});
    return mf.dispatchFetch(request);
  }}};
  const gateway=localWorker('orders-gateway',await bundlePlatform('gateway/src/index.js'),{
    APP_ID:json(appId),
    RELEASE_ID:json(releaseId),
    WORKSPACE_ID:json(workspaceId),
    CONFIG_KEY:json(`configs/${releaseId}.json`),
    ARTIFACTS:{type:'r2',name:'activity-artifacts'},
    DOOR:service('control-plane','Door'),
    RUNTIME:service('runtime'),
  });
  gateway.config.triggers=[{type:'fetch',pattern:`${appUrl}/*`}];
  mf=new Miniflare({workers:[control,gateway,localWorker('runtime',runtimeSource)]});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control-plane');
  await migrateControlPlane(db);
  const bucket=await mf.getR2Bucket('ARTIFACTS','orders-gateway');
  await bucket.put(`configs/${releaseId}.json`,JSON.stringify(configuration));
  await bucket.put(`assets/${releaseId}/${assetHash}`,asset);
  const now=Date.now();
  await db.batch([
    ...Object.entries(people).flatMap(([person,{token}])=>[
      db.prepare('INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)').bind(person,`${person}@example.com`,now,now),
      db.prepare("INSERT INTO sessions(session_id,person_id,secret_hash,kind,created_at,expires_at) VALUES(?,?,?,'cli',?,?)").bind(`${person}-session`,person,hash(token),now,now+3_600_000),
    ]),
    db.prepare('INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)').bind(workspaceId,'Company','company','admin',now),
    ...Object.entries(people).map(([person,{role}])=>db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES(?,?,?,'active',?)").bind(workspaceId,person,role,now)),
    db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,active_release_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,'ready','workspace',?,?,?,?)").bind(appId,workspaceId,'Orders','orders','orders-gateway',appUrl,null,'admin',now,now),
    db.prepare('INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(releaseId,appId,'artifact',`configs/${releaseId}.json`,JSON.stringify(configuration.manifest),JSON.stringify(configuration.actions),'[]','admin',now),
    db.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES(?,?,?,'live')").bind(new URL(appUrl).hostname,appId,releaseId),
    db.prepare('UPDATE apps SET active_release_id=? WHERE app_id=?').bind(releaseId,appId),
    db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(appId,actionName),
  ]);
  async function operation(name,input,person='admin',key=crypto.randomUUID()) {
    const response=await mf.dispatchFetch(`https://api.atrax.test/v1/operations/${name}`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${people[person].token}`,'Idempotency-Key':key},
      body:JSON.stringify(input),
    });
    return {status:response.status,body:await response.json()};
  }
  return {db,operation};
}

test('activity visibility follows the viewer’s current workspace, app, and action access', {timeout:45_000}, async t=>{
  const api=await platform(t);
  const memberCall=await api.operation('actions.call',{appId,actionName,input:{orderId:'member-order'}},'member','member-action');
  const adminCall=await api.operation('actions.call',{appId,actionName,input:{orderId:'admin-order'}},'admin','admin-action');
  assert.equal(memberCall.status,200,JSON.stringify(memberCall.body));
  assert.equal(adminCall.status,200,JSON.stringify(adminCall.body));

  const now=Date.now();
  await api.db.batch([
    api.db.prepare("INSERT INTO activity(activity_id,workspace_id,person_id,session_id,operation,target_id,outcome,created_at) VALUES('member-event',?,?,?,?,?,'succeeded',?)").bind(workspaceId,'member','member-session','library.entry.create','member-entry',now),
    api.db.prepare("INSERT INTO activity(activity_id,workspace_id,person_id,session_id,operation,target_id,outcome,created_at) VALUES('admin-event',?,?,?,?,?,'succeeded',?)").bind(workspaceId,'admin','admin-session','apps.create',appId,now+1),
  ]);

  const adminActivity=await api.operation('activity.list',{workspaceId},'admin');
  assert.equal(adminActivity.status,200,JSON.stringify(adminActivity.body));
  assert.deepEqual(new Set(adminActivity.body.result.events.map(event=>event.id)),new Set(['member-event','admin-event']));
  assert.deepEqual(new Set(adminActivity.body.result.invocations.map(invocation=>invocation.appId)),new Set([appId]));
  assert.equal(adminActivity.body.result.invocations.length,2,'a workspace admin can audit both people’s action history');

  const memberActivity=await api.operation('activity.list',{workspaceId},'member');
  assert.equal(memberActivity.status,200,JSON.stringify(memberActivity.body));
  assert.deepEqual(memberActivity.body.result.events.map(event=>event.id),['member-event'],'a member sees only their attributed platform activity');
  assert.deepEqual(memberActivity.body.result.invocations.map(invocation=>invocation.id),[memberCall.body.result.invocationId],'a member sees only their own currently permitted action');

  await api.db.prepare("UPDATE apps SET audience='selected' WHERE app_id=?").bind(appId).run();
  const appRestricted=await api.operation('activity.list',{workspaceId},'member');
  assert.equal(appRestricted.status,200,JSON.stringify(appRestricted.body));
  assert.deepEqual(appRestricted.body.result.invocations,[],'history disappears when the member loses the app audience');

  await api.db.prepare('INSERT INTO app_people(app_id,person_id) VALUES(?,?)').bind(appId,'member').run();
  const appRestored=await api.operation('activity.list',{workspaceId},'member');
  assert.deepEqual(appRestored.body.result.invocations.map(invocation=>invocation.id),[memberCall.body.result.invocationId]);
  await api.db.prepare("UPDATE action_policies SET audience='selected' WHERE app_id=? AND action_name=?").bind(appId,actionName).run();
  const actionRestricted=await api.operation('activity.list',{workspaceId},'member');
  assert.deepEqual(actionRestricted.body.result.invocations,[],'history disappears when the member loses the action audience');
  await api.db.prepare('INSERT INTO action_people(app_id,action_name,person_id) VALUES(?,?,?)').bind(appId,actionName,'member').run();
  const actionRestored=await api.operation('activity.list',{workspaceId},'member');
  assert.deepEqual(actionRestored.body.result.invocations.map(invocation=>invocation.id),[memberCall.body.result.invocationId]);
  await api.db.prepare('INSERT INTO action_denials(app_id,action_name,person_id) VALUES(?,?,?)').bind(appId,actionName,'member').run();
  const actionDenied=await api.operation('activity.list',{workspaceId},'member');
  assert.equal(actionDenied.status,200,JSON.stringify(actionDenied.body));
  assert.deepEqual(actionDenied.body.result.invocations,[],'history disappears when the member loses the action grant');

  await api.db.prepare("UPDATE workspace_members SET status='removed' WHERE workspace_id=? AND person_id='member'").bind(workspaceId).run();
  const revoked=await api.operation('activity.list',{workspaceId},'member');
  assert.equal(revoked.status,403,JSON.stringify(revoked.body));
  assert.equal(revoked.body.error.code,'forbidden');
});
