import {DurableObject} from 'cloudflare:workers';
import {getApp,requireMaintainer,requireActiveMaintainer} from './access.js';
import {OperationError} from './identity-errors.js';
import {CloudflareProvider} from './provider.js';
import {canonicalJson} from '../../shared/app-contract.js';
import {decodeAsset,gatewayMetadata,sha256} from '../../shared/artifact.js';
import {planMigrationHistory} from '../../shared/migration-contract.js';
import {backupView,connectedApps,getBackup,restorePlan,snapshotDigest,storeSnapshot,databaseHistory,storedHistory} from './recovery.js';
import gatewaySource from 'atrax:gateway-source';

const fenceDDL='CREATE TABLE IF NOT EXISTS __atrax_deployment_fence(id INTEGER PRIMARY KEY CHECK(id=1),generation TEXT NOT NULL)';
const fenceGuard={sql:'INSERT INTO __atrax_deployment_fence(id,generation) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET generation=CASE WHEN generation=excluded.generation THEN generation ELSE NULL END'};
const ledgerDDL='CREATE TABLE IF NOT EXISTS __atrax_migrations(name TEXT PRIMARY KEY,hash TEXT NOT NULL,deployment_id TEXT NOT NULL,applied_at INTEGER NOT NULL)';
function view(job) {
  if(job.kind==='backup') return backupView(job);
  return {id:job.id,kind:job.kind ?? 'deploy',mode:job.mode ?? 'live',backupId:job.backupId ?? null,databaseId:job.databaseId ?? null,retainedDatabaseIds:job.retainedDatabaseIds ?? [],plan:job.plan ?? null,cancellation:job.cancellation?{startedAt:job.cancellation.startedAt,completedAt:job.cancellation.completedAt ?? null,appliedMigrations:job.cancellation.appliedMigrations ?? null}:null,closedAt:job.closedAt ?? null,requestHash:job.requestHash,appId:job.appId,releaseId:job.releaseId,status:job.status,phase:job.phase,url:job.mode==='preview'?job.candidateUrl:job.url,candidateUrl:job.candidateUrl,error:job.error ?? null,createdAt:job.createdAt,updatedAt:job.updatedAt,retryAfterMs:1000};
}
function cleanupEligible(job) {return job.kind!=='backup'&&(job.status==='cancelled'||job.status==='succeeded'&&(job.mode!=='preview'||job.closedAt));}
function cleanupFinished(cleanup) {return ['complete','retained'].includes(cleanup.phase);}
function cleanupView(cleanup) {return cleanup?{status:cleanupFinished(cleanup)?cleanup.phase:'pending',phase:cleanup.phase,attempts:cleanup.attempts,error:cleanup.error ?? null,retained:cleanup.retained ?? null,nextAttemptAt:cleanup.nextAttemptAt,completedAt:cleanup.completedAt ?? null}:null;}
async function loadArtifact(env,job) {
  const object=await env.ARTIFACTS.get(job.artifactKey);
  if(!object) throw new Error('Stored release artifact is missing');
  return object.json();
}
function binding(name,text) {return {type:'plain_text',name,text};}
function gatewayBindings(env,job,artifact,{candidate}) {
  const bindings=[binding('APP_ID',job.appId),binding('RELEASE_ID',job.releaseId),binding('WORKSPACE_ID',job.workspaceId),binding('CONFIG_KEY',`config/${artifact.hash}.json`),binding('CONSOLE_ORIGIN',env.CONSOLE_ORIGIN),
    {type:'r2_bucket',name:'ARTIFACTS',bucket_name:env.ARTIFACT_BUCKET},
    {type:'service',name:'DOOR',service:env.CONTROL_PLANE_NAME,entrypoint:'Door'},
  ];
  if(!candidate&&job.mode!=='preview') bindings.push(
    {type:'service',name:'LIBRARY',service:env.CONTROL_PLANE_NAME,entrypoint:'Library'},
    {type:'service',name:'SECRETS',service:env.CONTROL_PLANE_NAME,entrypoint:'Secrets'},
  );
  if(artifact.runtime) bindings.push({type:'service',name:'RUNTIME',service:candidate ? job.candidateRuntime : job.runtimeName,entrypoint:'AppRuntime'});
  if(!candidate&&job.mode!=='preview') for(const [alias,target] of Object.entries(job.dependencies)) bindings.push({type:'service',name:`DEP_${alias.replaceAll('-','_').toUpperCase()}`,service:target.gateway,entrypoint:'TargetGateway'});
  return bindings;
}
async function migrate(provider,databaseId,migrations,deploymentId) {
  const [applied]=await provider.queryDatabase(databaseId,[{sql:'SELECT name,hash FROM __atrax_migrations ORDER BY name'}]);
  const rows=applied.results ?? [];
  for(const row of rows) {
    const migration=migrations.find(item=>item.name===row.name);
    if(!migration||migration.hash!==row.hash) throw new Error(`Applied migration changed or disappeared: ${row.name}`);
  }
  for(const migration of migrations) {
    if(rows.some(row=>row.name===migration.name)) continue;
    await provider.queryDatabase(databaseId,[{...fenceGuard,params:[deploymentId]},...migration.statements.map(sql=>({sql})),{sql:'INSERT INTO __atrax_migrations(name,hash,deployment_id,applied_at) VALUES(?,?,?,?)',params:[migration.name,migration.hash,deploymentId,Date.now()]}]);
  }
}
/** One coordinator per app; its durable job is the owner of provider mutations. */
export class DeploymentCoordinator extends DurableObject {
  #cancelTasks=new Map();
  async #mirror(job) {
    if(job.kind==='backup') {await this.env.CP_DB.prepare('UPDATE app_backups SET status=?,state_json=?,updated_at=? WHERE backup_id=? AND updated_at<=?').bind(job.status,JSON.stringify(view(job)),job.updatedAt,job.id,job.updatedAt).run();return;}
    const cleanup=cleanupView(await this.ctx.storage.get(`cleanup:${job.id}`));
    await this.env.CP_DB.prepare('UPDATE deployments SET status=?,phase=?,state_json=?,updated_at=? WHERE deployment_id=? AND updated_at<=?').bind(job.status,job.phase,JSON.stringify({...view(job),cleanup}),job.updatedAt,job.id,job.updatedAt).run();
  }
  async #save(job) {
    job.updatedAt=Math.max(Date.now(),job.updatedAt+1);
    // A terminal durable state releases app ownership. Finish its CP record
    // before exposing that state to another deployment.
    await this.#mirror(job);
    await this.ctx.storage.transaction(async txn=>{
      await txn.put(`job:${job.id}`,job);
      if(cleanupEligible(job)&&!await txn.get(`cleanup:${job.id}`)) {
        await txn.put(`cleanup:${job.id}`,{id:job.id,phase:'domain',attempts:0,nextAttemptAt:Date.now()});
        await txn.setAlarm(Date.now()+1);
      }
    });
  }
  async #candidateEffect(job,resource,operation) {
    job.candidateEffects ??={};
    const previous=job.candidateEffects[resource];
    job.candidateEffects[resource]=['pending','retained'].includes(previous)?'retained':'pending';
    await this.#save(job);
    let result;
    try {result=await operation();}
    catch(error) {
      // A definite provider rejection leaves no unacknowledged mutation from
      // this attempt. It cannot settle an earlier interrupted attempt.
      if(error.uncertain===false&&job.candidateEffects[resource]==='pending') job.candidateEffects[resource]='confirmed';
      throw error;
    }
    if(job.candidateEffects[resource]==='pending') job.candidateEffects[resource]='confirmed';
    return result;
  }
  async #migrate(job,provider,databaseId,migrations) {
    await provider.queryDatabase(databaseId,[{sql:ledgerDDL},{sql:fenceDDL}]);
    job.migrationFences ??={};
    if(!Object.hasOwn(job.migrationFences,databaseId)) {
      const [current]=await provider.queryDatabase(databaseId,[{sql:'SELECT generation FROM __atrax_deployment_fence WHERE id=1'}]);
      job.migrationFences[databaseId]=current.results?.[0]?.generation ?? null;
      await this.#save(job);
    }
    // CAS claims cannot arrive late and overwrite a newer generation.
    await provider.queryDatabase(databaseId,[
      {sql:'INSERT INTO __atrax_deployment_fence(id,generation) VALUES(1,?) ON CONFLICT DO NOTHING',params:[job.id]},
      {sql:'UPDATE __atrax_deployment_fence SET generation=? WHERE id=1 AND generation=?',params:[job.id,job.migrationFences[databaseId]]},
      {...fenceGuard,params:[job.id]},
    ]);
    await migrate(provider,databaseId,migrations,job.id);
  }
  async start(job) {
    const outcome=await this.ctx.storage.transaction(async txn=>{
      const existing=await txn.get(`job:${job.id}`);
      if(existing) return {job:existing};
      const activeId=await txn.get('active');
      const active=activeId ? await txn.get(`job:${activeId}`) : null;
      // A timed-out publication still owns this app until it is reconciled.
      if(active&&!['succeeded','cancelled'].includes(active.status)) return {conflict:active.id};
      await txn.put(`job:${job.id}`,job);await txn.put('active',job.id);
      await txn.setAlarm(Date.now()+1);
      return {job};
    });
    return outcome.conflict ? {ok:false,error:{code:'deployment_in_progress',status:409,message:'Another deployment is in progress',details:{deploymentId:outcome.conflict}}} : {ok:true,deployment:view(outcome.job)};
  }
  async get(id) {const job=await this.ctx.storage.get(`job:${id}`);return job ? {...view(job),cleanup:cleanupView(await this.ctx.storage.get(`cleanup:${id}`))} : null;}
  async deletePreview(id,sessionId) {
    let job=await this.ctx.storage.get(`job:${id}`);if(!job) return null;
    try {
      const app=await getApp(this.env,job.appId);await requireActiveMaintainer(this.env,app,sessionId);
      if(job.mode!=='preview'||!['succeeded','cancelled'].includes(job.status)) throw new OperationError('preview_not_complete',409,'Only completed previews can be deleted; cancel an unfinished preview first');
      // Revocation precedes cleanup. A delayed or failed provider deletion must
      // never keep a preview authorized after its owner has closed it.
      await this.env.CP_DB.prepare("UPDATE app_hosts SET active=0 WHERE hostname=? AND app_id=? AND kind!='live'").bind(new URL(job.candidateUrl).hostname,job.appId).run();
      job.closedAt ??=Date.now();await this.#save(job);
      return {ok:true,deployment:await this.get(id)};
    } catch(error) {return coordinatorFailure(error);}
  }
  async #cleanupCandidate(cleanup) {
    const job=await this.ctx.storage.get(`job:${cleanup.id}`);
    if(!job||!cleanupEligible(job)) throw new OperationError('cleanup_not_terminal',409,'Candidate still belongs to an active deployment or preview');
    const provider=new CloudflareProvider(this.env),app=await getApp(this.env,job.appId);
    const gateway=await provider.inspectWorker(app.gateway_name);
    const liveRuntimeName=gateway?.bindings.find(binding=>binding.name==='RUNTIME')?.service;
    if(app.gateway_name===job.candidateGateway||liveRuntimeName===job.candidateRuntime) throw new OperationError('cleanup_live_reference',409,'Candidate is referenced by the live gateway');
    const host=await this.env.CP_DB.prepare('SELECT active FROM app_hosts WHERE hostname=?').bind(new URL(job.candidateUrl).hostname).first();
    if(host?.active) throw new OperationError('cleanup_host_active',409,'Candidate host is still authorized');
    const unconfirmed=resource=>!job.candidateEffects||['pending','retained'].includes(job.candidateEffects[resource]);
    const retain=reason=>{
      const phase=cleanup.phase;
      cleanup.phase='retained';cleanup.completedAt=Date.now();
      cleanup.retained={reason,...(phase==='domain'?{hostname:new URL(job.candidateUrl).hostname,gateway:job.candidateGateway}:{}),...(phase!=='database'?{runtime:job.candidateRuntime}:{}),databaseId:job.candidateDatabaseId ?? null,databaseName:job.backupId?`restore-${job.id.replaceAll('-','')}-${job.importAttempt ?? 0}`:`check-${job.id.replaceAll('-','')}`};
    };
    if(cleanup.phase==='domain') {
      if(unconfirmed('gateway')) {retain('unresolved_gateway_publication');return;}
      await provider.deleteCandidateDomain({hostname:new URL(job.candidateUrl).hostname,service:job.candidateGateway});cleanup.phase='gateway';
    } else if(cleanup.phase==='gateway') {
      await provider.deleteCandidateWorker({name:job.candidateGateway,releaseId:job.releaseId});cleanup.phase='runtime';
    } else if(cleanup.phase==='runtime') {
      if(unconfirmed('runtime')) {
        // A delayed PUT could recreate a deleted Worker with public defaults.
        // Keep the private Worker and its data when upload completion was not
        // durably proven; elapsed time is not a provider cancellation fence.
        retain('unresolved_runtime_upload');return;
      }
      await provider.deleteCandidateWorker({name:job.candidateRuntime,releaseId:job.releaseId});cleanup.phase='database';
    } else if(cleanup.phase==='database') {
      if(unconfirmed('database')) {retain('unresolved_database_creation');return;}
      // Restores promote their candidate database into business storage; all
      // restore attempts (including uncertain imports) remain retained.
      const name=job.backupId?`restore-${job.id.replaceAll('-','')}-${job.importAttempt ?? 0}`:`check-${job.id.replaceAll('-','')}`;
      const database=job.kind==='restore'?null:await provider.inspectCandidateDatabase(name);
      const id=database?.id;
      if(id) {
        if(job.candidateDatabaseId&&job.candidateDatabaseId!==id) throw new OperationError('cleanup_database_identity',409,'Candidate database identity changed');
        const reference=await this.env.CP_DB.prepare('SELECT app_id FROM apps WHERE database_id=? UNION ALL SELECT app_id FROM database_forks WHERE database_id=? OR original_database_id=? UNION ALL SELECT app_id FROM app_backups WHERE database_id=? LIMIT 1').bind(id,id,id,id).first();
        const runtime=liveRuntimeName?await provider.inspectWorker(liveRuntimeName):null;
        if(reference||runtime?.bindings.some(binding=>binding.type==='d1'&&binding.id===id)||job.mode!=='preview'&&job.databaseId===id) throw new OperationError('cleanup_business_database',409,'Candidate database is retained as business storage');
        await provider.deleteCandidateDatabase({id,name});
      }
      cleanup.phase='complete';cleanup.completedAt=Date.now();
    } else throw new Error('Unknown cleanup phase');
  }
  async #runCleanup() {
    const entries=await this.ctx.storage.list({prefix:'cleanup:'});
    const cleanup=[...entries.values()].filter(value=>!cleanupFinished(value)&&value.nextAttemptAt<=Date.now()).sort((a,b)=>a.nextAttemptAt-b.nextAttemptAt)[0];
    if(!cleanup) return;
    try {await this.#cleanupCandidate(cleanup);cleanup.error=null;cleanup.nextAttemptAt=Date.now()+1;}
    catch(error) {cleanup.attempts++;cleanup.error={code:error.code ?? 'cleanup_failed',message:error.message};cleanup.nextAttemptAt=Date.now()+Math.min(60000,1000*2**Math.min(cleanup.attempts-1,6));}
    await this.ctx.storage.transaction(async txn=>{await txn.put(`cleanup:${cleanup.id}`,cleanup);await txn.setAlarm(cleanup.nextAttemptAt);});
    // Cleanup progress has its own durable record and never changes the
    // deployment result or the current app's active-job ownership.
    await this.env.CP_DB.prepare("UPDATE deployments SET state_json=json_set(state_json,'$.cleanup',json(?)) WHERE deployment_id=?").bind(JSON.stringify(cleanupView(cleanup)),cleanup.id).run();
  }
  async #scheduleAlarm() {
    await this.ctx.storage.transaction(async txn=>{
      const id=await txn.get('active'),job=id?await txn.get(`job:${id}`):null;
      const cleanup=await txn.list({prefix:'cleanup:'});
      const times=[...cleanup.values()].filter(value=>!cleanupFinished(value)).map(value=>value.nextAttemptAt);
      if(job&&!['awaiting_verification','succeeded','failed','cancelling','cancelled'].includes(job.status)) times.push(Date.now()+1);
      if(times.length) await txn.setAlarm(Math.max(Date.now()+1,Math.min(...times)));
    });
  }
  async #cancellationPlan(job) {
    const app=await getApp(this.env,job.appId),provider=new CloudflareProvider(this.env);
    const gateway=await provider.inspectWorker(app.gateway_name);
    const observedReleaseId=gateway?.bindings.find(binding=>binding.name==='RELEASE_ID')?.text ?? null;
    const runtimeName=gateway?.bindings.find(binding=>binding.name==='RUNTIME')?.service ?? null;
    const runtime=runtimeName?await provider.inspectWorker(runtimeName):null;
    const runtimeDatabaseId=runtime?.bindings.find(binding=>binding.name==='DB')?.id ?? null;
    const databaseId=job.kind==='restore'||job.mode==='preview'?app.database_id:job.databaseId ?? app.database_id;
    let reason=null;
    if(job.kind==='backup') reason='Use backup recovery operations for this job';
    else if(job.publicationAdmittedAt) reason='Publication was admitted. Resume it to reconcile the provider and record the result before creating another deployment.';
    else if(!['failed','awaiting_verification','cancelling','cancelled'].includes(job.status)) reason='Wait for this running job to stop before cancelling it';
    else if((await this.ctx.storage.get('active'))!==job.id&&job.status!=='cancelled') reason='A newer deployment owns this app';
    else if(app.active_release_id!==job.expectedReleaseId||observedReleaseId!==app.active_release_id) reason='The observed gateway and recorded live release disagree; cancellation cannot assume publication is absent';
    else if(runtimeName&&(!runtime||runtime.workersDev||runtime.previewsEnabled||!runtime.tags.includes(`atrax-release:${app.active_release_id}`)||runtimeDatabaseId&&runtimeDatabaseId!==app.database_id)) reason='The observed live runtime does not match the recorded private runtime and database';
    const history=await databaseHistory(this.env,provider,job.appId,databaseId);
    const identity={deploymentId:job.id,expectedReleaseId:app.active_release_id,databaseId,observedGatewayVersionId:gateway?.versionId ?? null};
    return {...identity,canCancel:!reason&&job.status!=='cancelled',reason,observedReleaseId,observedRuntimeName:runtimeName,appliedMigrations:history.map(({name,hash})=>({name,hash})),retainsBusinessData:true,retainsAppliedSchema:true,planHash:await sha256(canonicalJson(identity))};
  }
  async cancellationPlan(id) {
    const job=await this.ctx.storage.get(`job:${id}`);if(!job) return null;
    try {
      const plan=await this.#cancellationPlan(job);
      await this.ctx.storage.transaction(async txn=>{
        const latest=await txn.get(`job:${id}`);
        if(latest.updatedAt!==job.updatedAt||latest.status!==job.status||latest.publicationAdmittedAt!==job.publicationAdmittedAt) throw new OperationError('cancellation_plan_changed',409,'The deployment changed while inspecting it');
        latest.cancelInspection={planHash:plan.planHash};await txn.put(`job:${id}`,latest);
      });
      return {ok:true,plan};
    } catch(error) {return coordinatorFailure(error);}
  }
  async cancel(id,planHash,sessionId) {
    const running=this.#cancelTasks.get(id);
    if(running) return running.planHash===planHash?running.promise:coordinatorFailure(new OperationError('cancellation_in_progress',409,'Another cancellation request is in progress'));
    const promise=this.#cancel(id,planHash,sessionId);this.#cancelTasks.set(id,{planHash,promise});
    try {return await promise;} finally {this.#cancelTasks.delete(id);}
  }
  async #cancel(id,planHash,sessionId) {
    let job=await this.ctx.storage.get(`job:${id}`);if(!job) return null;
    try {
      const app=await getApp(this.env,job.appId);await requireActiveMaintainer(this.env,app,sessionId);
      if(job.cancellation?.completedAt) {
        if(job.cancellation.planHash!==planHash) throw new OperationError('cancellation_plan_changed',409,'This job was cancelled with a different plan');
        job.status='cancelled';await this.#save(job);return {ok:true,deployment:view(job)};
      }
      // Reserve cancellation atomically before network inspection. Resume and
      // verification cannot start while this job is being fenced.
      job=await this.ctx.storage.transaction(async txn=>{
        const current=await txn.get(`job:${id}`);
        if(current.publicationAdmittedAt||!['failed','awaiting_verification','cancelling'].includes(current.status)||(await txn.get('active'))!==id) throw new OperationError('cancellation_not_safe',409,'Publication was admitted or this job is running; inspect its recovery plan');
        if(current.cancelInspection?.planHash!==planHash) throw new OperationError('cancellation_plan_changed',409,'Inspect a fresh cancellation plan before continuing');
        current.cancellation ??={token:`cancel-${id}`,startedAt:Date.now()};current.cancellation.planHash=planHash;
        current.status='cancelling';current.sessionId=sessionId;await txn.put(`job:${id}`,current);return current;
      });
      const plan=await this.#cancellationPlan(job);
      if(!plan.canCancel) throw new OperationError('cancellation_not_safe',409,plan.reason,{plan});
      if(plan.planHash!==planHash) throw new OperationError('cancellation_plan_changed',409,'Inspect a fresh cancellation plan before continuing',{plan});
      await this.#save(job);
      const provider=new CloudflareProvider(this.env);
      if(plan.databaseId&&Object.hasOwn(job.migrationFences ?? {},plan.databaseId)) {
        await provider.queryDatabase(plan.databaseId,[{sql:fenceDDL}]);
        const allowed=[...new Set([job.migrationFences[plan.databaseId],job.id,job.cancellation.token].filter(Boolean))];
        const fenced=await provider.queryDatabase(plan.databaseId,[
          {sql:'INSERT INTO __atrax_deployment_fence(id,generation) VALUES(1,?) ON CONFLICT DO NOTHING',params:[job.cancellation.token]},
          {sql:`UPDATE __atrax_deployment_fence SET generation=? WHERE id=1 AND generation IN (${allowed.map(()=>'?').join(',')})`,params:[job.cancellation.token,...allowed]},
          {sql:'SELECT generation FROM __atrax_deployment_fence WHERE id=1'},
        ]);
        if(fenced[2].results?.[0]?.generation!==job.cancellation.token) throw new OperationError('migration_fence_changed',409,'Another migration generation owns this database');
      }
      // The fence is serialized after any already executing batch; late old
      // batches fail their guard. This ledger is now stable for handoff.
      const history=await databaseHistory(this.env,provider,job.appId,plan.databaseId);
      job.cancellation.appliedMigrations=history.map(({name,hash})=>({name,hash}));
      job.retainedDatabaseIds=[...new Set([...(job.retainedDatabaseIds ?? []),job.databaseId,job.kind==='restore'?job.candidateDatabaseId:null,plan.databaseId].filter(Boolean))];
      await this.env.CP_DB.batch([
        ...(plan.databaseId&&!app.database_id&&job.kind!=='restore'&&job.mode!=='preview'?[this.env.CP_DB.prepare('UPDATE apps SET database_id=? WHERE app_id=? AND database_id IS NULL').bind(plan.databaseId,job.appId)]:[]),
        this.env.CP_DB.prepare("UPDATE app_hosts SET active=0 WHERE hostname=? AND kind!='live'").bind(new URL(job.candidateUrl).hostname),
      ]);
      job.cancellation.completedAt=Date.now();job.status='cancelled';job.phase='cancelled';job.error=null;
      await this.#save(job);return {ok:true,deployment:view(job)};
    } catch(error) {
      if(job.cancellation&&!job.cancellation.completedAt) {job.status='failed';job.error={code:error.code ?? 'cancellation_failed',message:error.message,retryable:true,uncertain:error.uncertain ?? false};await this.#save(job);}
      return coordinatorFailure(error);
    }
  }
  async resume(id,sessionId) {
    const snapshot=await this.ctx.storage.get(`job:${id}`);if(!snapshot) return null;
    const restartBackup=snapshot.status==='failed'&&snapshot.kind==='backup'&&['export','capture'].includes(snapshot.phase)&&!await this.env.ARTIFACTS.head(snapshot.snapshotKey);
    const outcome=await this.ctx.storage.transaction(async txn=>{
      const job=await txn.get(`job:${id}`);
      if(job.cancellation||job.status==='cancelled') return {ok:false,error:{code:'deployment_cancelled',status:409,message:'This deployment is cancelled or cancellation is in progress; create a corrected deployment'}};
      if((await txn.get('active'))!==id) return {ok:false,error:{code:'deployment_superseded',status:409,message:'A newer deployment owns this app'}};
      if(job.status==='failed') {
        if(restartBackup) {job.phase='export';delete job.exportBookmark;delete job.exportUrl;delete job.snapshotCreatedAt;}
        job.sessionId=sessionId;job.status=job.phase==='complete'?'succeeded':job.phase==='candidate_check'?'awaiting_verification':'preparing';job.error=null;
        job.updatedAt=Math.max(Date.now(),job.updatedAt+1);await txn.put(`job:${id}`,job);
      }
      if(!['awaiting_verification','succeeded'].includes(job.status)) await txn.setAlarm(Date.now()+1);
      return {ok:true,job};
    });
    if(!outcome.ok) return outcome;
    await this.#mirror(outcome.job);return {ok:true,deployment:view(outcome.job)};
  }
  async verify(id,proof,sessionId) {
    const outcome=await this.ctx.storage.transaction(async txn=>{
      const job=await txn.get(`job:${id}`);if(!job) return null;
      if(job.status==='succeeded') return {ok:true,job};
      if(job.cancellation||job.status!=='awaiting_verification'||(await txn.get('active'))!==id) return {ok:false,error:{code:'deployment_not_ready',status:409,message:'This deployment is not ready for verification'}};
      if(proof.releaseId!==job.releaseId||proof.descriptorHash!==job.descriptorHash) return {ok:false,error:{code:'candidate_mismatch',status:409,message:'Candidate does not match the release'}};
      job.proof={...proof,verifiedAt:Date.now()};job.sessionId=sessionId;job.status=job.mode==='preview'?'succeeded':'promoting';job.phase=job.mode==='preview'?'complete':'live_database';
      job.updatedAt=Math.max(Date.now(),job.updatedAt+1);await txn.put(`job:${id}`,job);
      if(job.status!=='succeeded') await txn.setAlarm(Date.now()+1);
      return {ok:true,job};
    });
    if(!outcome?.ok) return outcome;
    await this.#mirror(outcome.job);return {ok:true,deployment:view(outcome.job)};
  }
  async alarm() {
    await this.#advanceDeployment();
    await this.#runCleanup();
    await this.#scheduleAlarm();
  }
  async #advanceDeployment() {
    const id=await this.ctx.storage.get('active');
    const job=id ? await this.ctx.storage.get(`job:${id}`) : null;
    if(!job||['awaiting_verification','succeeded','failed','cancelling','cancelled'].includes(job.status)) return;
    try {
      const provider=new CloudflareProvider(this.env);
      const artifact=job.kind==='backup'?null:await loadArtifact(this.env,job);
      const app=await getApp(this.env,job.appId);
      if(job.mode!=='preview'&&app.active_release_id!==job.expectedReleaseId&&!(job.publicationAdmittedAt&&app.active_release_id===job.releaseId)) throw new Error('The live release changed while this deployment was pending');
      // After a publication has been admitted, observation must finish even if
      // the originating session ends. Before that, revocation stops promotion.
      if(job.kind==='backup'&&app.database_id!==job.databaseId) throw new OperationError('database_conflict',409,'The live database changed before this backup completed');
      if(job.kind==='restore'&&!job.publicationAdmittedAt&&app.database_id!==job.originalDatabaseId) throw new OperationError('database_conflict',409,'The live database changed');
      if(!job.publicationAdmittedAt) await requireActiveMaintainer(this.env,app,job.sessionId);
      if(job.kind==='backup') {
        if(job.phase==='export') {
          if(!job.snapshotCreatedAt) {job.migrationKey=`backups/${job.appId}/${job.id}.migrations.json`;await this.env.ARTIFACTS.put(job.migrationKey,JSON.stringify(await databaseHistory(this.env,provider,job.appId,job.databaseId)));job.snapshotCreatedAt=Date.now();await this.#save(job);}
          const exported=await provider.exportDatabase(job.databaseId,job.exportBookmark);
          job.exportBookmark=exported.bookmark;
          if(exported.complete) {job.exportUrl=exported.url;job.phase='capture';}
        } else if(job.phase==='capture') {
          let stored=await this.env.ARTIFACTS.get(job.snapshotKey);
          if(!stored) {
            const response=await provider.transferSnapshot(job.exportUrl);
            await storeSnapshot(this.env.ARTIFACTS,job.snapshotKey,response.body,{bookmark:job.exportBookmark,createdAt:String(job.snapshotCreatedAt)});
            stored=await this.env.ARTIFACTS.get(job.snapshotKey);
          }
          if(!stored) throw new Error('Snapshot storage did not complete');
          const digest=await snapshotDigest(stored);
          job.snapshotSize=digest.size;job.snapshotMd5=digest.md5;job.snapshotHash=digest.hash;job.snapshotCompletedAt=Date.now();
          job.status='succeeded';job.phase='complete';delete job.exportUrl;
        } else throw new Error('Unknown backup phase');
      } else if(job.phase==='assets') {
        const entries=Object.values(artifact.assets);
        const end=Math.min((job.assetIndex ?? 0)+25,entries.length);
        for(let i=job.assetIndex ?? 0;i<end;i++) {const asset=entries[i];await this.env.ARTIFACTS.put(`assets/${artifact.hash}/${asset.hash}`,decodeAsset(asset),{httpMetadata:{contentType:asset.contentType}});}
        job.assetIndex=end;
        if(end===entries.length) {await this.env.ARTIFACTS.put(`config/${artifact.hash}.json`,JSON.stringify(gatewayMetadata(artifact)));job.phase=job.backupId?'restore_database':'candidate_database';}
      } else if(job.phase==='restore_database') {
        // An uncertain ingest is never replayed against a possibly populated DB.
        // A fresh unpublished attempt leaves the uncertain database retained.
        if(job.importSubmitted&&!job.importBookmark&&!job.importComplete) {
          job.retainedDatabaseIds=[...new Set([...(job.retainedDatabaseIds ?? []),job.candidateDatabaseId])];
          job.importAttempt=(job.importAttempt ?? 0)+1;delete job.candidateDatabaseId;delete job.importUpload;job.importSubmitted=false;
          await this.#save(job);
        }
        job.candidateDatabaseId=(await this.#candidateEffect(job,'database',()=>provider.ensureDatabase(`restore-${job.id.replaceAll('-','')}-${job.importAttempt ?? 0}`))).id;
        if(job.importBookmark) {
          const imported=await provider.importDatabase(job.candidateDatabaseId,{action:'poll',current_bookmark:job.importBookmark});
          job.importBookmark=imported.bookmark;job.importComplete=imported.complete;
        } else if(!job.importComplete) {
          const backup=await getBackup(this.env,job.appId,job.backupId);
          const upload=await provider.importDatabase(job.candidateDatabaseId,{action:'init',etag:backup.md5});
          if(upload.url) {
            const snapshot=await this.env.ARTIFACTS.get(backup.objectKey);
            if(!snapshot) throw new Error('Snapshot contents are missing');
            await provider.transferSnapshot(upload.url,{body:snapshot.body,etag:backup.md5});
          }
          job.importSubmitted=true;await this.#save(job);
          const imported=await provider.importDatabase(job.candidateDatabaseId,{action:'ingest',etag:backup.md5,filename:upload.filename});
          job.importBookmark=imported.bookmark;job.importComplete=imported.complete;
        }
        if(job.importComplete) {await this.#migrate(job,provider,job.candidateDatabaseId,await storedHistory(this.env,job.migrationKey));if(job.mode==='preview') job.databaseId=job.candidateDatabaseId;job.phase='candidate_runtime';}
      } else if(job.phase==='candidate_database') {
        if(artifact.manifest.tables) {
          job.candidateDatabaseId=(await this.#candidateEffect(job,'database',()=>provider.ensureDatabase(`check-${job.id.replaceAll('-','')}`))).id;
          await this.#migrate(job,provider,job.candidateDatabaseId,artifact.migrations);
          if(job.mode==='preview') job.databaseId=job.candidateDatabaseId;
        }
        job.phase='candidate_runtime';
      } else if(job.phase==='candidate_runtime') {
        if(artifact.runtime) {
          job.candidateRuntimeVersion=(await this.#candidateEffect(job,'runtime',()=>provider.ensurePrivateRuntime({name:job.candidateRuntime,source:artifact.runtime,databaseId:job.candidateDatabaseId,releaseId:job.releaseId}))).versionId;
        }
        job.phase='candidate_gateway';
      } else if(job.phase==='candidate_gateway') {
        job.candidateGatewayVersion=await this.#candidateEffect(job,'gateway',async()=>{
          const gateway=await provider.uploadGateway({name:job.candidateGateway,source:gatewaySource,bindings:gatewayBindings(this.env,job,artifact,{candidate:true}),releaseId:job.releaseId});
          await provider.attachDomain({hostname:new URL(job.candidateUrl).hostname,service:job.candidateGateway});return gateway.versionId;
        });
        await this.env.CP_DB.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind,active) VALUES(?,?,?,?,1) ON CONFLICT(hostname) DO UPDATE SET active=1").bind(new URL(job.candidateUrl).hostname,job.appId,job.releaseId,job.mode==='preview'?'preview':'candidate').run();
        job.descriptorHash=await sha256(canonicalJson(artifact.actions));job.status='awaiting_verification';job.phase='candidate_check';
      } else if(job.phase==='live_database') {
        if(job.kind==='restore') job.databaseId=job.candidateDatabaseId;
        if(artifact.manifest.tables) {
          job.databaseId=job.kind==='restore'?job.candidateDatabaseId:app.database_id ?? (await provider.ensureDatabase(`data-${job.appId.replaceAll('-','')}`)).id;
          await this.#save(job);
          if(job.kind!=='restore') await this.env.CP_DB.prepare('UPDATE apps SET database_id=? WHERE app_id=?').bind(job.databaseId,job.appId).run();
          await this.#migrate(job,provider,job.databaseId,await storedHistory(this.env,job.migrationKey));
          if(job.kind!=='restore') await this.env.CP_DB.prepare('UPDATE apps SET schema_release_id=? WHERE app_id=?').bind(job.schemaReleaseId,job.appId).run();
        }
        job.phase='live_runtime';
      } else if(job.phase==='live_runtime') {
        job.runtimeName=`runtime-${job.appId.replaceAll('-','').slice(0,24)}-${(await sha256(`${job.releaseId}:${job.databaseId ?? 'none'}`)).slice(0,16)}`;
        if(artifact.runtime) job.runtimeVersion=(await provider.ensurePrivateRuntime({name:job.runtimeName,source:artifact.runtime,databaseId:job.databaseId,releaseId:job.releaseId})).versionId;
        job.phase='publishing';
      } else if(job.phase==='publishing') {
        if(!job.publicationAdmittedAt) {
          await validateActionAccess(this.env,app,artifact.actions,job.actionAccess);
          if(job.kind==='restore'&&canonicalJson(await connectedApps(this.env,app))!==canonicalJson(job.plan.connectedAppIds)) throw new OperationError('restore_impact_changed',409,'Connected apps changed; inspect a fresh restore plan');
          await requireActiveMaintainer(this.env,app,job.sessionId);
          job.publicationAdmittedAt=Date.now();await this.#save(job);
        }
        job.gatewayVersion=(await provider.uploadGateway({name:job.gatewayName,source:gatewaySource,bindings:gatewayBindings(this.env,job,artifact,{candidate:false}),releaseId:job.releaseId})).versionId;
        await provider.attachDomain({hostname:new URL(job.url).hostname,service:job.gatewayName});
        job.phase='recording';
      } else if(job.phase==='recording') {
        const observed=await provider.inspectWorker(job.gatewayName);
        const activeRelease=observed?.bindings.find(value=>value.name==='RELEASE_ID')?.text;
        if(activeRelease!==job.releaseId||(artifact.runtime&&observed.bindings.find(value=>value.name==='RUNTIME')?.service!==job.runtimeName)) throw new Error('Cloudflare has not activated the expected gateway release');
        const recorded=await this.env.CP_DB.prepare('SELECT recorded_at FROM deployments WHERE deployment_id=?').bind(job.id).first();
        if(!recorded?.recorded_at) await this.env.CP_DB.batch([
          ...initialPolicyStatements(this.env,job,artifact),
          ...(job.kind==='restore'?[this.env.CP_DB.prepare('INSERT INTO database_forks(deployment_id,app_id,original_database_id,database_id,backup_id,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(job.id,job.appId,job.originalDatabaseId,job.databaseId,job.backupId,Date.now())]:[]),
          this.env.CP_DB.prepare("UPDATE apps SET active_release_id=?,schema_release_id=?,database_id=?,status='ready',updated_at=? WHERE app_id=?").bind(job.releaseId,job.schemaReleaseId ?? job.releaseId,job.databaseId ?? app.database_id ?? null,Date.now(),job.appId),
          this.env.CP_DB.prepare("UPDATE app_hosts SET release_id=? WHERE app_id=? AND kind='live'").bind(job.releaseId,job.appId),
          this.env.CP_DB.prepare("UPDATE app_hosts SET active=0 WHERE hostname=? AND kind='candidate'").bind(new URL(job.candidateUrl).hostname),
          this.env.CP_DB.prepare('UPDATE deployments SET recorded_at=? WHERE deployment_id=?').bind(Date.now(),job.id),
        ]);
        job.status='succeeded';job.phase='complete';
      } else throw new Error('Unknown deployment phase');
      job.error=null;await this.#save(job);
    } catch(error) {
      job.error={code:error.code ?? 'deployment_failed',message:error.message,retryable:error.retryable ?? false,uncertain:error.uncertain ?? false};
      job.status='failed';await this.#save(job);
    }
  }
}
function coordinatorFailure(error) {return {ok:false,error:{code:error.code ?? 'recovery_failed',status:error.status || 500,message:error.message,details:error.details}};}
function unwrap(value) {
  if(!value) throw new OperationError('not_found',404,'Deployment not found');
  if(!value.ok) throw new OperationError(value.error.code,value.error.status,value.error.message,value.error.details);
  return {result:{deployment:value.deployment}};
}
export async function handleDeploymentOperation(name,input,{env,actor,request,idempotencyKey}) {
  if(!name.startsWith('deployments.')&&!['previews.create','previews.delete','data.restore.start'].includes(name)) return null;
  const app=await getApp(env,input.appId);await requireMaintainer(env,app,actor);
  if(!env.DEPLOYMENTS) throw new OperationError('hosting_unavailable',503,'Deployment coordination is not configured');
  const coordinator=env.DEPLOYMENTS.getByName(app.app_id);
  if(name==='previews.delete') return unwrap(await coordinator.deletePreview(input.deploymentId,actor.session.id));
  if(name==='deployments.cancel.plan') {const outcome=await coordinator.cancellationPlan(input.deploymentId);if(!outcome) throw new OperationError('not_found',404,'Deployment not found');if(!outcome.ok) throw new OperationError(outcome.error.code,outcome.error.status,outcome.error.message,outcome.error.details);return {result:{plan:outcome.plan}};}
  if(name==='deployments.cancel') return unwrap(await coordinator.cancel(input.deploymentId,input.planHash,actor.session.id));
  if(name==='deployments.get') {const deployment=await coordinator.get(input.deploymentId);if(!deployment) throw new OperationError('not_found',404,'Deployment not found');return {result:{deployment}};}
  if(name==='deployments.resume') return unwrap(await coordinator.resume(input.deploymentId,actor.session.id));
  if(name==='deployments.verify') {
    const deployment=await coordinator.get(input.deploymentId);
    if(!deployment) throw new OperationError('not_found',404,'Deployment not found');
    if(deployment.status==='succeeded') return {result:{deployment}};
    if(deployment.status!=='awaiting_verification') throw new OperationError('deployment_not_ready',409,'Candidate is not ready to check');
    const headers=new Headers();
    for(const key of ['authorization','cookie']) if(request.headers.has(key)) headers.set(key,request.headers.get(key));
    const response=await fetch(new URL('/__atrax/health',deployment.candidateUrl),{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
    if(!response.ok) {await response.body?.cancel();throw new OperationError('candidate_unavailable',502,'The private candidate is not ready yet. Retry verification.');}
    const proof=await response.json();
    if(proof.appId!==app.app_id) throw new OperationError('candidate_mismatch',409,'Candidate belongs to another app');
    await requireMaintainer(env,app,actor);
    return unwrap(await coordinator.verify(input.deploymentId,proof,actor.session.id));
  }
  if(!['deployments.start','deployments.plan','deployments.rollback','previews.create','data.restore.start'].includes(name)) return null;
  const preview=name==='previews.create',restore=name==='data.restore.start',rollback=name==='deployments.rollback';
  const requestHash=await sha256(canonicalJson({name,input}));
  let id;
  if(name!=='deployments.plan') {
    if(!idempotencyKey||idempotencyKey.length>200) throw new OperationError('idempotency_key_required',400,'Deployment needs an idempotency key');
    const hash=await sha256(`${name}:${app.app_id}:${actor.person.id}:${idempotencyKey}`);
    id=`${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
    const existing=await coordinator.get(id);
    if(existing) {if(existing.requestHash!==requestHash) throw new OperationError('idempotency_conflict',409,'Deployment key was used for different input');return {result:{deployment:existing}};}
  }
  const copiedBackup=preview&&input.data?await getBackup(env,app.app_id,input.data.backupId):null;
  if(copiedBackup&&(input.data.authorizeLiveDataCopy!==true||copiedBackup.status!=='succeeded')) throw new OperationError('preview_data_not_ready',409,'An authorized, completed backup is required for preview data');
  const recovery=restore?await restorePlan(env,app,input.backupId):null;
  if(restore&&(input.expectedReleaseId!==recovery.expectedReleaseId||input.confirmation?.snapshotCreatedAt!==recovery.snapshotCreatedAt||input.confirmation?.originalDatabaseId!==recovery.originalDatabaseId||input.confirmation?.retainOriginalDatabase!==true||canonicalJson([...(input.confirmation?.connectedAppIds ?? [])].sort())!==canonicalJson(recovery.connectedAppIds))) throw new OperationError('restore_confirmation_required',409,'Confirm the current snapshot, original database, live release, and connected-app impact from data.restore.plan');
  const release=await env.CP_DB.prepare('SELECT * FROM releases WHERE release_id=? AND app_id=?').bind(recovery?.releaseId ?? input.releaseId,app.app_id).first();
  if(!release) throw new OperationError('not_found',404,'Release not found');
  if(!preview&&app.active_release_id!==input.expectedReleaseId) throw new OperationError('release_conflict',409,'The live release changed. Inspect the app before deploying again.');
  if(rollback&&!await env.CP_DB.prepare("SELECT deployment_id FROM deployments WHERE app_id=? AND release_id=? AND mode='live' AND recorded_at IS NOT NULL LIMIT 1").bind(app.app_id,release.release_id).first()) throw new OperationError('rollback_target_invalid',409,'Code rollback requires a previously deployed release');
  const migrations=JSON.parse(release.migrations_json);
  const schemaId=copiedBackup?.schemaReleaseId ?? recovery?.schemaReleaseId ?? app.schema_release_id ?? app.active_release_id;
  const prior=copiedBackup||recovery?await storedHistory(env,copiedBackup?.migrationKey ?? recovery.migrationKey):preview?[]:await databaseHistory(env,new CloudflareProvider(env),app.app_id,app.database_id);
  let migrationPlan,blocked=null;
  try {migrationPlan=preview&&!copiedBackup?{apply:migrations,retain:[],history:migrations}:planMigrationHistory(prior,migrations,{online:!preview&&Boolean(app.active_release_id&&app.database_id),rollback:preview||restore||rollback||name==='deployments.plan'&&migrations.length<prior.length});}
  catch(error) {blocked=error.message;}
  const plan={appId:app.app_id,releaseId:release.release_id,expectedReleaseId:app.active_release_id,url:app.url,mode:preview?'preview':restore?'restore':rollback?'rollback':'deploy',database:restore?'new_from_snapshot':preview?(copiedBackup?'isolated_snapshot':'isolated_sample'):app.database_id?'retain':'create',apply:(migrationPlan?.apply ?? []).map(value=>({name:value.name,hash:value.hash})),retain:(migrationPlan?.retain ?? []).map(value=>({name:value.name,hash:value.hash})),connectedAppIds:await connectedApps(env,app),blocked,...(recovery ?? {})};
  if(name==='deployments.plan') return {result:{plan}};
  if(blocked) throw new OperationError('migration_plan_required',409,blocked,{plan});
  const dependencies={};
  if(!preview) for(const [alias,value] of Object.entries(JSON.parse(release.manifest_json).dependencies ?? {})) {
    const target=await getApp(env,value.appId);
    if(target.workspace_id!==app.workspace_id||target.status!=='ready') throw new OperationError('dependency_not_ready',409,`Dependency ${alias} is not deployed in this workspace`);
    dependencies[alias]={appId:target.app_id,gateway:target.gateway_name};
  }
  await validateActionAccess(env,app,JSON.parse(release.actions_json),input.actionAccess);
  const now=Date.now();
  const migrationKey=`deployment-plans/${id}.migrations.json`;
  await env.ARTIFACTS.put(migrationKey,JSON.stringify(migrationPlan.history));
  const job={id,requestHash,kind:restore?'restore':rollback?'rollback':'deploy',mode:preview?'preview':'live',backupId:copiedBackup?.id ?? input.backupId,originalDatabaseId:app.database_id,retainedDatabaseIds:restore?[app.database_id]:[],plan,migrationKey,schemaReleaseId:migrationPlan.retain.length?schemaId:release.release_id,actionAccess:input.actionAccess ?? {},appId:app.app_id,workspaceId:app.workspace_id,sessionId:actor.session.id,releaseId:release.release_id,expectedReleaseId:preview?app.active_release_id:input.expectedReleaseId,artifactKey:release.artifact_key,url:app.url,gatewayName:app.gateway_name,candidateEffects:{},candidateRuntime:`check-run-${id.replaceAll('-','')}`,candidateGateway:`check-web-${id.replaceAll('-','')}`,candidateUrl:`https://check-${id.replaceAll('-','')}.${env.APP_DOMAIN ?? 'atrax.run'}`,status:'preparing',phase:'assets',dependencies,createdAt:now,updatedAt:now};
  await env.CP_DB.prepare('INSERT INTO deployments(deployment_id,app_id,release_id,created_by,expected_release_id,mode,status,phase,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(id,app.app_id,release.release_id,actor.person.id,job.expectedReleaseId,job.mode,job.status,job.phase,JSON.stringify(view(job)),now,now).run();
  return unwrap(await coordinator.start(job));
}

async function validateActionAccess(env,app,actions,access={}) {
  if(!access||typeof access!=='object'||Array.isArray(access)) throw new OperationError('invalid_input',400,'actionAccess must map action names to an audience');
  for(const [name,policy] of Object.entries(access)) {
    if(!actions.some(action=>action.name===name)||!policy||!['workspace','selected'].includes(policy.audience)||Object.keys(policy).some(key=>!['audience','personIds','deniedPersonIds'].includes(key))) throw new OperationError('invalid_input',400,'Invalid initial action audience');
    if(await env.CP_DB.prepare('SELECT revision FROM action_policies WHERE app_id=? AND action_name=?').bind(app.app_id,name).first()) throw new OperationError('policy_revision_required',409,'Use action-access revision checks to change an existing policy');
    const selected=policy.personIds ?? [],denied=policy.deniedPersonIds ?? [];
    if(policy.audience==='workspace'&&selected.length) throw new OperationError('invalid_input',400,'Workspace audiences cannot list selected people');
    if(Array.isArray(selected)&&Array.isArray(denied)&&selected.some(id=>denied.includes(id))) throw new OperationError('invalid_input',400,'A person cannot be selected and denied for the same action');
    for(const ids of [selected,denied]) {
      if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length) throw new OperationError('invalid_input',400,'Action audiences need unique person IDs');
      const row=await env.CP_DB.prepare("SELECT count(*) count FROM workspace_members WHERE workspace_id=? AND status='active' AND person_id IN (SELECT value FROM json_each(?))").bind(app.workspace_id,JSON.stringify(ids)).first();
      if(row.count!==ids.length) throw new OperationError('invalid_input',400,'Action audiences must contain current workspace members');
    }
  }
}
function initialPolicyStatements(env,job,artifact) {
  const statements=[];
  for(const action of artifact.actions) {
    const policy=job.actionAccess?.[action.name];
    statements.push(env.CP_DB.prepare('INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(job.appId,action.name,policy?.audience ?? 'workspace'));
    if(policy) for(const [table,ids] of [['action_people',policy.personIds ?? []],['action_denials',policy.deniedPersonIds ?? []]]) statements.push(env.CP_DB.prepare(`INSERT INTO ${table}(app_id,action_name,person_id) SELECT ?,?,person_id FROM workspace_members WHERE workspace_id=? AND status='active' AND person_id IN (SELECT value FROM json_each(?)) ON CONFLICT DO NOTHING`).bind(job.appId,action.name,job.workspaceId,JSON.stringify(ids)));
  }
  return statements;
}
