import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {cp,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';
import {buildApp} from '../cli/build.mjs';
import {providerApi} from './helpers/provider-api.mjs';

async function platform(t,{template='static'}={}) {
  const directory=await mkdtemp(join(tmpdir(),'atrax-deploy-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await cp(new URL(`../templates/${template}/`,import.meta.url),join(directory,'app'),{recursive:true});
  // A generated template name is the only scaffolding substitution required here.
  const fs=await import('node:fs/promises');const manifestPath=join(directory,'app/atrax.json');
  await fs.writeFile(manifestPath,(await fs.readFile(manifestPath,'utf8')).replaceAll('__APP_NAME__','example'));
  const artifact=await buildApp(join(directory,'app'));
  const provider=providerApi();const tokens={owner:'1'.repeat(64),member:'2'.repeat(64)};
  const worker=localWorker('control-plane',await bundlePlatform('control-plane/src/index.js'),{
    CP_DB:{type:'d1',id:'cp'},ARTIFACTS:{type:'r2',name:'artifacts'},
    DEPLOYMENTS:{type:'durable-object',worker:'control-plane',exportName:'DeploymentCoordinator'},
    CF_API_TOKEN:{type:'json',value:'test-token'},CP_ACCOUNT_ID:{type:'json',value:'account'},CP_ZONE_ID:{type:'json',value:'zone'},
    APP_DOMAIN:{type:'json',value:'apps.atrax.test'},CONSOLE_ORIGIN:{type:'json',value:'https://console.atrax.test'},
    ARTIFACT_BUCKET:{type:'json',value:'artifacts'},CONTROL_PLANE_NAME:{type:'json',value:'control-plane'},
  });
  worker.config.exports={DeploymentCoordinator:{type:'durable-object',storage:'sqlite'}};
  let mf;
  worker.dev={outboundService:{type:'fetcher',handler:async request=>{
    if(new URL(request.url).hostname==='api.cloudflare.com') return provider.fetch(request);
    const domain=provider.domains.get(new URL(request.url).hostname);
    assert.ok(domain,'Health requests may only use the saved candidate domain');
    return (await mf.getWorker('candidate')).fetch(request);
  }}};
  const options={host:'127.0.0.1',port:0,resourcePersistencePath:join(directory,'state'),workers:[worker]};
  mf=new Miniflare(options);t.after(()=>mf.dispose());
  let db=await mf.getD1Database('CP_DB','control-plane');await migrateControlPlane(db);
  const now=Date.now();
  for(const [person,token] of Object.entries(tokens)) await db.batch([
    db.prepare('INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)').bind(person,`${person}@example.com`,now,now),
    db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,created_at,expires_at) VALUES(?,?,?,'cli',?,?)").bind(`${person}-session`,createHash('sha256').update(token).digest('hex'),person,now,now+3600000),
  ]);
  await db.batch([
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)").bind(now),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?)").bind(now,now),
  ]);
  async function call(name,input={},person='owner',key=crypto.randomUUID()) {
    const response=await mf.dispatchFetch(`https://api.atrax.test/v1/operations/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[person]}`,'Idempotency-Key':key},body:JSON.stringify(input)});
    const body=await response.json();return {status:response.status,body,result:body.result};
  }
  async function okay(...args) {const value=await call(...args);assert.equal(value.status,200,JSON.stringify(value.body));return value.result;}
  const {app}=await okay('apps.create',{workspaceId:'company',name:'Example',slug:'example'});
  const {release}=await okay('releases.upload',{appId:app.id,artifact});
  const gatewaySource=await bundlePlatform('gateway/src/index.js');
  const gatewayEnv={DOOR:{type:'worker',worker:'control-plane',exportName:'Door'},ARTIFACTS:{type:'r2',name:'artifacts'},
    APP_ID:{type:'json',value:app.id},WORKSPACE_ID:{type:'json',value:'company'},RELEASE_ID:{type:'json',value:release.id},CONFIG_KEY:{type:'json',value:`config/${artifact.hash}.json`},CONSOLE_ORIGIN:{type:'json',value:'https://console.atrax.test'}};
  const extra=[];
  if(artifact.runtime) {
    gatewayEnv.RUNTIME={type:'worker',worker:'runtime',exportName:'AppRuntime'};
    extra.push(localWorker('runtime',artifact.runtime,{DB:{type:'d1',id:'candidate-data'}}));
    worker.config.env.CANDIDATE_DB={type:'d1',id:'candidate-data'};worker.config.env.LIVE_DB={type:'d1',id:'live-data'};
  }
  await mf.setOptions({...options,workers:[worker,localWorker('candidate',gatewaySource,gatewayEnv),...extra]});
  db=await mf.getD1Database('CP_DB','control-plane');
  provider.database=async id=>{
    const database=[...provider.databases.values()].find(value=>value.uuid===id);assert.ok(database);
    return mf.getD1Database(database.name.startsWith('check-')?'CANDIDATE_DB':'LIVE_DB','control-plane');
  };
  async function wait(id,status,person='owner') {
    for(let attempt=0;attempt<500;attempt++) {
      const {deployment}=await okay('deployments.get',{appId:app.id,deploymentId:id},person);
      if(deployment.status===status) return deployment;
      assert.notEqual(deployment.status,'failed',JSON.stringify({deployment,providerCalls:provider.calls}));
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    assert.fail(`Deployment did not reach ${status}`);
  }
  return {mf,db,provider,tokens,app,release,artifact,call,okay,wait,gatewaySource};
}

