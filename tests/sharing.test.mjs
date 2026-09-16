import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';

const origin='https://api.atrax.test';
const workspaceId='workspace-paper';
const appId='orders-app';
const actionName='orders.inspect';
const people={
  owner:{id:'person-owner',email:'owner@example.com',token:'1'.repeat(64),role:'owner'},
  admin:{id:'person-admin',email:'admin@example.com',token:'2'.repeat(64),role:'admin'},
  maintainer:{id:'person-maintainer',email:'maintainer@example.com',token:'3'.repeat(64),role:'member'},
  alice:{id:'person-alice',email:'alice@example.com',token:'4'.repeat(64),role:'member'},
  bob:{id:'person-bob',email:'bob@example.com',token:'5'.repeat(64),role:'member'},
  outsider:{id:'person-outsider',email:'outsider@example.com',token:'6'.repeat(64)},
};

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function platform(t) {
  const mf=new Miniflare({workers:[
    localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),{
      CP_DB:{type:'d1',id:`sharing-${crypto.randomUUID()}`},
      AUTH_ORIGIN:{type:'json',value:origin},
      CONSOLE_ORIGIN:{type:'json',value:'https://console.atrax.test'},
    }),
  ]});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control-plane');
  await migrateControlPlane(db);
  const now=Date.now();
  const memberRows=Object.values(people).filter(person=>person.role);
  await db.batch([
    ...Object.values(people).map(person=>db.prepare(
      'INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)',
    ).bind(person.id,person.email,now,now)),
    ...Object.values(people).map(person=>db.prepare(
      "INSERT INTO sessions(session_id,secret_hash,person_id,kind,expires_at,created_at) VALUES(?,?,?,'browser',?,?)",
    ).bind(`session-${person.id}`,hash(person.token),person.id,now+3_600_000,now)),
    db.prepare('INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES(?,?,?,?,?)')
      .bind(workspaceId,'Paper Company','paper-company',people.owner.id,now),
    ...memberRows.map(person=>db.prepare(
      "INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES(?,?,?,'active',?)",
    ).bind(workspaceId,person.id,person.role,now)),
    db.prepare(`INSERT INTO apps
      (app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'ready','workspace',?,?,?)`)
      .bind(appId,workspaceId,'Orders','orders','app-orders','https://orders.atrax.test',people.owner.id,now,now),
    db.prepare('INSERT INTO app_maintainers(app_id,person_id) VALUES(?,?)')
      .bind(appId,people.maintainer.id),
    db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')")
      .bind(appId,actionName),
  ]);

  async function call(name,input,person=people.maintainer,key=crypto.randomUUID()) {
    const response=await mf.dispatchFetch(`${origin}/v1/operations/${name}`,{
      method:'POST',
      headers:{
        authorization:`Bearer ${person.token}`,
        'content-type':'application/json',
        'idempotency-key':key,
      },
      body:JSON.stringify(input),
    });
    return {response,body:await response.json()};
  }
  return {db,call};
}

function assertFailure(outcome,status,code) {
  assert.equal(outcome.response.status,status,JSON.stringify(outcome.body));
  assert.equal(outcome.body.status,'failed');
  assert.equal(outcome.body.error.code,code);
}

test('maintainers replace app access with optimistic, idempotent writes',{timeout:30000},async t=>{
  const api=await platform(t);
  assertFailure(await api.call('apps.access.get',{appId},people.alice),403,'forbidden');

  const initial=await api.call('apps.access.get',{appId});
  assert.equal(initial.response.status,200,JSON.stringify(initial.body));
  assert.deepEqual(initial.body.result.access,{
    appId,
    audience:'workspace',
    personIds:[],
    maintainerPersonIds:[people.maintainer.id],
    revision:1,
  });

  const input={
    appId,
    audience:'selected',
    personIds:[people.alice.id],
    expectedRevision:1,
  };
  const changed=await api.call('apps.access.set',input,people.maintainer,'app-access-one');
  assert.equal(changed.response.status,200,JSON.stringify(changed.body));
  assert.equal(changed.body.result.access.revision,2);
  assert.deepEqual(changed.body.result.access.personIds,[people.alice.id]);
  const retried=await api.call('apps.access.set',input,people.maintainer,'app-access-one');
  assert.deepEqual(retried.body.result,changed.body.result);
  assert.equal((await api.db.prepare("SELECT COUNT(*) AS count FROM operation_receipts WHERE operation='apps.access.set'").first()).count,1);
  assert.equal((await api.db.prepare("SELECT COUNT(*) AS count FROM activity WHERE operation='apps.access.set'").first()).count,1);

  const reused=await api.call('apps.access.set',{
    appId,
    audience:'workspace',
    personIds:[],
    expectedRevision:1,
  },people.maintainer,'app-access-one');
  assertFailure(reused,409,'idempotency_conflict');

  const stale=await api.call('apps.access.set',input,people.maintainer,'stale-policy');
  assertFailure(stale,409,'policy_revision_conflict');
  assert.equal(stale.body.error.details.currentRevision,2);

  const outsider=await api.call('apps.access.set',{
    appId,
    audience:'selected',
    personIds:[people.outsider.id],
    expectedRevision:2,
  },people.maintainer,'outsider-policy');
  assertFailure(outsider,400,'invalid_member');
  const current=await api.call('apps.access.get',{appId});
  assert.equal(current.body.result.access.revision,2);
  assert.deepEqual(current.body.result.access.personIds,[people.alice.id]);

  const concurrent=await Promise.all([
    api.call('apps.access.set',{
      appId,
      audience:'workspace',
      personIds:[],
      expectedRevision:2,
    },people.maintainer,'concurrent-workspace'),
    api.call('apps.access.set',{
      appId,
      audience:'selected',
      personIds:[people.bob.id],
      expectedRevision:2,
    },people.maintainer,'concurrent-selected'),
  ]);
  assert.deepEqual(concurrent.map(outcome=>outcome.response.status).sort(),[200,409]);
  assert.equal(concurrent.find(outcome=>outcome.response.status===409).body.error.code,'policy_revision_conflict');
  const afterConcurrent=await api.call('apps.access.get',{appId});
  assert.equal(afterConcurrent.body.result.access.revision,3);
});

