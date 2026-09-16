import {getApp,requireMaintainer,maintainerAdmission} from './access.js';
import {OperationError} from './identity-errors.js';
import {validateArtifact} from '../../shared/artifact.js';

export async function handleReleaseOperation(name,input,{env,actor}) {
  if(!['releases.upload','releases.list'].includes(name)) return null;
  const app=await getApp(env,input.appId);
  await requireMaintainer(env,app,actor);
  if(name==='releases.list') {
    const rows=await env.CP_DB.prepare('SELECT release_id,artifact_hash,created_by,created_at FROM releases WHERE app_id=? ORDER BY created_at DESC LIMIT 100').bind(app.app_id).all();
    return {result:{releases:rows.results.map(row=>({id:row.release_id,hash:row.artifact_hash,createdBy:row.created_by,createdAt:row.created_at}))}};
  }
  if(!env.ARTIFACTS) throw new OperationError('hosting_unavailable',503,'Artifact storage is not configured');
  let artifact;
  try {artifact=await validateArtifact(input.artifact);} catch(error) {throw new OperationError('invalid_artifact',400,error.message);}
  for(const dependency of Object.values(artifact.manifest.dependencies ?? {})) {
    const target=await getApp(env,dependency.appId);
    if(target.workspace_id!==app.workspace_id) throw new OperationError('forbidden',403,'Dependencies must belong to this workspace');
  }
  const key=`releases/${artifact.hash}.json`;
  await env.ARTIFACTS.put(key,JSON.stringify(artifact),{httpMetadata:{contentType:'application/json'}});
  const admission=maintainerAdmission({actor},app.app_id);
  const committed=await env.CP_DB.batch([
    env.CP_DB.prepare(`INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${admission.sql} ON CONFLICT(app_id,artifact_hash) DO NOTHING`).bind(crypto.randomUUID(),app.app_id,artifact.hash,key,JSON.stringify(artifact.manifest),JSON.stringify(artifact.actions),JSON.stringify(artifact.migrations),actor.person.id,Date.now(),...admission.params),
    env.CP_DB.prepare(`SELECT release_id,artifact_hash,created_at FROM releases WHERE app_id=? AND artifact_hash=? AND ${admission.sql}`).bind(app.app_id,artifact.hash,...admission.params),
  ]);
  const release=committed[1].results[0];
  if(!release) throw new OperationError('forbidden',403,'Your session or app maintenance access changed during upload');
  return {result:{release:{id:release.release_id,hash:release.artifact_hash,createdAt:release.created_at}}};
}
