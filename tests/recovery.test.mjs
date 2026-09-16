import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cp,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';
import {buildApp} from '../cli/build.mjs';
import {providerApi} from './helpers/provider-api.mjs';

async function platform(t) {
  const directory=await mkdtemp(join(tmpdir(),'atrax-recovery-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const root=join(directory,'app');await cp(new URL('../templates/chat/',import.meta.url),root,{recursive:true});
  const manifestPath=join(root,'atrax.json');await writeFile(manifestPath,(await readFile(manifestPath,'utf8')).replaceAll('__APP_NAME__','example'));
  const provider=providerApi(),token='1'.repeat(64);
  const env={CP_DB:{type:'d1',id:'cp'},ARTIFACTS:{type:'r2',name:'artifacts'},DEPLOYMENTS:{type:'durable-object',worker:'control-plane',exportName:'DeploymentCoordinator'}};
  for(let i=0;i<32;i++) env[`DATA_${i}`]={type:'d1',id:`data-${i}`};
  for(const [key,value] of Object.entries({CF_API_TOKEN:'test-token',CP_ACCOUNT_ID:'account',CP_ZONE_ID:'zone',APP_DOMAIN:'apps.atrax.test',CONSOLE_ORIGIN:'https://console.atrax.test',ARTIFACT_BUCKET:'artifacts',CONTROL_PLANE_NAME:'control-plane'})) env[key]={type:'json',value};
  const worker=localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),env);
  worker.config.exports={DeploymentCoordinator:{type:'durable-object',storage:'sqlite'}};
  let mf;const slots=new Map();
  function slot(id) {if(!slots.has(id)) slots.set(id,slots.size);assert.ok(slots.get(id)<32);return slots.get(id);}
  worker.dev={outboundService:{type:'fetcher',handler:async request=>{
    if(['api.cloudflare.com','storage.atrax.test'].includes(new URL(request.url).hostname)) return provider.fetch(request);
    const domain=provider.domains.get(new URL(request.url).hostname);assert.ok(domain,'Health only uses registered candidate domain');
    return (await mf.getWorker(domain.service)).fetch(request);
  }}};
  const options={host:'127.0.0.1',port:0,resourcePersistencePath:join(directory,'state'),workers:[worker]};
  mf=new Miniflare(options);t.after(()=>mf.dispose());
  let db=await mf.getD1Database('CP_DB','control-plane');await migrateControlPlane(db);
  provider.database=id=>mf.getD1Database(`DATA_${slot(id)}`,'control-plane');
  const now=Date.now();
  await db.batch([
    db.prepare("INSERT INTO people(person_id,email,verified_at,created_at) VALUES('owner','owner@example.com',?,?),('member','member@example.com',?,?)").bind(now,now,now,now),
    db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,created_at,expires_at) VALUES('session',?,'owner','cli',?,?)").bind(createHash('sha256').update(token).digest('hex'),now,now+3600000),
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)").bind(now),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?)").bind(now,now),
  ]);
  async function call(name,input={},key=crypto.randomUUID()) {
    const response=await mf.dispatchFetch(`https://api.atrax.test/v1/operations/${name}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,'idempotency-key':key},body:JSON.stringify(input)});
    const body=await response.json();return {status:response.status,body,result:body.result};
  }
  async function okay(...args) {const value=await call(...args);assert.equal(value.status,200,JSON.stringify(value.body));return value.result;}
  const {app}=await okay('apps.create',{workspaceId:'company',name:'Example',slug:'example'});
  async function upload() {const artifact=await buildApp(root);const {release}=await okay('releases.upload',{appId:app.id,artifact});return {artifact,release};}
  async function refresh() {
    const workers=[worker];
    for(const record of provider.workers.values()) {
      const bindings={};
      for(const binding of record.metadata.bindings) {
        if(binding.type==='plain_text') bindings[binding.name]={type:'json',value:binding.text};
        if(binding.type==='d1') bindings[binding.name]={type:'d1',id:`data-${slot(binding.id)}`};
        if(binding.type==='r2_bucket') bindings[binding.name]={type:'r2',name:binding.bucket_name};
        if(binding.type==='service') bindings[binding.name]={type:'worker',worker:binding.service,exportName:binding.entrypoint};
      }
      workers.push(localWorker(record.name,record.source,bindings));
    }
    await mf.setOptions({...options,workers});db=await mf.getD1Database('CP_DB','control-plane');
  }
  async function wait(id,status,{backup=false}={}) {
    for(let i=0;i<600;i++) {
      const response=await okay(backup?'backups.get':'deployments.get',{appId:app.id,[backup?'backupId':'deploymentId']:id});
      const job=response[backup?'backup':'deployment'];
      if(job.status===status) return job;
      assert.notEqual(job.status,'failed',JSON.stringify(job));
      assert.notEqual(job.status,'succeeded',`Expected ${status}, but deployment completed: ${JSON.stringify(job)}`);
      await new Promise(resolve=>setTimeout(resolve,15));
    }
    assert.fail(`Job did not reach ${status}`);
  }
  async function publish(release,expectedReleaseId=null,extra={}) {
    const {deployment}=await okay('deployments.start',{appId:app.id,releaseId:release.id,expectedReleaseId,...extra});
    await wait(deployment.id,'awaiting_verification');await refresh();
    await okay('deployments.verify',{appId:app.id,deploymentId:deployment.id});
    const result=await wait(deployment.id,'succeeded');await refresh();return result;
  }
  async function cleaned(id,status='complete') {
    for(let i=0;i<600;i++) {
      const {deployment}=await okay('deployments.get',{appId:app.id,deploymentId:id});
      if(deployment.cleanup?.status===status) return deployment;
      await new Promise(resolve=>setTimeout(resolve,15));
    }
    assert.fail(`Cleanup did not reach ${status}`);
  }
  async function row() {return db.prepare('SELECT * FROM apps WHERE app_id=?').bind(app.id).first();}
  async function liveDb() {return provider.database((await row()).database_id);}
  return {root,get db(){return db;},mf,provider,app,call,okay,upload,refresh,wait,publish,cleaned,row,liveDb,token};
}

test('online additive update retains live data; uncertain migration commits reconcile once; code rollback keeps data and schema',async t=>{
  const api=await platform(t);const first=await api.upload();await api.publish(first.release);
  const original=await api.row();let db=await api.liveDb();
  await db.prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(1,'Owner','Retain me',1,'original')").run();
  await writeFile(join(api.root,'migrations/0002_labels.json'),JSON.stringify({version:1,operations:[{createTable:{name:'labels',columns:[{name:'id',type:'TEXT',primaryKey:true}]}}]}));
  const second=await api.upload();const plan=(await api.okay('deployments.plan',{appId:api.app.id,releaseId:second.release.id,expectedReleaseId:first.release.id})).plan;
  assert.equal(plan.database,'retain');assert.equal(plan.apply[0].name,'0002_labels.json');assert.equal(plan.blocked,null);
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:second.release.id,expectedReleaseId:first.release.id});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  let lost=false;api.provider.after=call=>{if(!lost&&call.path.includes(original.database_id)&&call.batch?.some(statement=>statement.sql.startsWith('CREATE TABLE "labels"'))) {lost=true;throw new Error('Lost committed migration response');}};
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});
  const failed=await api.wait(deployment.id,'failed');assert.equal(failed.error.uncertain,true);assert.equal(lost,true);
  assert.equal((await api.call('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:first.release.id})).status,409);
  await api.okay('deployments.resume',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'succeeded');
  db=await api.provider.database(original.database_id);
  assert.equal((await db.prepare('SELECT count(*) count FROM __atrax_migrations').first()).count,2);
  assert.equal(api.provider.calls.filter(call=>call.path.includes(original.database_id)&&call.batch?.some(statement=>statement.sql.startsWith('CREATE TABLE "labels"'))).length,1);
  assert.equal((await api.row()).database_id,original.database_id);assert.equal((await api.row()).url,original.url);
  await db.prepare("INSERT INTO labels VALUES('after-upgrade')").run();
  const {deployment:rollback}=await api.okay('deployments.rollback',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:second.release.id});
  await api.wait(rollback.id,'awaiting_verification');await api.refresh();await api.okay('deployments.verify',{appId:api.app.id,deploymentId:rollback.id});await api.wait(rollback.id,'succeeded');
  db=await api.provider.database(original.database_id);
  assert.equal((await api.row()).database_id,original.database_id);assert.equal((await api.row()).schema_release_id,second.release.id);
  assert.equal((await db.prepare('SELECT body FROM messages').first()).body,'Retain me');assert.equal((await db.prepare('SELECT id FROM labels').first()).id,'after-upgrade');
  assert.equal((await api.call('deployments.start',{appId:api.app.id,releaseId:second.release.id,expectedReleaseId:second.release.id})).status,409);
});

test('snapshot restore forks data, retains late writes and uncertain imports, and requires exact plan confirmation',async t=>{
  const api=await platform(t);const first=await api.upload();await api.publish(first.release);
  const original=await api.row();let db=await api.liveDb();
  await db.prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(1,'Owner','Before snapshot',1,'snapshot')").run();
  const {backup}=await api.okay('backups.create',{appId:api.app.id,expectedReleaseId:first.release.id},'one-snapshot');
  const saved=await api.wait(backup.id,'succeeded',{backup:true});assert.ok(saved.sha256);assert.ok(saved.size>0);
  assert.equal((await api.okay('backups.create',{appId:api.app.id,expectedReleaseId:first.release.id},'one-snapshot')).backup.id,backup.id);
  await db.prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(2,'Owner','After snapshot',2,'late')").run();
  const {plan}=await api.okay('data.restore.plan',{appId:api.app.id,backupId:backup.id});
  const confirmation={originalDatabaseId:plan.originalDatabaseId,snapshotCreatedAt:plan.snapshotCreatedAt,connectedAppIds:plan.connectedAppIds,retainOriginalDatabase:true};
  const input={appId:api.app.id,backupId:backup.id,expectedReleaseId:first.release.id,confirmation};
  assert.equal((await api.call('data.restore.start',{...input,confirmation:{...confirmation,snapshotCreatedAt:0}})).status,409);
  let lost=false;api.provider.after=call=>{if(!lost&&call.input?.action==='ingest') {lost=true;throw new Error('Lost successful import response');}};
  const {deployment}=await api.okay('data.restore.start',input,'restore-once');
  await api.wait(deployment.id,'failed');assert.equal((await api.row()).database_id,original.database_id);
  await api.okay('deployments.resume',{appId:api.app.id,deploymentId:deployment.id});
  const waiting=await api.wait(deployment.id,'awaiting_verification');assert.equal(waiting.retainedDatabaseIds.length,2);
  await api.refresh();await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});const completed=await api.wait(deployment.id,'succeeded');
  await api.cleaned(deployment.id);
  assert.notEqual(completed.databaseId,original.database_id);assert.equal(completed.url,original.url);
  db=await api.provider.database(original.database_id);
  assert.deepEqual((await (await api.liveDb()).prepare('SELECT command_key FROM messages ORDER BY command_key').all()).results.map(row=>row.command_key),['snapshot']);
  assert.deepEqual((await db.prepare('SELECT command_key FROM messages ORDER BY command_key').all()).results.map(row=>row.command_key),['late','snapshot']);
  assert.equal((await api.db.prepare('SELECT original_database_id FROM database_forks').first()).original_database_id,original.database_id);
  assert.ok(completed.retainedDatabaseIds.every(id=>[...api.provider.databases.values()].some(database=>database.uuid===id)),'Cleanup preserves original and uncertain restore databases');
  assert.equal((await api.okay('data.restore.start',input,'restore-once')).deployment.id,deployment.id);
  assert.equal((await api.call('data.restore.start',input)).status,409,'Old confirmation cannot rewind a newer data fork');
});

test('previews use isolated sample databases and cannot change live release, database, or dependency bindings',async t=>{
  const api=await platform(t);const first=await api.upload();await api.publish(first.release);
  const original=await api.row();await (await api.liveDb()).prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(1,'Owner','Only live',1,'live')").run();
  const {app:target}=await api.okay('apps.create',{workspaceId:'company',name:'Inventory',slug:'inventory'});
  const manifest=JSON.parse(await readFile(join(api.root,'atrax.json'),'utf8'));manifest.dependencies={inventory:{appId:target.id}};await writeFile(join(api.root,'atrax.json'),JSON.stringify(manifest));
  await writeFile(join(api.root,'src/actions.js'),(await readFile(join(api.root,'src/actions.js'),'utf8'))+`
actions['preview.lookup']={description:'Exercise an isolated dependency',effect:'read',inputSchema:{type:'object',additionalProperties:false},outputSchema:{type:'object'},async handler(input,{actions}){return actions.call('inventory','stock.list',input)}};
`);
  const second=await api.upload();
  const {deployment}=await api.okay('previews.create',{appId:api.app.id,releaseId:second.release.id});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});const preview=await api.wait(deployment.id,'succeeded');
  assert.notEqual(preview.url,original.url);assert.equal((await api.row()).active_release_id,original.active_release_id);assert.equal((await api.row()).database_id,original.database_id);
  const gateway=api.provider.workers.get(api.provider.domains.get(new URL(preview.url).hostname).service);
  assert.ok(gateway.metadata.bindings.every(binding=>!binding.name.startsWith('DEP_')&&binding.name!=='LIBRARY'));
  const invoked=await (await api.mf.getWorker(gateway.name)).fetch(new URL('/__atrax/actions/preview.lookup',preview.url),{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${api.token}`},body:'{}'});
  assert.equal(invoked.status,409,await invoked.clone().text());assert.equal((await invoked.json()).error.code,'dependency_not_configured');
  const runtime=api.provider.workers.get(gateway.metadata.bindings.find(binding=>binding.name==='RUNTIME').service);
  const previewDbId=runtime.metadata.bindings.find(binding=>binding.name==='DB').id;assert.notEqual(previewDbId,original.database_id);
  assert.equal((await (await api.provider.database(previewDbId)).prepare('SELECT count(*) count FROM messages').first()).count,0);
  assert.equal((await api.okay('previews.list',{appId:api.app.id})).previews[0].id,preview.id);
});

