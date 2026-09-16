import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {localWorker} from '../cli/local-platform.mjs';
import {applyMigrations} from '../runtime/migrations.js';
import {splitSqlQuery} from '../cli/vendor/splitter.mjs';
import {platform,appOrigin,appId,actionName,hiddenActionName,retiredActionName,people,guestAgent,guestAppToken,guestCli,secondAppId} from './helpers/guest-lifecycle-platform.mjs';

const okay=value=>{assert.equal(value.response.status,200,JSON.stringify(value.body));return value.body.result;};
const failed=(value,status,code)=>{assert.equal(value.response.status,status,JSON.stringify(value.body));assert.equal(value.body.error.code,code);return value.body.error;};
const list=async(api)=>okay(await api.call('apps.guests.list',{appId}));
const invite=async(api,email=people.guest.email,actionNames=[actionName],target=appId)=>okay(await api.call('apps.guests.invite',{appId:target,email,actionNames})).invitation;
const accept=async(api,invitation)=>okay(await api.call('apps.guests.accept',{invitationId:invitation.id},people.guest));
const guest=async(api)=>(await list(api)).guests.find(person=>person.personId===people.guest.id);
const activity=async(api,name)=>(await api.db.prepare("SELECT COUNT(*) count FROM activity WHERE operation=? AND outcome='succeeded'").bind(name).first()).count;
const action=(api,name,person=people.guest)=>api.app(`/__atrax/actions/${name}`,{method:'POST',headers:{'content-type':'application/json',...(person==='app'?{cookie:`__Host-atrax_app=${guestAppToken}`,origin:appOrigin}:{authorization:`Bearer ${person.token}`})},body:JSON.stringify(name===actionName?{orderId:'42'}:{})});

async function assertAction(api,name,person,status) {
  const response=await action(api,name,person);assert.equal(response.status,status,await response.clone().text());
}

test('cancellation uses CLI and MCP contracts and has distinct terminal states with exact replay',{timeout:45000},async t=>{
  const api=await platform(t);
  const invitation=await invite(api);
  const input={appId,invitationId:invitation.id};
  const cancelled=await api.command('apps.guests.invitation.cancel',input,people.admin,'cancel-via-cli');
  assert.equal(cancelled.code,0,cancelled.stdout+cancelled.stderr);assert.equal(cancelled.envelope.result.invitation.status,'cancelled');
  failed(await api.call('apps.guests.accept',{invitationId:invitation.id},people.guest),410,'invitation_cancelled');
  assert.deepEqual(okay(await api.call('apps.guests.invitation.cancel',input,people.admin,'cancel-via-cli')),cancelled.envelope.result);
  assert.equal(await activity(api,'apps.guests.invitation.cancel'),1);
  assert.equal(failed(await api.call('apps.guests.invitation.cancel',input),409,'invitation_not_pending').details.status,'cancelled');
  failed(await api.call('apps.guests.invitation.cancel',{...input,appId:secondAppId},people.admin,'cancel-via-cli'),409,'idempotency_conflict');
  failed(await api.call('apps.guests.invitation.cancel',{appId,invitationId:'unknown'}),404,'not_found');
  const accepted=await invite(api);await accept(api,accepted);
  assert.equal(failed(await api.call('apps.guests.invitation.cancel',{appId,invitationId:accepted.id}),409,'invitation_not_pending').details.status,'accepted');
  const expired=await invite(api,'expired@example.com');
  await api.db.prepare('UPDATE app_guest_invitations SET expires_at=1 WHERE invitation_id=?').bind(expired.id).run();
  assert.equal(failed(await api.call('apps.guests.invitation.cancel',{appId,invitationId:expired.id}),409,'invitation_not_pending').details.status,'expired');
  const revoked=await invite(api,'replaced@example.com');await invite(api,'replaced@example.com');
  assert.equal(failed(await api.call('apps.guests.invitation.cancel',{appId,invitationId:revoked.id}),409,'invitation_not_pending').details.status,'revoked');
  const mcp=await api.mcp();const tools=await mcp.listTools();
  for(const name of ['atrax_apps_guests_invitation_cancel','atrax_apps_guests_actions_set','atrax_apps_guests_revoke']) assert.ok(tools.tools.some(tool=>tool.name===name));
  const second=await invite(api,'mcp@example.com');
  const result=await mcp.callTool({name:'atrax_apps_guests_invitation_cancel',arguments:{input:{appId,invitationId:second.id},key:'cancel-via-mcp'}});
  assert.equal(result.isError,undefined,JSON.stringify(result));assert.equal(result.structuredContent.invitation.status,'cancelled');
  const states=new Set((await list(api)).invitations.map(item=>item.status));
  assert.deepEqual(states,new Set(['pending','accepted','expired','cancelled','revoked']));
});

