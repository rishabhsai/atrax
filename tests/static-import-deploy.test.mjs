import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {cliResult,httpResult,recipePlatform} from './helpers/recipes-platform.mjs';

test('an imported static prototype deploys, updates at one URL, resumes an interrupted update, and shares privately', {timeout:120_000}, async t => {
  const api=await recipePlatform(t);
  const root=join(api.directory,'client-review');
  await mkdir(join(root,'nested'),{recursive:true});
  await writeFile(join(root,'index.html'),'<h1>Client review: first</h1><a href="nested/report.html">Report</a>');
  await writeFile(join(root,'nested','report.html'),'first report');

  await api.signIn('owner');
  cliResult(await api.run('owner',['login'],{approve:true}));
  const workspace=cliResult(await api.run('owner',['workspace','create','Client Review','--slug','client-review','--key','client-review-workspace']));
  cliResult(await api.run('owner',['init','client-review','--assets','.'],{cwd:root}));
  const first=cliResult(await api.run('owner',['deploy','--workspace',workspace.workspace.id],{cwd:root}));
  const stableUrl=first.url;
  assert.match(stableUrl,/client-review/);
  const app=api.apps.get(first.appId);
  assert.ok(app,'the real release upload registered a local gateway');
  assert.match((await api.openApp('owner',first.appId)).body,/Client review: first/);

  await writeFile(join(root,'index.html'),'<h1>Client review: updated</h1><a href="nested/report.html">Report</a>');
  const updated=cliResult(await api.run('owner',['deploy'],{cwd:root}));
  assert.equal(updated.url,stableUrl);
  assert.match((await api.openApp('owner',first.appId)).body,/Client review: updated/);

  api.loseResponse('deployments.start');
  await writeFile(join(root,'index.html'),'<h1>Client review: resumed</h1><a href="nested/report.html">Report</a>');
  const interrupted=await api.run('owner',['deploy'],{cwd:root});
  assert.equal(interrupted.code,1,interrupted.stdout+interrupted.stderr);
  const resumed=cliResult(await api.run('owner',['deploy'],{cwd:root}));
  assert.equal(resumed.url,stableUrl);
  assert.match((await api.openApp('owner',first.appId)).body,/Client review: resumed/);

  await api.signIn('guest');
  await api.signIn('outsider');
  const invited=cliResult(await api.run('owner',['share','guest@example.com','--key','client-review-guest'],{cwd:root}));
  assert.equal(invited.url,stableUrl);
  assert.equal((await api.openApp('guest',first.appId)).status,403);
  assert.equal((await api.openApp('outsider',first.appId)).status,403);
  assert.equal((await api.call('apps.guests.accept',{invitationId:invited.invitation.id},'outsider')).body.error.code,'invitation_email_mismatch');
  httpResult(await api.call('apps.guests.accept',{invitationId:invited.invitation.id},'guest'));
  const accepted=await api.openApp('guest',first.appId);
  assert.equal(accepted.status,200,JSON.stringify(accepted));
  assert.match(accepted.body,/Client review: resumed/);
  assert.ok((await api.mailbox()).some(message=>message.to==='guest@example.com'));
});

test('an unsupported Node prototype cannot create a remote app or upload a release', {timeout:60_000}, async t => {
  const api=await recipePlatform(t);
  const root=join(api.directory,'server-prototype');
  await mkdir(root,{recursive:true});
  await writeFile(join(root,'index.html'),'<h1>Server prototype</h1>');
  await writeFile(join(root,'app.js'),'import {writeFile} from "node:fs/promises"; await writeFile("state", "x");');
  await api.signIn('owner');
  cliResult(await api.run('owner',['login'],{approve:true}));
  const workspace=cliResult(await api.run('owner',['workspace','create','Server Review','--slug','server-review','--key','server-review-workspace']));
  cliResult(await api.run('owner',['init','server-review','--assets','.'],{cwd:root}));
  const result=await api.run('owner',['deploy','--workspace',workspace.workspace.id],{cwd:root});
  assert.equal(result.code,1,result.stdout+result.stderr);
  assert.match(result.envelope.error.message,/imports server module node:fs\/promises/);
  assert.equal(api.calls.some(call=>call.name==='apps.create'||call.name==='releases.upload'),false);
});