test('initial deployment publishes selected audiences atomically and code updates preserve those policies',async t=>{
  const api=await platform(t),first=await api.upload();
  const input={appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null,actionAccess:{'messages.send':{audience:'selected',personIds:['owner'],deniedPersonIds:['member']}}};
  assert.equal((await api.call('deployments.start',{...input,actionAccess:{'unknown.action':{audience:'workspace'}}})).status,400);
  assert.equal((await api.call('deployments.start',{...input,actionAccess:{'messages.send':{audience:'selected',personIds:['removed']}}})).status,400);
  const {deployment}=await api.okay('deployments.start',input,'selected-first');
  assert.equal((await api.call('deployments.start',{...input,actionAccess:{}},'selected-first')).status,409);
  await api.wait(deployment.id,'awaiting_verification');
  assert.equal((await api.db.prepare('SELECT count(*) count FROM action_policies').first()).count,0,'Candidate preparation does not publish live policies');
  await api.refresh();await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'succeeded');await api.refresh();
  const policy=await api.db.prepare("SELECT audience,revision FROM action_policies WHERE action_name='messages.send'").first();assert.equal(policy.audience,'selected');
  assert.deepEqual((await api.db.prepare('SELECT person_id FROM action_people').all()).results,[{person_id:'owner'}]);
  assert.deepEqual((await api.db.prepare('SELECT person_id FROM action_denials').all()).results,[{person_id:'member'}]);
  await writeFile(join(api.root,'public/index.html'),'<h1>Updated app, same audience</h1>');const second=await api.upload();
  assert.equal((await api.call('deployments.start',{...input,releaseId:second.release.id,expectedReleaseId:first.release.id})).body.error.code,'policy_revision_required');
  await api.publish(second.release,first.release.id);
  assert.deepEqual(await api.db.prepare("SELECT audience,revision FROM action_policies WHERE action_name='messages.send'").first(),policy);
  assert.deepEqual((await api.db.prepare('SELECT person_id FROM action_denials').all()).results,[{person_id:'member'}]);
});

