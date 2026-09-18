import {writeFile} from 'node:fs/promises';
import {createSecretsPlatform} from './secrets-platform.mjs';

const cleanup=[];
const api=await createSecretsPlatform({after:task=>cleanup.push(task)},{consoleOrigin:'http://localhost:3082',host:'localhost',port:8792});
const initial=await api.okay('secrets.create',{name:'Signing service',description:'Used by the signer backend to sign messages.',value:'disposable-local-test-credential'});
await api.okay('secrets.setApps',{secretId:initial.secret.id,baseRevision:1,apps:[{appId:'signer',bindingName:'SIGNING_KEY'}]});
const now=Date.now();
const oldRelease='signer-release-old',nextRelease='signer-release-next';
const oldDeployment={id:'deploy-signer-old',kind:'deploy',mode:'live',appId:'signer',releaseId:oldRelease,status:'succeeded',phase:'complete',candidateUrl:'https://old-candidate.atrax.test',error:null,createdAt:now-7*86400000,updatedAt:now-7*86400000+42000};
const currentDeployment={id:'deploy-signer-current',kind:'deploy',mode:'live',appId:'signer',releaseId:'signer-release',status:'succeeded',phase:'complete',candidateUrl:'https://current-candidate.atrax.test',error:null,createdAt:now-2*86400000,updatedAt:now-2*86400000+51000};
const failedDeployment={id:'deploy-signer-next',kind:'deploy',mode:'live',appId:'signer',releaseId:nextRelease,status:'failed',phase:'candidate_check',candidateUrl:'https://next-candidate.atrax.test',error:{code:'candidate_unavailable',message:'Candidate health check did not respond.',retryable:true},createdAt:now-3600000,updatedAt:now-3540000};
const backup={id:'backup-signer-ready',kind:'backup',appId:'signer',releaseId:'signer-release',schemaReleaseId:'signer-release',migrationKey:'backups/signer/ready.migrations.json',databaseId:'db-signer',status:'succeeded',phase:'complete',snapshotCreatedAt:now-6*3600000,snapshotCompletedAt:now-6*3600000+18000,size:184320,sha256:'a'.repeat(64),md5:'b'.repeat(32),objectKey:'backups/signer/ready.sql',error:null,createdAt:now-6*3600000,updatedAt:now-6*3600000+18000};
await api.db.batch([
  api.db.prepare("UPDATE apps SET database_id='db-signer',schema_release_id='signer-release' WHERE app_id='signer'"),
  api.db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,'signer',?,'artifact','{}','[]','[]','owner',?),(?,'signer',?,'artifact','{}','[]','[]','owner',?)").bind(oldRelease,'old-hash',now-7*86400000,nextRelease,'next-hash',now-3600000),
  ...[oldDeployment,currentDeployment,failedDeployment].map(job=>api.db.prepare("INSERT INTO deployments(deployment_id,app_id,release_id,created_by,expected_release_id,mode,status,phase,state_json,created_at,updated_at,recorded_at) VALUES(?,'signer',?,'owner',NULL,'live',?,?,?,?,?,?)").bind(job.id,job.releaseId,job.status,job.phase,JSON.stringify(job),job.createdAt,job.updatedAt,job.status==='succeeded'?job.updatedAt:null)),
  api.db.prepare("INSERT INTO app_backups(backup_id,app_id,release_id,database_id,created_by,status,state_json,created_at,updated_at) VALUES(?,'signer','signer-release','db-signer','owner','succeeded',?,?,?)").bind(backup.id,JSON.stringify(backup),backup.createdAt,backup.updatedAt),
  ...Array.from({length:8},(_,index)=>api.db.prepare("INSERT INTO invocations(invocation_id,root_invocation_id,session_id,person_id,app_id,release_id,action_name,depth,status,error_code,started_at,expires_at,finished_at) VALUES(?,?,'owner-browser','owner','signer','signer-release','signing.sign',0,?,?,?, ?,?)").bind(`console-invocation-${index}`,`console-invocation-${index}`,index===6?'failed':'succeeded',index===6?'runtime_error':null,now-index*1800000,now-index*1800000+30000,now-index*1800000+1200)),
]);
const path='/tmp/atrax-console-fixture.json';
await writeFile(path,JSON.stringify({origin:api.origin,consoleOrigin:'http://localhost:3082',workspaceId:'company',appIds:['signer','other'],secretId:initial.secret.id,browserCookie:{name:'__Host-atrax_session',value:api.browserToken,domain:'localhost',path:'/',httpOnly:true,secure:true,sameSite:'Lax'},tokens:api.tokens},null,2),{mode:0o600});
console.log(`Local console API ${api.origin}; disposable fixture credentials in ${path}`);
await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
for(const task of cleanup.reverse()) await task();