test('replacement grants and revocation affect every existing session but preserve a second app grant',{timeout:45000},async t=>{
  const api=await platform(t);
  const invitation=await invite(api,people.guest.email,[actionName,hiddenActionName]);await accept(api,invitation);
  await accept(api,await invite(api,people.guest.email,[actionName],secondAppId));
  const original=await guest(api);assert.equal(typeof original.revision,'string');
  for(const person of [people.guest,guestCli,guestAgent,'app']) await assertAction(api,actionName,person,200);
  const replacement={appId,personId:people.guest.id,revision:original.revision,actionNames:[hiddenActionName]};
  const mcp=await api.mcp();
  const changed=await mcp.callTool({name:'atrax_apps_guests_actions_set',arguments:{input:replacement,key:'replace-via-mcp'}});
  assert.equal(changed.isError,undefined,JSON.stringify(changed));assert.notEqual(changed.structuredContent.guest.revision,original.revision);
  assert.deepEqual(okay(await api.call('apps.guests.actions.set',replacement,people.admin,'replace-via-mcp')),changed.structuredContent);
  assert.equal(await activity(api,'apps.guests.actions.set'),1);
  failed(await api.call('apps.guests.actions.set',{...replacement,actionNames:[]},people.admin,'replace-via-mcp'),409,'idempotency_conflict');
  const conflict=failed(await api.call('apps.guests.actions.set',replacement),409,'guest_revision_conflict');
  assert.equal(conflict.details.currentRevision,changed.structuredContent.guest.revision);
  for(const person of [people.guest,guestCli,guestAgent,'app']) {await assertAction(api,actionName,person,403);await assertAction(api,hiddenActionName,person,200);}
  await api.db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(appId,retiredActionName).run();
  for(const name of ['orders.unknown',retiredActionName]) failed(await api.call('apps.guests.actions.set',{...replacement,revision:changed.structuredContent.guest.revision,actionNames:[name]}),404,'action_not_found');
  assert.deepEqual((await guest(api)).actionNames,[hiddenActionName]);
  const cleared=okay(await api.call('apps.guests.actions.set',{...replacement,revision:changed.structuredContent.guest.revision,actionNames:[]},people.owner));
  assert.deepEqual(cleared.guest.actionNames,[]);await assertAction(api,hiddenActionName,guestAgent,403);
  assert.equal((await api.app('/',{headers:{cookie:`__Host-atrax_app=${guestAppToken}`,accept:'application/octet-stream'}})).status,200);
  const revoked=await api.command('apps.guests.revoke',{appId,personId:people.guest.id},people.owner,'revoke-via-cli');
  assert.equal(revoked.code,0,revoked.stdout);assert.equal(revoked.envelope.result.revoked,true);
  assert.deepEqual(okay(await api.call('apps.guests.revoke',{appId,personId:people.guest.id},people.owner,'revoke-via-cli')),revoked.envelope.result);
  assert.equal(await activity(api,'apps.guests.revoke'),1);
  assert.deepEqual(okay(await api.call('apps.guests.actions.set',replacement,people.admin,'replace-via-mcp')),changed.structuredContent);
  assert.equal((await list(api)).guests.length,0,'replaying the previous edit cannot resurrect the grant');
  failed(await api.call('apps.guests.revoke',{appId,personId:people.former.id},people.owner,'revoke-via-cli'),409,'idempotency_conflict');
  for(const person of [people.guest,guestCli,guestAgent,'app']) {
    await assertAction(api,actionName,person,403);await assertAction(api,hiddenActionName,person,403);
    const headers=person==='app'?{cookie:`__Host-atrax_app=${guestAppToken}`}:{authorization:`Bearer ${person.token}`};
    const assets=await api.app('/',{headers:{...headers,accept:'application/octet-stream'}});assert.equal(assets.status,403,await assets.clone().text());
  }
  for(const person of [people.guest,guestCli,guestAgent]) {
    okay(await api.call('auth.session.get',{},person));
    okay(await api.call('apps.get',{appId:secondAppId},person));
    assert.equal((await api.secondApp('/',{headers:{authorization:`Bearer ${person.token}`,accept:'application/octet-stream'}})).status,200);
    const independentAction=await api.secondApp(`/__atrax/actions/${actionName}`,{method:'POST',headers:{authorization:`Bearer ${person.token}`,'content-type':'application/json'},body:JSON.stringify({orderId:'other-app-order'})});
    assert.equal(independentAction.status,200,await independentAction.clone().text());
  }
  assert.equal((await api.db.prepare('SELECT COUNT(*) count FROM workspace_members WHERE person_id=?').bind(people.guest.id).first()).count,0);
  assert.equal((await list(api)).invitations.find(item=>item.id===invitation.id).status,'revoked');
});