test('publication receipt prevents retry from resurrecting a later sharing revision',async t=>{
  const api=await platform(t),first=await api.upload();
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null,actionAccess:{'messages.send':{audience:'selected',personIds:['owner']}}});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  await api.db.prepare("CREATE TRIGGER lose_recording_ack BEFORE UPDATE OF status ON deployments WHEN NEW.status='succeeded' BEGIN SELECT RAISE(FAIL,'lost recording acknowledgement'); END").run();
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'failed');
  assert.ok((await api.db.prepare('SELECT recorded_at FROM deployments WHERE deployment_id=?').bind(deployment.id).first()).recorded_at);
  await api.okay('actions.access.set',{appId:api.app.id,actionName:'messages.send',audience:'selected',personIds:['member'],deniedPersonIds:[],expectedRevision:1});
  await api.db.prepare('DROP TRIGGER lose_recording_ack').run();
  await api.okay('deployments.resume',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'succeeded');
  assert.deepEqual((await api.db.prepare("SELECT person_id FROM action_people WHERE action_name='messages.send'").all()).results,[{person_id:'member'}]);
  assert.equal((await api.db.prepare("SELECT revision FROM action_policies WHERE action_name='messages.send'").first()).revision,2);
});

test('an interrupted backup resumes with a fresh capture window without changing live data',async t=>{
  const api=await platform(t),first=await api.upload();const deployed=await api.publish(first.release);await api.cleaned(deployed.id);
  const original=await api.row();let fail=true;const externalFetch=api.provider.fetch.bind(api.provider);
  api.provider.fetch=async request=>{if(fail&&new URL(request.url).hostname==='storage.atrax.test') {fail=false;throw new Error('Expired or interrupted snapshot download');}return externalFetch(request);};
  const {backup}=await api.okay('backups.create',{appId:api.app.id,expectedReleaseId:first.release.id});
  const failed=await api.wait(backup.id,'failed',{backup:true});assert.equal(failed.phase,'capture');
  await api.okay('backups.resume',{appId:api.app.id,backupId:backup.id});const saved=await api.wait(backup.id,'succeeded',{backup:true});
  assert.ok(saved.snapshotCreatedAt>=failed.snapshotCreatedAt);assert.notEqual(saved.bookmark,failed.bookmark);
  assert.equal((await api.row()).database_id,original.database_id);assert.equal(api.provider.databases.size,1,'The temporary candidate is reclaimed; the live database is retained');
});

