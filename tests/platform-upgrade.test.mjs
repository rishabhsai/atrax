import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Miniflare} from 'miniflare';
import {bundlePlatform,localWorker,migrateControlPlane} from '../cli/local-platform.mjs';
import {splitSqlQuery} from '../cli/vendor/splitter.mjs';
import {createHash} from 'node:crypto';
import {applyMigrations} from '../runtime/migrations.js';

test('fresh launch retires prototype records and rejects the removed anonymous API',async t=>{
  const mf=new Miniflare({workers:[localWorker('control',await bundlePlatform('control-plane/src/index.js'),{CP_DB:{type:'d1',id:'upgrade'}})]});
  t.after(()=>mf.dispose());
  const db=await mf.getD1Database('CP_DB','control');
  const prototypeMigrations=[];
  for(const name of ['0001_apps.sql','0002_door.sql','0003_domains.sql']) {
    const source=await readFile(new URL(`../control-plane/migrations/${name}`,import.meta.url),'utf8');
    prototypeMigrations.push({name,hash:createHash('sha256').update(source).digest('hex'),statements:splitSqlQuery(source)});
  }
  await applyMigrations(db,prototypeMigrations,'prototype');
  await db.prepare(`INSERT INTO apps(app_id,name,worker_name,url,d1_id,d1_name,applied_migrations,claim_hash,manage_hash,created_at,claimed_at)
    VALUES('claimed-app','Old app','existing-worker','https://old.example','retained-db','retained-db-name','["0001_data.sql"]','claim-proof','manage-proof',100,200)`).run();
  await migrateControlPlane(db);
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='legacy_apps'").first(),null);
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM apps').first()).count,0);
  for(const path of ['/v1/apps','/v1/apps/claimed-app','/v1/apps/claimed-app/claim','/v1/apps/claimed-app/deploy']) {
    const response=await mf.dispatchFetch(`https://api.atrax.test${path}`,{method:'POST',body:'{}'});
    assert.equal(response.status,404,path);
  }
  const anonymous=await mf.dispatchFetch('https://api.atrax.test/v1/operations/apps.create',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'anonymous'},body:JSON.stringify({workspaceId:'company',name:'New app',slug:'new-app'})});
  assert.equal(anonymous.status,401);
  // Replaying migrations must not rename or recreate the current app table.
  await migrateControlPlane(db);
  assert.equal((await db.prepare('SELECT COUNT(*) count FROM apps').first()).count,0);
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='legacy_apps'").first(),null);
});
