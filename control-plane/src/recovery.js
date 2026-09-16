import {createHash} from 'node:crypto';
import {getApp,requireMaintainer} from './access.js';
import {OperationError} from './identity-errors.js';
import {sha256} from '../../shared/artifact.js';

/** The D1 ledger is authoritative even when a release stopped part-way through. */
export async function databaseHistory(env,provider,appId,databaseId) {
  if(!databaseId) return [];
  const [table]=await provider.queryDatabase(databaseId,[{sql:"SELECT name FROM sqlite_master WHERE type='table' AND name='__atrax_migrations'"}]);
  if(!table.results?.length) return [];
  const [ledger]=await provider.queryDatabase(databaseId,[{sql:'SELECT name,hash FROM __atrax_migrations ORDER BY name'}]);
  const applied=ledger.results ?? [];if(!applied.length) return [];
  const {results}=await env.CP_DB.prepare(`SELECT DISTINCT m.value AS migration FROM releases r,json_each(r.migrations_json) m
    JOIN json_each(?) applied ON json_extract(m.value,'$.name')=json_extract(applied.value,'$.name') AND json_extract(m.value,'$.hash')=json_extract(applied.value,'$.hash')
    WHERE r.app_id=?`).bind(JSON.stringify(applied),appId).all();
  const sources=results.map(row=>JSON.parse(row.migration));
  return applied.map(row=>{
    const migration=sources.find(value=>value.name===row.name&&value.hash===row.hash);
    if(!migration) throw new OperationError('migration_source_missing',409,`Retained source is missing for applied migration ${row.name}. Upload its original source before planning another release.`);
    return migration;
  });
}
export async function storedHistory(env,key) {
  const object=key?await env.ARTIFACTS.get(key):null;
  if(!object) throw new OperationError('migration_source_missing',409,'Stored migration history is missing');
  return object.json();
}
export async function connectedApps(env,app) {
  const {results}=await env.CP_DB.prepare("SELECT a.app_id,r.manifest_json FROM apps a JOIN releases r ON r.release_id=a.active_release_id WHERE a.workspace_id=? AND a.status='ready'").bind(app.workspace_id).all();
  const ids=new Set();
  for(const row of results) {
    const dependencies=Object.values(JSON.parse(row.manifest_json).dependencies ?? {}).map(value=>value.appId);
    if(row.app_id===app.app_id) for(const id of dependencies) ids.add(id);
    if(dependencies.includes(app.app_id)) ids.add(row.app_id);
  }
  return [...ids].sort();
}
export async function getBackup(env,appId,id) {
  const row=await env.CP_DB.prepare('SELECT state_json FROM app_backups WHERE backup_id=? AND app_id=?').bind(id,appId).first();
  if(!row) throw new OperationError('not_found',404,'Backup not found');
  return JSON.parse(row.state_json);
}
export async function restorePlan(env,app,backupId) {
  const backup=await getBackup(env,app.app_id,backupId);
  if(backup.status!=='succeeded') throw new OperationError('backup_not_ready',409,'The backup has not finished');
  return {appId:app.app_id,backupId,releaseId:backup.releaseId,schemaReleaseId:backup.schemaReleaseId,migrationKey:backup.migrationKey,expectedReleaseId:app.active_release_id,snapshotCreatedAt:backup.snapshotCreatedAt,snapshotCompletedAt:backup.snapshotCompletedAt,connectedAppIds:await connectedApps(env,app),originalDatabaseId:app.database_id,behavior:'new_database',retainsOriginalDatabase:true,warning:'Reads return to the snapshot. Connected apps may retain newer business commands or references; their state is not rewound. The original database and late writes remain available for separate recovery.'};
}
export function backupView(job) {
  return {warning:'D1 pauses queries while exporting. Snapshot time is the capture window, not an arbitrary point-in-time restore.',id:job.id,appId:job.appId,releaseId:job.releaseId,schemaReleaseId:job.schemaReleaseId,migrationKey:job.migrationKey,databaseId:job.databaseId,status:job.status,phase:job.phase,bookmark:job.exportBookmark ?? null,snapshotCreatedAt:job.snapshotCreatedAt ?? null,snapshotCompletedAt:job.snapshotCompletedAt ?? null,size:job.snapshotSize ?? null,sha256:job.snapshotHash ?? null,md5:job.snapshotMd5 ?? null,objectKey:job.snapshotKey,error:job.error ?? null,createdAt:job.createdAt,updatedAt:job.updatedAt,retryAfterMs:1000};
}
/** Bounded-memory multipart capture accepts streaming exports without Content-Length. */
export async function storeSnapshot(bucket,key,body,customMetadata) {
  const upload=await bucket.createMultipartUpload(key,{customMetadata,httpMetadata:{contentType:'application/sql'}});
  const parts=[];const reader=body.getReader();let buffer=new Uint8Array(5*1024*1024),used=0,total=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();if(done) break;
      total+=value.byteLength;
      if(total>5*1024*1024*1024) throw new OperationError('snapshot_too_large',413,'D1 snapshot import supports at most 5 GiB');
      let offset=0;
      while(offset<value.byteLength) {
        const count=Math.min(buffer.byteLength-used,value.byteLength-offset);buffer.set(value.subarray(offset,offset+count),used);used+=count;offset+=count;
        if(used===buffer.byteLength) {parts.push(await upload.uploadPart(parts.length+1,buffer));buffer=new Uint8Array(5*1024*1024);used=0;}
      }
    }
    if(used||!parts.length) parts.push(await upload.uploadPart(parts.length+1,buffer.subarray(0,used)));
    await upload.complete(parts);
  } catch(error) {
    await reader.cancel().catch(()=>{});await upload.abort().catch(()=>{});throw error;
  }
}
export async function snapshotDigest(object) {
  const md5=createHash('md5'),sha=createHash('sha256');let size=0;
  const reader=object.body.getReader();
  for(;;) {const {done,value}=await reader.read();if(done) break;size+=value.byteLength;md5.update(value);sha.update(value);}
  return {size,md5:md5.digest('hex'),hash:sha.digest('hex')};
}
export async function handleRecoveryOperation(name,input,context) {
  if(!name.startsWith('backups.')&&name!=='previews.list'&&name!=='data.restore.plan') return null;
  const {env,actor,idempotencyKey}=context;
  const app=await getApp(env,input.appId);await requireMaintainer(env,app,actor);
  if(name==='data.restore.plan') return {result:{plan:await restorePlan(env,app,input.backupId)}};
  if(name==='previews.list') {
    const {results}=await env.CP_DB.prepare("SELECT state_json FROM deployments WHERE app_id=? AND mode='preview' ORDER BY created_at DESC LIMIT 100").bind(app.app_id).all();
    return {result:{previews:results.map(row=>JSON.parse(row.state_json))}};
  }
  if(name==='backups.list') {
    const {results}=await env.CP_DB.prepare('SELECT state_json FROM app_backups WHERE app_id=? ORDER BY created_at DESC LIMIT 100').bind(app.app_id).all();
    return {result:{backups:results.map(row=>JSON.parse(row.state_json))}};
  }
  if(!env.DEPLOYMENTS) throw new OperationError('hosting_unavailable',503,'Deployment coordination is not configured');
  const coordinator=env.DEPLOYMENTS.getByName(app.app_id);
  if(name==='backups.get') {await getBackup(env,app.app_id,input.backupId);return {result:{backup:await coordinator.get(input.backupId)}};}
  if(name==='backups.resume') {
    await getBackup(env,app.app_id,input.backupId);
    const value=await coordinator.resume(input.backupId,actor.session.id);
    if(!value?.ok) throw new OperationError(value?.error?.code ?? 'not_found',409,value?.error?.message ?? 'Backup not found');
    return {result:{backup:value.deployment}};
  }
  if(name!=='backups.create') return null;
  if(!idempotencyKey||idempotencyKey.length>200) throw new OperationError('idempotency_key_required',400,'Backup needs an idempotency key');
  const id=`backup-${(await sha256(`${app.app_id}:${actor.person.id}:${idempotencyKey}`)).slice(0,32)}`;
  const existing=await coordinator.get(id);
  if(existing) {if(existing.releaseId!==input.expectedReleaseId) throw new OperationError('idempotency_conflict',409,'Backup key was used for another release');return {result:{backup:existing}};}
  if(!app.database_id||!app.active_release_id) throw new OperationError('database_required',409,'This app has no live database');
  if(input.expectedReleaseId!==app.active_release_id) throw new OperationError('release_conflict',409,'The live release changed');
  const now=Date.now();const job={id,kind:'backup',appId:app.app_id,workspaceId:app.workspace_id,releaseId:app.active_release_id,expectedReleaseId:app.active_release_id,schemaReleaseId:app.schema_release_id ?? app.active_release_id,databaseId:app.database_id,sessionId:actor.session.id,status:'preparing',phase:'export',snapshotKey:`backups/${app.app_id}/${id}.sql`,createdAt:now,updatedAt:now};
  await env.CP_DB.prepare('INSERT INTO app_backups(backup_id,app_id,release_id,database_id,created_by,status,state_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(id,app.app_id,job.releaseId,job.databaseId,actor.person.id,job.status,JSON.stringify(backupView(job)),now,now).run();
  const value=await coordinator.start(job);
  if(!value.ok) throw new OperationError(value.error.code,value.error.status,value.error.message,value.error.details);
  return {result:{backup:value.deployment}};
}