test('preview copies business data only from an explicitly authorized backup and keeps trial writes isolated',async t=>{
  const api=await platform(t),first=await api.upload();await api.publish(first.release);
  const original=await api.row();await (await api.liveDb()).prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(1,'Owner','Snapshot',1,'snapshot')").run();
  const {backup}=await api.okay('backups.create',{appId:api.app.id,expectedReleaseId:first.release.id});await api.wait(backup.id,'succeeded',{backup:true});
  await (await api.liveDb()).prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(2,'Owner','Late',2,'late')").run();
  const input={appId:api.app.id,releaseId:first.release.id,data:{backupId:backup.id,authorizeLiveDataCopy:true}};
  assert.equal((await api.call('previews.create',{...input,data:{backupId:backup.id,authorizeLiveDataCopy:false}})).status,400);
  const {deployment}=await api.okay('previews.create',input);await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});const preview=await api.wait(deployment.id,'succeeded');
  const isolated=await api.provider.database(preview.databaseId);assert.notEqual(preview.databaseId,original.database_id);
  assert.deepEqual((await isolated.prepare('SELECT command_key FROM messages').all()).results,[{command_key:'snapshot'}]);
  await isolated.prepare('DELETE FROM messages').run();
  assert.equal((await (await api.liveDb()).prepare('SELECT count(*) count FROM messages').first()).count,2);assert.equal((await api.row()).database_id,original.database_id);
});

