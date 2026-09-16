import {Miniflare} from 'miniflare';
import {createHash,randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {buildApp} from './build.mjs';
import {bundlePlatform,localWorker,migrateControlPlane} from './local-platform.mjs';
import {applyMigrations} from '../runtime/migrations.js';

export async function startLocalApp(root,{port=8787}={}) {
  const artifact=await buildApp(root);
  const sessionSecret=randomBytes(32).toString('hex');
  const sessionHash=createHash('sha256').update(sessionSecret).digest('hex');
  const prefix=`assets/${artifact.hash}/`;
  const assets=Object.fromEntries(Object.entries(artifact.assets).map(([path,{hash,size,contentType}])=>[path,{hash,size,contentType}]));
  // This local-only transport chooses a seeded developer identity. Gateway and Door
  // still execute their normal authorization code. No hosted auth bypass exists.
  const entrySource=`export default{async fetch(request,env){const headers=new Headers(request.headers);headers.delete('cookie');headers.set('authorization','Bearer '+env.SESSION);return env.GATEWAY.fetch(new Request(request,{headers}))}};`;
  const gatewayEnv={
    APP_ID:{type:'json',value:'local-app'},RELEASE_ID:{type:'json',value:artifact.hash},WORKSPACE_ID:{type:'json',value:'local-workspace'},
    CONFIG_KEY:{type:'json',value:`config/${artifact.hash}.json`},CONSOLE_ORIGIN:{type:'json',value:'http://localhost:3000'},
    ARTIFACTS:{type:'r2',name:'local-artifacts'},
    DOOR:{type:'worker',worker:'door',exportName:'Door'},
    ...(artifact.runtime ? {RUNTIME:{type:'worker',worker:'runtime',exportName:'AppRuntime'}} : {}),
  };
  await mkdir(join(root,'.atrax/state'),{recursive:true});
  const workers=[
    localWorker('local-entry',entrySource,{SESSION:{type:'json',value:sessionSecret},GATEWAY:{type:'worker',worker:'gateway'}}),
    localWorker('gateway',await bundlePlatform('gateway/src/index.js'),gatewayEnv),
    localWorker('door',await bundlePlatform('control-plane/src/access.js'),{CP_DB:{type:'d1',id:'local-control-plane'}}),
  ];
  if(artifact.runtime) workers.push(localWorker('runtime',artifact.runtime,artifact.manifest.tables ? {DB:{type:'d1',id:'local-app-data'}} : {}));
  const mf=new Miniflare({host:'127.0.0.1',port,resourcePersistencePath:join(root,'.atrax/state'),workers});
  try {
    const url=String(await mf.ready);
    const db=await mf.getD1Database('CP_DB','door');
    await migrateControlPlane(db);
    const now=Date.now();
    await db.batch([
      db.prepare("INSERT INTO people(person_id,email,verified_at,created_at) VALUES('local-person','developer@localhost.test',?,?) ON CONFLICT DO NOTHING").bind(now,now),
      db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('local-workspace','Local workspace','local','local-person',?) ON CONFLICT DO NOTHING").bind(now),
      db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('local-workspace','local-person','owner','active',?) ON CONFLICT DO NOTHING").bind(now),
      db.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,expires_at,created_at) VALUES('local-session',?,'local-person','cli',?,?) ON CONFLICT(session_id) DO UPDATE SET secret_hash=excluded.secret_hash,expires_at=excluded.expires_at,revoked_at=NULL").bind(sessionHash,now+30*86400000,now),
      db.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at) VALUES('local-app','local-workspace',?,?,'local-gateway',?,'ready','workspace','local-person',?,?) ON CONFLICT(app_id) DO UPDATE SET name=excluded.name,slug=excluded.slug,url=excluded.url,updated_at=excluded.updated_at").bind(artifact.manifest.name,artifact.manifest.name,url,now,now),
      db.prepare("DELETE FROM app_hosts WHERE app_id='local-app'"),
      db.prepare("INSERT INTO app_hosts(hostname,app_id,kind) VALUES(?,'local-app','live')").bind(new URL(url).host),
      db.prepare("INSERT INTO app_maintainers(app_id,person_id) VALUES('local-app','local-person') ON CONFLICT DO NOTHING"),
      db.prepare("INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,'local-app',?,?,?, ?,?,'local-person',?) ON CONFLICT DO NOTHING").bind(artifact.hash,artifact.hash,`releases/${artifact.hash}`,JSON.stringify(artifact.manifest),JSON.stringify(artifact.actions),JSON.stringify(artifact.migrations),now),
      db.prepare("UPDATE apps SET active_release_id=? WHERE app_id='local-app'").bind(artifact.hash),
      ...artifact.actions.map(action=>db.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES('local-app',?,'workspace') ON CONFLICT DO NOTHING").bind(action.name)),
    ]);
    const bucket=await mf.getR2Bucket('ARTIFACTS','gateway');
    await bucket.put(`config/${artifact.hash}.json`,JSON.stringify({manifest:artifact.manifest,actions:artifact.actions,assets,assetPrefix:prefix}));
    for(const asset of Object.values(artifact.assets)) await bucket.put(`${prefix}${asset.hash}`,Buffer.from(asset.content,'base64'),{httpMetadata:{contentType:asset.contentType}});
    if(artifact.manifest.tables && artifact.runtime) await applyMigrations(await mf.getD1Database('DB','runtime'),artifact.migrations,artifact.hash);
    return {url,artifact,close:()=>mf.dispose()};
  } catch(error) {await mf.dispose();throw error;}
}