test('a company member deploys a validated artifact through durable progress and a real private gateway check',async t=>{
  const api=await platform(t);
  const input={appId:api.app.id,releaseId:api.release.id,expectedReleaseId:null};
  assert.equal((await api.call('deployments.start',input,'member')).status,403);
  const {deployment}=await api.okay('deployments.start',input,'owner','first-deploy');
  assert.equal((await api.okay('deployments.start',input,'owner','first-deploy')).deployment.id,deployment.id);
  const waiting=await api.wait(deployment.id,'awaiting_verification');
  assert.equal((await api.call('deployments.start',input,'owner','other-deploy')).status,409);
  const candidate=(await api.mf.getWorker('candidate'));
  assert.equal((await candidate.fetch(waiting.candidateUrl,{headers:{Accept:'text/html',Authorization:`Bearer ${api.tokens.member}`}})).status,403);
  const health=await candidate.fetch(new URL('/__atrax/health',waiting.candidateUrl),{headers:{Authorization:`Bearer ${api.tokens.owner}`}});
  assert.equal(health.status,200);assert.equal((await health.json()).releaseId,api.release.id);
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});
  const complete=await api.wait(deployment.id,'succeeded');assert.equal(complete.url,api.app.url);
  const saved=(await api.okay('apps.get',{appId:api.app.id})).app;assert.equal(saved.activeReleaseId,api.release.id);
  assert.equal((await api.okay('deployments.start',input,'owner','first-deploy')).deployment.id,deployment.id,'A lost start response is recoverable after publication');
  assert.equal(api.provider.databases.size,0,'Static apps do not provision a database');
  const gateway=api.provider.workers.get((await api.db.prepare('SELECT gateway_name FROM apps WHERE app_id=?').bind(api.app.id).first()).gateway_name);
  assert.equal(gateway.source,api.gatewaySource,'Provider receives the same trusted gateway tested locally');
  const live=await candidate.fetch(api.app.url,{headers:{Authorization:`Bearer ${api.tokens.member}`}});assert.equal(live.status,200);
  assert.equal((await api.db.prepare("SELECT active FROM app_hosts WHERE kind='candidate'").first()).active,0);
});

test('a revoked creator cannot promote a checked candidate; a current maintainer can recover it',async t=>{
  const api=await platform(t);
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:api.release.id,expectedReleaseId:null},'owner','revoked');
  await api.wait(deployment.id,'awaiting_verification');
  await api.db.prepare("UPDATE sessions SET revoked_at=? WHERE session_id='owner-session'").bind(Date.now()).run();
  assert.equal((await api.call('deployments.verify',{appId:api.app.id,deploymentId:deployment.id})).status,401);
  assert.equal(api.provider.workers.size,1,'Only the isolated candidate exists');
  await api.db.prepare('INSERT INTO app_maintainers(app_id,person_id) VALUES(?,?)').bind(api.app.id,'member').run();
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id},'member');
  await api.wait(deployment.id,'succeeded','member');
});

test('stateful deployments provision isolated candidate and live databases with atomic migration ledgers',async t=>{
  const api=await platform(t,{template:'chat'});
  const {deployment}=await api.okay('deployments.start',{appId:api.app.id,releaseId:api.release.id,expectedReleaseId:null},'owner','stateful');
  await api.wait(deployment.id,'awaiting_verification');
  const candidateRuntime=[...api.provider.workers.values()].find(value=>value.metadata.tags.includes('atrax-kind:runtime'));
  assert.ok(candidateRuntime,'A private candidate exists before publication');
  const candidateDatabase=candidateRuntime.metadata.bindings.find(value=>value.name==='DB').id;
  const candidateDb=await api.mf.getD1Database('CANDIDATE_DB','control-plane');
  assert.equal((await candidateDb.prepare('SELECT COUNT(*) AS count FROM __atrax_migrations').first()).count,1);
  assert.equal((await candidateDb.prepare('SELECT COUNT(*) AS count FROM messages').first()).count,0);
  await api.okay('deployments.verify',{appId:api.app.id,deploymentId:deployment.id});
  await api.wait(deployment.id,'succeeded');
  const liveDatabase=(await api.db.prepare('SELECT database_id FROM apps WHERE app_id=?').bind(api.app.id).first()).database_id;
  assert.notEqual(candidateDatabase,liveDatabase);
  const db=await api.mf.getD1Database('LIVE_DB','control-plane');
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM __atrax_migrations').first()).count,1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM messages').first()).count,0);
  const liveRuntime=[...api.provider.workers.values()].find(value=>value.metadata.tags.includes('atrax-kind:runtime')&&value.metadata.bindings.some(binding=>binding.name==='DB'&&binding.id===liveDatabase));
  assert.ok(liveRuntime,'The live runtime owns the business database');
  const runtimes=[candidateRuntime,liveRuntime];
  assert.ok(runtimes.every(value=>value.enabled===false&&value.previews_enabled===false));
  const allowed=new Set(['DB']);assert.ok(runtimes.every(value=>value.metadata.bindings.every(binding=>allowed.has(binding.name))));
});