async function cancelJob(api,id) {
  const {plan}=await api.okay('deployments.cancel.plan',{appId:api.app.id,deploymentId:id});
  assert.equal(plan.canCancel,true,JSON.stringify(plan));
  const {deployment}=await api.okay('deployments.cancel',{appId:api.app.id,deploymentId:id,planHash:plan.planHash});
  assert.equal(deployment.status,'cancelled');return {plan,deployment};
}

test('a removed initial-audience member can be corrected after observed safe cancellation without losing the app database',async t=>{
  const api=await platform(t),first=await api.upload();
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null,actionAccess:{'messages.send':{audience:'selected',personIds:['member']}}});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  let removed=false;api.provider.after=async call=>{
    if(!removed&&call.method==='PUT'&&call.path.includes('/scripts/runtime-')) {removed=true;await api.okay('members.remove',{workspaceId:'company',personId:'member'});}
  };
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});const failed=await api.wait(deployment.id,'failed');
  assert.equal(failed.phase,'publishing');assert.equal(removed,true);const databaseId=(await api.row()).database_id;
  await (await api.liveDb()).prepare("INSERT INTO messages(nickname,body,created_at,command_key) VALUES('Owner','Retain through correction',1,'preserved')").run();
  const cancelled=await cancelJob(api,deployment.id);assert.equal(cancelled.plan.observedReleaseId,null);assert.equal(cancelled.deployment.cancellation.appliedMigrations.length,1);
  assert.equal((await api.call('deployments.resume',{appId:api.app.id,deploymentId:deployment.id})).body.error.code,'deployment_cancelled');
  await api.publish(first.release,null,{actionAccess:{'messages.send':{audience:'selected',personIds:['owner']}}});
  assert.equal((await api.row()).database_id,databaseId);assert.equal((await (await api.liveDb()).prepare('SELECT body FROM messages').first()).body,'Retain through correction');
  assert.deepEqual((await api.db.prepare("SELECT person_id FROM action_people WHERE action_name='messages.send'").all()).results,[{person_id:'owner'}]);
});

test('partial additive migration failure can be cancelled and corrected from the actual committed ledger',async t=>{
  const api=await platform(t),first=await api.upload();await api.publish(first.release);
  const original=await api.row();let db=await api.liveDb();
  await db.batch([db.prepare('CREATE TABLE business_owned(id TEXT PRIMARY KEY)'),db.prepare("INSERT INTO business_owned VALUES('retain')")]);
  const addition=name=>JSON.stringify({version:1,operations:[{createTable:{name,columns:[{name:'id',type:'TEXT',primaryKey:true}]}}]});
  await writeFile(join(api.root,'migrations/0002_labels.json'),addition('labels'));
  await writeFile(join(api.root,'migrations/0003_next.json'),addition('business_owned'));
  const broken=await api.upload();const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:broken.release.id,expectedReleaseId:first.release.id});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'failed');
  assert.equal((await api.row()).schema_release_id,first.release.id,'A whole-release pointer cannot describe the partial schema');
  const {deployment:cancelled}=await cancelJob(api,deployment.id);assert.deepEqual(cancelled.cancellation.appliedMigrations.map(value=>value.name),['0001_messages.sql','0002_labels.json']);
  await writeFile(join(api.root,'migrations/0003_next.json'),addition('corrected'));
  const corrected=await api.upload();const {plan}=await api.okay('deployments.plan',{appId:api.app.id,releaseId:corrected.release.id,expectedReleaseId:first.release.id});
  assert.deepEqual(plan.apply.map(value=>value.name),['0003_next.json']);await api.publish(corrected.release,first.release.id);
  db=await api.liveDb();assert.equal((await api.row()).database_id,original.database_id);
  assert.equal((await db.prepare('SELECT id FROM business_owned').first()).id,'retain');assert.equal((await db.prepare('SELECT count(*) count FROM __atrax_migrations').first()).count,3);
  assert.ok(await db.prepare("SELECT name FROM sqlite_master WHERE name='corrected'").first());
});

