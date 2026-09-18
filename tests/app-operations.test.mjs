import assert from 'node:assert/strict';
import test from 'node:test';
import {createCliPlatform} from './helpers/cli-platform.mjs';

test('app operations reports recorded usage and recovery history only to current maintainers',async t=>{
  const platform=await createCliPlatform(t);
  const {db,call}=platform;
  const created=await call('apps.create',{workspaceId:'company',name:'Operations test',slug:'operations-test'});
  assert.equal(created.status,200);
  const appId=created.body.result.app.id;
  const empty=await call('apps.operations.get',{appId});
  assert.deepEqual(empty.body.result.deployments,[]);
  assert.deepEqual(empty.body.result.backups,[]);
  assert.equal(empty.body.result.usage.total,0);
  assert.equal(empty.body.result.database.present,false);
  assert.equal((await call('apps.operations.get',{appId},'member')).status,403);

  const now=Date.now();
  for(const id of ['old','live','upload-only']) await db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,'{}','[]','[]','owner',?)").bind(id,appId,id,id,now).run();
  await db.prepare("UPDATE apps SET active_release_id='live',status='ready',database_id='app-database' WHERE app_id=?").bind(appId).run();
  for(const [id,release,status,recordedAt,mode] of [['old-job','old','succeeded',now,'live'],['live-job','live','succeeded',now,'live'],['preview-job','upload-only','succeeded',null,'preview'],['failed-job','upload-only','failed',null,'live']]) {
    const state={id,kind:'deploy',candidateUrl:`https://${id}.example.test`,error:status==='failed'?{code:'provider_unavailable',message:'Provider unavailable',retryable:true}:null};
    await db.prepare("INSERT INTO deployments(deployment_id,app_id,release_id,created_by,mode,status,phase,state_json,created_at,updated_at,recorded_at) VALUES(?,?,?,'owner',?,?,'complete',?,?,?,?)").bind(id,appId,release,mode,status,JSON.stringify(state),now,now,recordedAt).run();
  }
  const backup={id:'backup',releaseId:'old',status:'succeeded',phase:'complete',snapshotCreatedAt:now-20000,size:300,createdAt:now-20000,updatedAt:now-19000};
  await db.prepare("INSERT INTO app_backups(backup_id,app_id,release_id,database_id,created_by,status,state_json,created_at,updated_at) VALUES('backup',?,'old','app-database','owner','succeeded',?,?,?)").bind(appId,JSON.stringify(backup),backup.createdAt,backup.updatedAt).run();
  for(const [id,status,started,expires] of [['success','succeeded',now-10000,now+10000],['failure','failed',now-9000,now+10000],['running','running',now-5000,now+60000],['interrupted','running',now-40000,now-10000],['yesterday','succeeded',now-90000000,now-89900000]]) {
    await db.prepare("INSERT INTO invocations(invocation_id,root_invocation_id,session_id,person_id,app_id,release_id,action_name,depth,status,started_at,expires_at,environment) VALUES(?,?,'owner-session','owner',?,'live','orders.create',0,?,?,?,'live')").bind(id,id,appId,status,started,expires).run();
  }
  const inspected=await call('apps.operations.get',{appId});
  assert.equal(inspected.status,200);
  const view=inspected.body.result;
  assert.equal(view.database.present,true);
  assert.equal(view.usage.total,4);
  for(const outcome of ['succeeded','failed','running','interrupted']) assert.equal(view.usage[outcome],1);
  assert.equal(view.usage.byAction[0].actionName,'orders.create');
  assert.equal(view.deployments.find(row=>row.id==='preview-job').mode,'preview');
  assert.equal(view.deployments.find(row=>row.id==='failed-job').error.retryable,true);
  assert.equal(view.deployments[0].createdBy,'owner@example.com');
  assert.deepEqual(view.releases.filter(row=>row.rollbackEligible).map(row=>row.id),['old']);
  assert.equal(view.backups[0].size,300);
  assert.equal(JSON.stringify(view).includes('app-database'),false);
  await db.prepare("UPDATE workspace_members SET status='removed' WHERE person_id='owner'").run();
  assert.equal((await call('apps.operations.get',{appId})).status,403);
});