test('maintainers and workspace admins can hand off app maintenance',{timeout:30000},async t=>{
  const api=await platform(t);
  await api.db.batch([
    api.db.prepare("UPDATE apps SET audience='selected',active_release_id='orders-release' WHERE app_id=?").bind(appId),
    api.db.prepare('INSERT INTO app_people(app_id,person_id) VALUES(?,?)').bind(appId,people.alice.id),
    api.db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind('orders-release',appId,'artifact','artifact-key','{}',JSON.stringify([{name:actionName,description:'Inspect orders',effect:'read'}]),'[]',people.owner.id,Date.now()),
  ]);
  const adminApps=await api.call('apps.list',{workspaceId},people.admin);
  assert.equal(adminApps.response.status,200,JSON.stringify(adminApps.body));
  assert.deepEqual(adminApps.body.result.apps.map(app=>({id:app.id,canOpen:app.canOpen,canMaintain:app.canMaintain,canManageMaintainers:app.canManageMaintainers})),[{id:appId,canOpen:false,canMaintain:false,canManageMaintainers:true}]);
  const memberApps=await api.call('apps.list',{workspaceId},people.bob);
  assert.equal(memberApps.response.status,200,JSON.stringify(memberApps.body));
  assert.deepEqual(memberApps.body.result.apps,[],'a member outside the selected app cannot discover it');
  assertFailure(await api.call('apps.get',{appId},people.bob),403,'forbidden');
  const adminView=await api.call('apps.get',{appId},people.admin);
  assert.equal(adminView.response.status,200,JSON.stringify(adminView.body));
  assert.deepEqual(adminView.body.result.capabilities,{canOpen:false,maintain:false,manageAccess:false,canManageMaintainers:true});
  assert.equal(adminView.body.result.release,undefined,'management metadata does not disclose app actions without app access');
  const adminAccess=await api.call('apps.access.get',{appId},people.admin);
  assert.equal(adminAccess.response.status,200,JSON.stringify(adminAccess.body));
  assert.deepEqual(adminAccess.body.result.access.maintainerPersonIds,[people.maintainer.id]);
  assertFailure(await api.call('apps.access.set',{appId,audience:'workspace',personIds:[],expectedRevision:1},people.admin,'admin-cannot-change-access'),403,'forbidden');
  assertFailure(await api.call('actions.access.get',{appId,actionName},people.admin),403,'forbidden');
  assertFailure(await api.call('actions.list',{appId},people.admin),403,'forbidden');
  assertFailure(await api.call('releases.upload',{appId,artifact:{}},people.admin),403,'forbidden');
  assertFailure(await api.call('deployments.start',{
    appId,
    releaseId:'candidate-release',
    expectedReleaseId:null,
  },people.admin,'admin-deploy'),403,'forbidden');
  assertFailure(await api.call('backups.list',{appId},people.admin),403,'forbidden');

  const added=await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.alice.id,people.maintainer.id],
    expectedRevision:1,
  },people.maintainer,'add-alice');
  assert.equal(added.response.status,200,JSON.stringify(added.body));
  assert.equal(added.body.result.access.revision,2);
  assert.deepEqual(added.body.result.access.maintainerPersonIds,[people.alice.id,people.maintainer.id]);

  const handedOff=await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.alice.id],
    expectedRevision:2,
  },people.alice,'handoff');
  assert.equal(handedOff.response.status,200,JSON.stringify(handedOff.body));
  assert.deepEqual(handedOff.body.result.access.maintainerPersonIds,[people.alice.id]);
  assertFailure(await api.call('apps.access.get',{appId},people.maintainer),403,'forbidden');
  assertFailure(await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.bob.id],
    expectedRevision:3,
  },people.bob,'member-cannot-assign'),403,'forbidden');

  const recovered=await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.bob.id],
    expectedRevision:3,
  },people.admin,'admin-recovery');
  assert.equal(recovered.response.status,200,JSON.stringify(recovered.body));
  assert.deepEqual(recovered.body.result.access.maintainerPersonIds,[people.bob.id]);
  assert.equal(recovered.body.result.access.revision,4);

  assertFailure(await api.call('apps.maintainers.set',{
    appId,
    personIds:[],
    expectedRevision:4,
  },people.owner,'empty-maintainers'),400,'invalid_input');
  assertFailure(await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.outsider.id],
    expectedRevision:4,
  },people.owner,'outsider-maintainer'),400,'invalid_member');

  const removed=await api.call('members.remove',{
    workspaceId,
    personId:people.bob.id,
  },people.owner,'remove-current-maintainer');
  assert.equal(removed.response.status,200,JSON.stringify(removed.body));
  assertFailure(await api.call('apps.access.get',{appId},people.bob),403,'forbidden');
  assertFailure(await api.call('releases.upload',{appId,artifact:{}},people.bob),403,'forbidden');
  assertFailure(await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.bob.id],
    expectedRevision:4,
  },people.bob,'removed-maintainer'),403,'forbidden');

  const orphanRecovery=await api.call('apps.maintainers.set',{
    appId,
    personIds:[people.alice.id],
    expectedRevision:4,
  },people.admin,'orphan-recovery');
  assert.equal(orphanRecovery.response.status,200,JSON.stringify(orphanRecovery.body));
  assert.deepEqual(orphanRecovery.body.result.access.maintainerPersonIds,[people.alice.id]);
  assert.equal(orphanRecovery.body.result.access.revision,5);
});