test('a stale editor cannot overwrite a fresh guest grant after revocation and reinvitation',{timeout:30000},async t=>{
  const api=await platform(t);await accept(api,await invite(api));const first=await guest(api);
  okay(await api.call('apps.guests.revoke',{appId,personId:people.guest.id}));
  await accept(api,await invite(api,people.guest.email,[hiddenActionName]));const next=await guest(api);
  assert.notEqual(next.revision,first.revision);
  failed(await api.call('apps.guests.actions.set',{appId,personId:people.guest.id,revision:first.revision,actionNames:[]}),409,'guest_revision_conflict');
  assert.deepEqual((await guest(api)).actionNames,[hiddenActionName]);
});

test('lifecycle authorization denies members, maintainers, guests, removed people, and ended sessions',{timeout:30000},async t=>{
  const api=await platform(t);await accept(api,await invite(api));const current=await guest(api);
  const pending=await invite(api,'pending@example.com');
  const operations=[['apps.guests.invitation.cancel',{appId,invitationId:pending.id}],['apps.guests.actions.set',{appId,personId:people.guest.id,revision:current.revision,actionNames:[]}],['apps.guests.revoke',{appId,personId:people.guest.id}]];
  for(const person of [people.maintainer,people.guest,people.former]) for(const [name,input] of operations) failed(await api.call(name,input,person),403,'forbidden');
  okay(await api.call('members.remove',{workspaceId:'paper-company',personId:people.former.id},people.owner));
  for(const [name,input] of operations) failed(await api.call(name,input,people.former),403,'forbidden');
  await api.db.prepare("UPDATE sessions SET revoked_at=1 WHERE session_id='browser-admin'").run();
  for(const [name,input] of operations) failed(await api.call(name,input,people.admin),401,'unauthorized');
  failed(await api.call('apps.guests.list',{appId}),401,'unauthorized');
  const observed=okay(await api.call('apps.guests.list',{appId},people.owner));
  assert.equal(observed.invitations.find(item=>item.id===pending.id).status,'pending');assert.deepEqual(observed.guests[0].actionNames,[actionName]);
});

