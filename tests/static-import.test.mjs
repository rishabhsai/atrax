import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {buildApp} from '../cli/build.mjs';
import {startLocalApp} from '../cli/dev.mjs';

const execute=promisify(execFile);
const cli=resolve(import.meta.dirname,'../bin/atrax.mjs');

async function prototype(t) {
  const root=await mkdtemp(join(tmpdir(),'atrax-static-import-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'nested'));
  await mkdir(join(root,'.git'));
  await mkdir(join(root,'node_modules','private-package'),{recursive:true});
  await mkdir(join(root,'credentials'));
  await writeFile(join(root,'index.html'),'<a href="nested/report.html">Review</a><script type="module" src="/app.js"></script>');
  await writeFile(join(root,'nested','report.html'),'review payload');
  await writeFile(join(root,'nested','blob.custom'),'\x00\x01prototype bytes');
  await writeFile(join(root,'config.js'),'window.reviewConfig = "ready";');
  await writeFile(join(root,'app-config.json'),'{"mode":"review"}');
  await writeFile(join(root,'app.js'),'document.body.dataset.ready = "yes";');
  await writeFile(join(root,'atrax.lock.json'),'private deployment state');
  await writeFile(join(root,'.env'),'PRIVATE=value');
  await writeFile(join(root,'.git','config'),'private source metadata');
  await writeFile(join(root,'node_modules','private-package','index.js'),'private dependency');
  await writeFile(join(root,'credentials','session.json'),'private credential');
  return root;
}

test('a current-folder prototype follows init, build, and the protected local gateway path', async t => {
  const root=await prototype(t);
  const result=await execute(process.execPath,[cli,'init','client-review','--assets','.','--json'],{cwd:root});
  assert.equal(JSON.parse(result.stdout).result.manifest.web.assets,'.');

  const artifact=await buildApp(root);
  assert.deepEqual(Object.keys(artifact.assets).sort(),['/app-config.json','/app.js','/config.js','/index.html','/nested/blob.custom','/nested/report.html']);
  assert.equal(artifact.assets['/nested/blob.custom'].contentType,'application/octet-stream');

  const local=await startLocalApp(root,{port:0});
  t.after(local.close);
  const app=path=>fetch(new URL(path,local.url),{headers:{accept:'text/html'}});
  const nested=await app('/nested/report.html');
  assert.equal(nested.status,200,await nested.clone().text());
  assert.equal(await nested.text(),'review payload');
  const binary=await app('/nested/blob.custom');
  assert.equal(binary.headers.get('content-type'),'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())],[0,1,...Buffer.from('prototype bytes')]);
  const config=await app('/config.js');
  assert.equal(config.headers.get('content-type'),'text/javascript; charset=utf-8');
  assert.equal(await config.text(),'window.reviewConfig = "ready";');
  const namedConfig=await app('/app-config.json');
  assert.equal(namedConfig.headers.get('content-type'),'application/json');
  assert.equal(await namedConfig.text(),'{"mode":"review"}');
  const fallback=await app('/client-side/route');
  assert.equal(fallback.status,200);
  assert.match(await fallback.text(),/nested\/report\.html/);
  assert.equal((await app('/atrax.lock.json')).status,404);
  assert.equal((await app('/credentials/session.json')).status,404);
});

test('a prototype with a server runtime fails before a deploy can mutate remote state', async t => {
  const root=await prototype(t);
  await writeFile(join(root,'atrax.json'),JSON.stringify({version:2,name:'client-review',web:{assets:'.',fallback:'index.html'}}));
  await writeFile(join(root,'package.json'),JSON.stringify({scripts:{start:'node server.mjs'}}));
  await writeFile(join(root,'server.mjs'),'import {writeFile} from "node:fs/promises"; await writeFile("state", "x");');
  await assert.rejects(buildApp(root),error=>error.code==='unsupported_static_runtime'&&/server start command/.test(error.message));
});

test('a browser asset that imports Node filesystem access fails with an adaptation message', async t => {
  const root=await prototype(t);
  await writeFile(join(root,'atrax.json'),JSON.stringify({version:2,name:'client-review',web:{assets:'.',fallback:'index.html'}}));
  await writeFile(join(root,'app.js'),'import {writeFile} from "node:fs/promises"; await writeFile("state", "x");');
  await assert.rejects(buildApp(root),error=>error.code==='unsupported_static_runtime'&&/imports server module node:fs\/promises/.test(error.message));
});

test('a symbolic link is rejected at the declared public boundary', async t => {
  const root=await prototype(t);
  await writeFile(join(root,'atrax.json'),JSON.stringify({version:2,name:'client-review',web:{assets:'.',fallback:'index.html'}}));
  await symlink(join(root,'nested','report.html'),join(root,'linked-report.html'));
  await assert.rejects(buildApp(root),/Public assets cannot be symbolic links/);
});