test('generation fencing rejects a delayed old migration and delayed old claim after a corrected deployment',async t=>{
  const api=await platform(t),first=await api.upload();await api.publish(first.release);
  const original=await api.row();
  const addition=name=>JSON.stringify({version:1,operations:[{createTable:{name,columns:[{name:'id',type:'TEXT'}]}}]});
  await writeFile(join(api.root,'migrations/0002_next.json'),addition('late_old_table'));const broken=await api.upload();
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:broken.release.id,expectedReleaseId:first.release.id});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  const externalFetch=api.provider.fetch.bind(api.provider);let delayedBatch;
  api.provider.fetch=async request=>{
    if(new URL(request.url).pathname.endsWith(`/database/${original.database_id}/query`)) {
      const {batch}=await request.clone().json();
      if(batch.some(value=>value.sql.startsWith('CREATE TABLE "late_old_table"'))) {delayedBatch=batch;throw new Error('Accepted by provider; response lost before execution');}
    }
    return externalFetch(request);
  };
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'failed');assert.ok(delayedBatch);
  const delayedClaim=api.provider.calls.findLast(call=>call.path.includes(original.database_id)&&call.batch?.some(statement=>statement.sql.startsWith('UPDATE __atrax_deployment_fence')&&statement.params?.[0]===deployment.id)).batch;
  const cancelled=await cancelJob(api,deployment.id);
  await writeFile(join(api.root,'migrations/0002_next.json'),addition('corrected_table'));const corrected=await api.upload();const completed=await api.publish(corrected.release,first.release.id);
  const db=await api.liveDb();const run=batch=>db.batch(batch.map(({sql,params=[]})=>db.prepare(sql).bind(...params)));
  await assert.rejects(run(delayedClaim),/NOT NULL|constraint/);await assert.rejects(run(delayedBatch),/NOT NULL|constraint/);
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name='late_old_table'").first(),null);
  assert.equal((await db.prepare('SELECT generation FROM __atrax_deployment_fence').first()).generation,completed.id);
  assert.equal((await api.okay('deployments.cancel',{appId:api.app.id,deploymentId:deployment.id,planHash:cancelled.plan.planHash})).deployment.status,'cancelled');
  assert.equal((await db.prepare('SELECT generation FROM __atrax_deployment_fence').first()).generation,completed.id,'Repeating cancellation cannot fence a newer deployment');
});

test('an admitted uncertain publication cannot be cancelled by observing the previous gateway',async t=>{
  const api=await platform(t),first=await api.upload();await api.publish(first.release);
  const original=await api.row();await writeFile(join(api.root,'public/index.html'),'<h1>Next release</h1>');const next=await api.upload();
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:next.release.id,expectedReleaseId:first.release.id});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  // Keep the provider outage in force until explicit recovery. A one-shot
  // transport exception can be consumed by transport/alarm retry machinery.
  let fail=true,intercepted=0;api.provider.before=call=>{if(fail&&call.method==='PUT'&&call.path.endsWith(`/scripts/${original.gateway_name}`)) {intercepted++;return Response.json({success:false,errors:[{code:1000,message:'Publication outcome unknown'}]},{status:503});}};
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});const failed=await api.wait(deployment.id,'failed');
  assert.ok(intercepted>0,'The live gateway publication fault must be exercised');
  assert.equal(failed.error.uncertain,true);
  const {plan}=await api.okay('deployments.cancel.plan',{appId:api.app.id,deploymentId:deployment.id});assert.equal(plan.observedReleaseId,first.release.id);assert.equal(plan.canCancel,false);assert.match(plan.reason,/Publication was admitted/);
  assert.equal((await api.call('deployments.cancel',{appId:api.app.id,deploymentId:deployment.id,planHash:plan.planHash})).body.error.code,'cancellation_not_safe');
  assert.equal((await api.call('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:first.release.id})).status,409);
  fail=false;
  await api.okay('deployments.resume',{appId:api.app.id,deploymentId:deployment.id});await api.wait(deployment.id,'succeeded');assert.equal((await api.row()).active_release_id,next.release.id);
});

test('cancellation reserves the durable job before network work so verify and resume cannot overwrite it',async t=>{
  const api=await platform(t),first=await api.upload();
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();
  const {plan}=await api.okay('deployments.cancel.plan',{appId:api.app.id,deploymentId:deployment.id});
  const original=await api.row();let entered,release;
  const inspecting=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});t.after(()=>release());
  let held=false;api.provider.before=async call=>{if(!held&&call.path.endsWith(`/scripts/${original.gateway_name}/settings`)) {held=true;entered();await gate;}};
  const input={appId:api.app.id,deploymentId:deployment.id,planHash:plan.planHash};
  const cancelling=api.okay('deployments.cancel',input);await inspecting;
  assert.equal((await api.call('deployments.verify',{appId:api.app.id,deploymentId:deployment.id})).body.error.code,'deployment_not_ready');
  assert.equal((await api.call('deployments.resume',{appId:api.app.id,deploymentId:deployment.id})).body.error.code,'deployment_cancelled');
  const duplicate=api.okay('deployments.cancel',input);release();
  assert.equal((await cancelling).deployment.status,'cancelled');assert.equal((await duplicate).deployment.status,'cancelled');
  assert.equal((await api.row()).active_release_id,null);assert.equal(api.provider.workers.has(original.gateway_name),false);
});