test('lifecycle commits recheck caller authority and target state in the real D1 transaction',{timeout:45000},async t=>{
  const api=await platform(t);await accept(api,await invite(api));const current=await guest(api);
  const pending=await invite(api,'pending@example.com');
  const operations=[['apps.guests.invitation.cancel',{appId,invitationId:pending.id}],['apps.guests.actions.set',{appId,personId:people.guest.id,revision:current.revision,actionNames:[hiddenActionName]}],['apps.guests.revoke',{appId,personId:people.guest.id}]];
  for(const [name,input] of operations) for(const race of ['membership','session']) {
    const result=await api.call(name,input,people.admin,crypto.randomUUID(),{'x-test-race':race});
    assert.ok([403,409].includes(result.response.status),JSON.stringify(result.body));
    assert.equal(await activity(api,name),0);
    await api.db.batch([api.db.prepare("UPDATE workspace_members SET role='admin' WHERE person_id='admin'"),api.db.prepare("UPDATE sessions SET revoked_at=NULL WHERE person_id='admin'")]);
  }
  const cancel=await api.call(...operations[0],people.admin,'race-cancel',{'x-test-race':'cancel'});failed(cancel,409,'external_sharing_changed');
  const actions=operations[1];
  const originalRelease=await api.db.prepare("SELECT actions_json FROM releases WHERE release_id='orders-release'").first();
  failed(await api.call(...actions,people.admin,'race-action',{'x-test-race':'action'}),409,'external_sharing_changed');
  await api.db.prepare("UPDATE releases SET actions_json=? WHERE release_id='orders-release'").bind(originalRelease.actions_json).run();
  failed(await api.call(...actions,people.admin,'race-revision',{'x-test-race':'revision'}),409,'guest_revision_conflict');
  assert.deepEqual((await guest(api)).actionNames,[actionName]);
  failed(await api.call(...operations[2],people.admin,'race-target',{'x-test-race':'target'}),409,'external_sharing_changed');
  assert.equal((await api.db.prepare("SELECT COUNT(*) count FROM operation_receipts WHERE operation IN ('apps.guests.actions.set','apps.guests.invitation.cancel','apps.guests.revoke')").first()).count,0);
});


test('guest lifecycle migration preserves existing grants and invitations and keeps removal cascades',{timeout:30000},async t=>{
  const mf=new Miniflare({workers:[localWorker('migration-test','export default {fetch(){return new Response("ok")}}',{DB:{type:'d1',id:'populated-guest-migration'}})]});
  t.after(()=>mf.dispose());const db=await mf.getD1Database('DB','migration-test');
  const directory=new URL('../control-plane/migrations/',import.meta.url);
  const migrations=[];
  for(const name of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()) {
    const source=await readFile(new URL(name,directory),'utf8');
    migrations.push({name,hash:createHash('sha256').update(source).digest('hex'),statements:splitSqlQuery(source)});
  }
  await applyMigrations(db,migrations.filter(migration=>migration.name<'0015'),'before-guest-lifecycle');
  await db.batch([
    db.prepare("INSERT INTO people(person_id,email,verified_at,created_at) VALUES('owner','owner@example.com',1,1),('guest','guest@example.com',1,1)"),
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',1)"),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',1),('company','guest','member','active',1)"),
    db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at) VALUES('orders','company','Orders','orders','orders','https://orders.atrax.test','ready','workspace','owner',1,1)"),
    db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES('orders','orders.inspect','workspace')"),
    db.prepare("INSERT INTO app_guests(app_id,person_id,expires_at) VALUES('orders','guest',9999999999999)"),
    db.prepare("INSERT INTO app_guest_actions(app_id,person_id,action_name) VALUES('orders','guest','orders.inspect')"),
    db.prepare("INSERT INTO app_guest_invitations(invitation_id,app_id,email,action_names_json,status,expires_at,accepted_by,created_by,created_at,delivered_at) VALUES('accepted','orders','guest@example.com','[\"orders.inspect\"]','accepted',9999999999999,'guest','owner',1,2),('pending','orders','guest@example.com','[]','pending',9999999999999,NULL,'owner',3,4)"),
  ]);
  const before=(await db.prepare('SELECT * FROM app_guest_invitations ORDER BY invitation_id').all()).results;
  await applyMigrations(db,migrations,'guest-lifecycle');
  assert.deepEqual((await db.prepare('SELECT * FROM app_guest_invitations ORDER BY invitation_id').all()).results,before);
  const grant=await db.prepare("SELECT * FROM app_guests WHERE app_id='orders'").first();
  assert.equal(grant.expires_at,9999999999999);assert.equal(typeof grant.revision,'string');assert.ok(grant.revision.length>0);
  assert.deepEqual((await db.prepare('SELECT * FROM app_guest_actions').all()).results,[{app_id:'orders',person_id:'guest',action_name:'orders.inspect'}]);
  await db.prepare("UPDATE workspace_members SET status='removed' WHERE person_id='guest'").run();
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM app_guests').first()).count,0);
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM app_guest_actions').first()).count,0);
  assert.deepEqual((await db.prepare('SELECT status FROM app_guest_invitations').all()).results.map(row=>row.status),['revoked','revoked']);
});
