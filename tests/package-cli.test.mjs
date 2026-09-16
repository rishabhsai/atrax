import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {httpResult,recipePlatform} from './helpers/recipes-platform.mjs';
import {packagedCli,runCli} from './helpers/package-cli.mjs';

async function unusedPort() {
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  await new Promise(resolve=>server.close(resolve));
  return port;
}

async function serve(executable,directory) {
  const port=await unusedPort();
  const child=spawn(process.execPath,[executable,'dev','--port',String(port),'--json'],{cwd:directory,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout+=chunk);
  child.stderr.on('data',chunk=>stderr+=chunk);
  try {
    const deadline=Date.now()+30_000;
    while(!stdout.includes('"url"')&&Date.now()<deadline&&child.exitCode===null) await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(child.exitCode,null,stderr||stdout);
    const url=JSON.parse(stdout.trim().split('\n').at(0)).result.url;
    return {child,url};
  } catch(error) {child.kill('SIGTERM');throw error;}
}

test('the release tarball installs cleanly and carries its complete private-app workflow', {timeout:180_000}, async t => {
  const packaged=await packagedCli(t);
  const version=await runCli(packaged.executable,['--version']);
  assert.equal(version.code,0,version.stderr);
  assert.equal(version.stdout.trim(),packaged.manifest.version);
  const help=await runCli(packaged.executable,['--help']);
  assert.equal(help.code,0,help.stderr);
  assert.match(help.stdout,/atrax deploy/);
  const discovered=await runCli(packaged.executable,['operations','list','--json']);
  assert.equal(discovered.code,0,discovered.stderr);
  assert.ok(JSON.parse(discovered.stdout).result.operations.some(operation=>operation.name==='apps.guests.invite'));
  const recipes=await runCli(packaged.executable,['recipes','list','--json']);
  assert.equal(recipes.code,0,recipes.stderr);
  assert.ok(JSON.parse(recipes.stdout).result.recipes.some(recipe=>recipe.id==='deploy-share'));
  assert.equal(await readFile(`${packaged.installedRoot}/skills/atrax/SKILL.md`,'utf8'),await readFile('skills/atrax/SKILL.md','utf8'));

  for(const required of ['bin/atrax.mjs','cli/main.mjs','cli/setup.mjs','shared/operations.js','runtime/entry.js','gateway/src/index.js','control-plane/src/index.js','control-plane/migrations/0005_workspace_apps.sql','templates/inventory/src/actions.js','skills/atrax/SKILL.md']) assert.ok(packaged.files.has(required),required);
  for(const forbidden of ['app','tests','node_modules','.env','credentials.json','.atrax','next.config.ts']) assert.equal([...packaged.files].some(path=>path===forbidden||path.startsWith(`${forbidden}/`)),false,forbidden);

  const api=await recipePlatform(t);
  await api.signIn('owner');
  await api.run('owner',['login','--agent','Package proof'],{approve:true,executable:packaged.executable});
  const workspace=(await api.run('owner',['workspace','create','Package Company','--slug','package-company','--key','package-company-create'],{executable:packaged.executable})).envelope.result.workspace;
  const created=(await api.run('owner',['new','package-inventory','--template','inventory'],{executable:packaged.executable})).envelope.result;
  const built=await api.run('owner',['build'],{cwd:created.directory,executable:packaged.executable});
  assert.equal(built.code,0,built.stdout+built.stderr);

  const local=await serve(packaged.executable,created.directory);
  try {
    const response=await fetch(local.url);
    assert.equal(response.status,200);
    assert.match(await response.text(),/Inventory/);
  } finally {local.child.kill('SIGTERM');await new Promise(resolve=>local.child.once('exit',resolve));}

  const deployed=(await api.run('owner',['deploy','--workspace',workspace.id],{cwd:created.directory,executable:packaged.executable})).envelope.result;
  assert.equal(deployed.state,'succeeded');
  assert.match((await api.openApp('owner',deployed.appId)).body,/Inventory/);
  await api.signIn('guest');
  await api.signIn('outsider');
  const shared=(await api.run('owner',['share','guest@example.com','--app',deployed.appId,'--actions','stock.list','--key','package-guest'],{cwd:created.directory,executable:packaged.executable})).envelope.result;
  assert.equal(shared.url,deployed.url);
  assert.equal((await api.openApp('guest',deployed.appId)).status,403);
  assert.equal((await api.openApp('outsider',deployed.appId)).status,403);
  assert.equal((await api.call('apps.guests.accept',{invitationId:shared.invitation.id},'outsider')).body.error.code,'invitation_email_mismatch');
  httpResult(await api.call('apps.guests.accept',{invitationId:shared.invitation.id},'guest'));
  assert.equal((await api.openApp('guest',deployed.appId)).status,200);
});
