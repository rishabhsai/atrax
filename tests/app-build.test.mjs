import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildApp } from '../cli/build.mjs';

async function fixture(t, contract) {
  const root = await mkdtemp(join(tmpdir(), 'atrax-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'public'));
  await writeFile(join(root, 'public/index.html'), '<h1>Our workspace</h1>');
  await writeFile(join(root, 'atrax.json'), JSON.stringify({version:2,name:'test-app',web:{assets:'public',fallback:'index.html'},...contract}));
  return root;
}

test('static apps produce a verified deterministic artifact without a runtime or database', async t => {
  const root = await fixture(t);
  const first = await buildApp(root);
  const second = await buildApp(root);
  assert.equal(first.hash, second.hash);
  assert.equal(first.runtime, null);
  assert.deepEqual(first.migrations, []);
  assert.deepEqual(first.actions, []);
  assert.equal(Buffer.from(first.assets['/index.html'].content, 'base64').toString(), '<h1>Our workspace</h1>');
  assert.equal(JSON.parse(await readFile(join(root, '.atrax/build/artifact.json'), 'utf8')).hash, first.hash);
});

test('nested imports and npm modules resolve into the very runtime inspected by build', async t => {
  const root = await fixture(t, {actions:{entry:'src/actions.js'}});
  await mkdir(join(root, 'src/nested'), {recursive:true});
  await mkdir(join(root, 'node_modules/example-value'), {recursive:true});
  await writeFile(join(root, 'node_modules/example-value/package.json'), JSON.stringify({name:'example-value',type:'module',exports:'./index.js'}));
  await writeFile(join(root, 'node_modules/example-value/index.js'), 'export const value = "from npm";');
  await writeFile(join(root, 'src/nested/value.js'), 'export {value} from "example-value";');
  await writeFile(join(root, 'src/actions.js'), `import {value} from './nested/value.js'; export const actions = {'hello.read': {description:value, effect:'read', inputSchema:{type:'object',additionalProperties:false}, outputSchema:{type:'string'}, async handler(){return value}}};`);
  const artifact = await buildApp(root);
  assert.equal(artifact.actions[0].description, 'from npm');
  assert.match(artifact.runtime, /from npm/);
  assert.doesNotMatch(artifact.runtime, /from ["']example-value/);
  await writeFile(join(root, 'src/nested/value.js'), 'export const value = "changed";');
  assert.notEqual((await buildApp(root)).hash, artifact.hash);
});

test('migration parsing retains quoted semicolons and compound trigger bodies', async t => {
  const root = await fixture(t, {tables:{migrations:'migrations'}});
  await mkdir(join(root, 'migrations'));
  await writeFile(join(root, 'migrations/0001_notes.sql'), `CREATE TABLE notes (body TEXT); CREATE TABLE audit (body TEXT); CREATE TRIGGER note_insert AFTER INSERT ON notes BEGIN INSERT INTO audit VALUES ('a;b'); INSERT INTO audit VALUES (NEW.body); END;`);
  const artifact = await buildApp(root);
  assert.equal(artifact.migrations[0].statements.length, 3);
  assert.match(artifact.migrations[0].statements[2], /'a;b'/);
});

test('build rejects missing assets, traversal, and invalid action declarations', async t => {
  const root = await fixture(t, {web:{assets:'../outside'}});
  await assert.rejects(buildApp(root), /inside the app|relative path/);
  await writeFile(join(root, 'atrax.json'), JSON.stringify({version:2,name:'test-app',web:{assets:'missing'}}));
  await assert.rejects(buildApp(root), /missing|does not exist/);
  await writeFile(join(root, 'atrax.json'), JSON.stringify({version:2,name:'test-app',actions:{entry:'actions.js'}}));
  await writeFile(join(root, 'actions.js'), `export const actions = {'bad': {description:'bad',effect:'anything',inputSchema:{},handler(){}}};`);
  await assert.rejects(buildApp(root), /effect|action/);
});

test('additive JSON migrations compile deterministically and reject existing-table mutations',async t=>{
  const root=await fixture(t,{tables:{migrations:'migrations'}});await mkdir(join(root,'migrations'));
  await writeFile(join(root,'migrations/0001_initial.sql'),'CREATE TABLE notes(body TEXT);');
  const source=JSON.stringify({version:1,operations:[{createTable:{name:'tags',columns:[{name:'id',type:'TEXT',primaryKey:true},{name:'label',type:'TEXT'}]}},{createIndex:{name:'notes_body',table:'notes',columns:['body']}}]});
  await writeFile(join(root,'migrations/0002_tags.json'),source);
  const artifact=await buildApp(root);
  assert.deepEqual(artifact.migrations[1].statements,['CREATE TABLE "tags" ("id" TEXT PRIMARY KEY, "label" TEXT)','CREATE INDEX "notes_body" ON "notes" ("body")']);
  await writeFile(join(root,'migrations/0002_tags.json'),JSON.stringify({version:1,operations:[{addColumn:{table:'notes',name:'tag',type:'TEXT'}}]}));
  await assert.rejects(buildApp(root),/createTable and nonunique createIndex/);
});