test('candidate cleanup retries independently while later deployments succeed and business data remains',async t=>{
  const api=await platform(t),first=await api.upload();let outage=true,failedDeletes=0;
  api.provider.before=call=>{if(outage&&call.method==='DELETE'&&call.path.includes('/workers/domains/')) {failedDeletes++;return Response.json({success:false,errors:[]},{status:503});}};
  const initial=await api.publish(first.release),original=await api.row();
  await (await api.liveDb()).prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(1,'Owner','Retained through cleanup',1,'retained')").run();
  await writeFile(join(api.root,'public/index.html'),'<h1>Cleaned update</h1>');const next=await api.upload();
  const updated=await api.publish(next.release,first.release.id);
  assert.ok(failedDeletes>0,'A real provider cleanup failure occurred');
  assert.equal((await api.okay('deployments.get',{appId:api.app.id,deploymentId:initial.id})).deployment.status,'succeeded');
  outage=false;await api.cleaned(initial.id);await api.cleaned(updated.id);
  assert.equal(api.provider.domains.size,1,'Only the stable live custom domain remains');
  assert.equal(api.provider.databases.size,1,'Only the business database remains');
  assert.ok([...api.provider.workers.keys()].every(name=>!name.startsWith('check-')));
  assert.equal(api.provider.workers.size,3,'The live gateway and two rollback runtimes remain');
  assert.equal((await api.row()).database_id,original.database_id);
  assert.equal((await (await api.liveDb()).prepare('SELECT body FROM messages').first()).body,'Retained through cleanup');
});

test('explicit preview deletion revokes access immediately, checks live references, and removes only its copy',async t=>{
  const api=await platform(t),first=await api.upload(),live=await api.publish(first.release);await api.cleaned(live.id);
  const original=await api.row();await (await api.liveDb()).prepare("INSERT INTO messages(id,nickname,body,created_at,command_key) VALUES(1,'Owner','Snapshot source',1,'source')").run();
  const {backup}=await api.okay('backups.create',{appId:api.app.id,expectedReleaseId:first.release.id});const saved=await api.wait(backup.id,'succeeded',{backup:true});
  const {deployment}=await api.okay('previews.create',{appId:api.app.id,releaseId:first.release.id,data:{backupId:backup.id,authorizeLiveDataCopy:true}});
  await api.wait(deployment.id,'awaiting_verification');await api.refresh();await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});const preview=await api.wait(deployment.id,'succeeded');
  const candidate=api.provider.domains.get(new URL(preview.url).hostname).service;
  const previewRuntime=api.provider.workers.get(candidate).metadata.bindings.find(value=>value.name==='RUNTIME').service;
  const liveGateway=api.provider.workers.get(original.gateway_name),runtimeBinding=liveGateway.metadata.bindings.find(value=>value.name==='RUNTIME'),liveRuntime=runtimeBinding.service;
  runtimeBinding.service=previewRuntime;
  const input={appId:api.app.id,deploymentId:preview.id,confirmation:'delete-preview'};
  const closed=(await api.okay('previews.delete',input)).deployment;assert.ok(closed.closedAt);
  assert.equal((await api.db.prepare('SELECT active FROM app_hosts WHERE hostname=?').bind(new URL(preview.url).hostname).first()).active,0);
  for(let i=0;i<300;i++) {const job=(await api.okay('deployments.get',{appId:api.app.id,deploymentId:preview.id})).deployment;if(job.cleanup?.error) {assert.equal(job.cleanup.error.code,'cleanup_live_reference');break;}if(i===299) assert.fail('Cleanup did not inspect the live reference');await new Promise(resolve=>setTimeout(resolve,15));}
  assert.ok(api.provider.workers.has(previewRuntime),'A referenced runtime is never deleted');
  runtimeBinding.service=liveRuntime;await api.cleaned(preview.id);
  assert.equal(api.provider.databases.size,1);assert.equal(api.provider.domains.size,1);assert.equal(api.provider.workers.has(previewRuntime),false);
  assert.equal((await api.okay('previews.delete',input)).deployment.closedAt,closed.closedAt,'Repeated close is idempotent');
  assert.equal((await api.row()).database_id,original.database_id);assert.equal((await api.okay('backups.get',{appId:api.app.id,backupId:backup.id})).backup.sha256,saved.sha256);
  assert.equal((await (await api.liveDb()).prepare('SELECT body FROM messages').first()).body,'Snapshot source');
});