test('action audiences and denials survive release changes',{timeout:30000},async t=>{
  const api=await platform(t);
  const initial=await api.call('actions.access.get',{appId,actionName});
  assert.equal(initial.response.status,200,JSON.stringify(initial.body));
  assert.deepEqual(initial.body.result.access,{
    appId,
    actionName,
    audience:'workspace',
    personIds:[],
    deniedPersonIds:[],
    revision:1,
  });

  const input={
    appId,
    actionName,
    audience:'selected',
    personIds:[people.alice.id],
    deniedPersonIds:[people.bob.id],
    expectedRevision:1,
  };
  const changed=await api.call('actions.access.set',input,people.maintainer,'action-policy-one');
  assert.equal(changed.response.status,200,JSON.stringify(changed.body));
  assert.deepEqual(changed.body.result.access,{
    appId,
    actionName,
    audience:'selected',
    personIds:[people.alice.id],
    deniedPersonIds:[people.bob.id],
    revision:2,
  });
  assert.deepEqual((await api.call('actions.access.set',input,people.maintainer,'action-policy-one')).body.result,changed.body.result);

  assertFailure(await api.call('actions.access.set',{
    ...input,
    personIds:[people.alice.id,people.bob.id],
    expectedRevision:2,
  },people.maintainer,'overlapping-policy'),400,'invalid_input');
  const stale=await api.call('actions.access.set',input,people.maintainer,'stale-action-policy');
  assertFailure(stale,409,'policy_revision_conflict');
  assert.equal(stale.body.error.details.currentRevision,2);

  const now=Date.now();
  await api.db.batch([
    api.db.prepare(`INSERT INTO releases
      (release_id,app_id,artifact_hash,artifact_key,runtime_name,manifest_json,actions_json,migrations_json,created_by,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind('release-two',appId,'hash-two','artifacts/two','runtime-two','{}','[]','[]',people.owner.id,now),
    api.db.prepare('UPDATE apps SET active_release_id=? WHERE app_id=?').bind('release-two',appId),
  ]);
  const afterRelease=await api.call('actions.access.get',{appId,actionName});
  assert.deepEqual(afterRelease.body.result.access,changed.body.result.access);
  assert.deepEqual(
    (await api.db.prepare('SELECT person_id FROM action_denials WHERE app_id=? AND action_name=?')
      .bind(appId,actionName).all()).results.map(row=>row.person_id),
    [people.bob.id],
  );

  await api.db.prepare('UPDATE sessions SET revoked_at=? WHERE session_id=?')
    .bind(Date.now(),`session-${people.maintainer.id}`).run();
  assertFailure(await api.call('actions.access.set',{
    appId,
    actionName,
    audience:'workspace',
    personIds:[],
    deniedPersonIds:[],
    expectedRevision:2,
  },people.maintainer,'revoked-session'),401,'unauthorized');
});
