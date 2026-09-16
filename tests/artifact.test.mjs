import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {buildApp} from '../cli/build.mjs';
import {validateArtifact,sha256} from '../shared/artifact.js';
import {canonicalJson,COMPATIBILITY_DATE} from '../shared/app-contract.js';

test('hosting validates the actual artifact, including migration source and asset bytes',async t=>{
  const root=await mkdtemp(join(tmpdir(),'atrax-artifact-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(resolve('templates/chat'),root,{recursive:true});
  const manifest=join(root,'atrax.json');await writeFile(manifest,(await readFile(manifest,'utf8')).replace('__APP_NAME__','artifact-test'));
  const artifact=await buildApp(root);
  assert.equal((await validateArtifact(artifact)).hash,artifact.hash);
  const asset=structuredClone(artifact);asset.assets['/index.html'].content=Buffer.from('tampered').toString('base64');
  await assert.rejects(validateArtifact(asset),/size|checksum/);
  const migration=structuredClone(artifact);migration.migrations[0].statements[0]='DROP TABLE messages';
  const {hash,...content}=migration;void hash;migration.hash=await sha256(canonicalJson(content));
  await assert.rejects(validateArtifact(migration),/statements do not match/);
});

test('server validates typed migration operations rather than trusting supplied SQL',async()=>{
  const {migrationStatements,planMigrationHistory}=await import('../shared/migration-contract.js');
  const source=JSON.stringify({version:1,operations:[{createTable:{name:'notes',columns:[{name:'id',type:'INTEGER',primaryKey:true}]}}]});
  const migration={name:'0001_notes.json',source,hash:await sha256(source),statements:migrationStatements('0001_notes.json',source)};
  const artifact={version:2,compatibilityDate:COMPATIBILITY_DATE,manifest:{version:2,name:'test',web:{assets:'public'},tables:{migrations:'migrations'}},runtime:null,actions:[],migrations:[migration],assets:{}};
  artifact.hash=await sha256(canonicalJson(artifact));await validateArtifact(artifact);
  artifact.migrations[0].statements=['DROP TABLE customers'];const {hash,...content}=artifact;void hash;artifact.hash=await sha256(canonicalJson(content));
  await assert.rejects(validateArtifact(artifact),/statements do not match/);
  assert.throws(()=>migrationStatements('0002_bad.json',JSON.stringify({version:1,operations:[{createIndex:{name:'idx',table:'notes',columns:['id'],unique:true}}]})),/Invalid index/);
  assert.throws(()=>planMigrationHistory([migration],[{...migration,hash:'different'}]),/history cannot change/);
  const second={...migration,name:'0002_another.json'};
  assert.deepEqual(planMigrationHistory([migration,second],[migration],{rollback:true}).retain,[second]);
  assert.throws(()=>planMigrationHistory([migration],[migration,{name:'0003_drop.sql',source:'DROP TABLE notes',hash:'h'}]),/declarative additive/);
});