test('cancellation retains a private runtime when an uncertain old upload could arrive after cleanup',async t=>{
  const api=await platform(t),first=await api.upload(),externalFetch=api.provider.fetch.bind(api.provider);let delayed;
  api.provider.fetch=async request=>{
    if(request.method==='PUT'&&/\/scripts\/check-run-/.test(new URL(request.url).pathname)) {
      const form=await request.clone().formData(),metadata=JSON.parse(await form.get('metadata').text());
      if(metadata.tags.includes('atrax-kind:runtime')) {delayed=request.clone();return Response.json({success:false,errors:[]},{status:503});}
    }
    return externalFetch(request);
  };
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null});
  const failed=await api.wait(deployment.id,'failed');assert.equal(failed.phase,'candidate_runtime');assert.ok(delayed);
  await cancelJob(api,deployment.id);const retained=await api.cleaned(deployment.id,'retained');
  assert.equal(retained.cleanup.retained.reason,'unresolved_runtime_upload');
  assert.ok(api.provider.workers.has(retained.cleanup.retained.runtime));
  assert.equal(api.provider.calls.some(call=>call.method==='DELETE'&&call.path.includes('/scripts/check-run-')),false);
  await externalFetch(delayed);
  const runtime=api.provider.workers.get(retained.cleanup.retained.runtime);
  assert.equal(runtime.enabled,false);assert.equal(runtime.previews_enabled,false,'Delayed code remains private because its Worker was retained');
  assert.equal(api.provider.databases.size,1);assert.equal((await api.row()).active_release_id,null);
});

test('unconfirmed candidate domain attachment is retained honestly even when it arrives after cancellation',async t=>{
  const api=await platform(t),first=await api.upload(),externalFetch=api.provider.fetch.bind(api.provider);let delayed;
  api.provider.fetch=async request=>{
    if(request.method==='PUT'&&new URL(request.url).pathname.endsWith('/workers/domains')) {delayed=request.clone();return Response.json({success:false,errors:[]},{status:503});}
    return externalFetch(request);
  };
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null});
  const failed=await api.wait(deployment.id,'failed');assert.equal(failed.phase,'candidate_gateway');assert.ok(delayed);
  await cancelJob(api,deployment.id);const retained=await api.cleaned(deployment.id,'retained');
  assert.equal(retained.cleanup.retained.reason,'unresolved_gateway_publication');
  await externalFetch(delayed);
  assert.ok(api.provider.domains.has(new URL(retained.candidateUrl).hostname));
  const host=await api.db.prepare('SELECT active FROM app_hosts WHERE hostname=?').bind(new URL(retained.candidateUrl).hostname).first();assert.ok(!host?.active,'A late domain never restores Door authorization');
  assert.equal(api.provider.calls.some(call=>call.method==='DELETE'),false);
});

test('definitely rejected candidate creation is reclaimable after cancellation',async t=>{
  const api=await platform(t),first=await api.upload();
  api.provider.before=call=>{if(call.method==='PUT'&&call.path.includes('/scripts/check-run-')) return Response.json({success:false,errors:[]},{status:400});};
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:first.release.id,expectedReleaseId:null});
  const failed=await api.wait(deployment.id,'failed');assert.equal(failed.phase,'candidate_runtime');assert.equal(failed.error.uncertain,false);
  await cancelJob(api,deployment.id);await api.cleaned(deployment.id);
  assert.equal(api.provider.workers.size,0);assert.equal(api.provider.databases.size,0);
  assert.equal((await api.row()).database_id,null);
});
