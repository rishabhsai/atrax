import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {transform} from 'esbuild';
import {platform,asset,workspaceId,appId,releaseId,actionName,hiddenActionName,retiredActionName,people,guestAgent,guestAppToken} from './helpers/guest-lifecycle-platform.mjs';

let consoleApi;
async function frontendSafeReturnTo(value) {
  consoleApi ??= (async()=>{
    const source=await readFile(new URL('../components/console/api.ts',import.meta.url),'utf8');
    const compiled=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
    return import(`data:text/javascript;base64,${Buffer.from(compiled.code).toString('base64')}`);
  })();
  return (await consoleApi).safeReturnTo(value);
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
  assert.equal(typeof listed.body.result.guests[0].revision,'string');
  assert.deepEqual(listed.body.result.guests.map(({personId,email,actionNames})=>({personId,email,actionNames})),[{personId:people.guest.id,email:people.guest.email,actionNames:[actionName]}]);
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
  assert.deepEqual(management.body.result.grantableActionNames,[hiddenActionName,actionName],'external sharing receives only current grant names');
  assert.deepEqual(management.body.result.audience,{publicWeb:false,workspace:{id:workspaceId,policy:'selected',people:[{personId:people.owner.id,email:people.owner.email,role:'owner'}]}});
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
