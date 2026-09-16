import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const execute = promisify(execFile);
const cli = resolve(import.meta.dirname, '../bin/atrax.mjs');
const token = 'test-employee-session';

async function setup(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'atrax-deploy-'));
  const config = join(directory, 'credentials');
  await mkdir(config);
  await mkdir(join(directory, 'public'));
  await writeFile(join(directory, 'atrax.json'), JSON.stringify({ version: 2, name: 'team-app', web: { assets: 'public', fallback: 'index.html' } }));
  await writeFile(join(directory, 'public/index.html'), '<h1>Team app</h1>');
  const calls = [];
  const createReceipts = new Map();
  const startReceipts = new Map();
  const releases = new Map();
  const jobs = new Map();
  const state = { calls, jobs, releases, app: null, workspaces: [{ id: 'workspace-1', name: 'Team' }], failJob: false, lostResponse: null, verifyCount: 0, resumeCount: 0, mutationSnapshots: [], ...options };
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.headers.authorization, `Bearer ${token}`);
      let text = '';
      for await (const chunk of request) text += chunk;
      const input = JSON.parse(text);
      const name = decodeURIComponent(request.url.split('/').at(-1));
      const key = request.headers['idempotency-key'];
      calls.push({ name, input, key });
      if (['apps.create', 'releases.upload', 'deployments.start', 'deployments.verify', 'deployments.resume'].includes(name)) {
        const saved = JSON.parse(await readFile(join(directory, '.atrax/deploy.json'), 'utf8'));
        state.mutationSnapshots.push(saved);
        const step = { 'apps.create': 'create', 'releases.upload': 'upload', 'deployments.start': 'start', 'deployments.verify': 'verify', 'deployments.resume': 'resume' }[name];
        assert.equal(saved.keys[step], key, 'write key must be on disk before sending the request');
      }
      let result;
      if (name === 'workspaces.list') result = { workspaces: state.workspaces };
      else if (name === 'workspaces.get') result = { workspace: state.workspaces.find((workspace) => workspace.id === input.workspaceId) };
      else if (name === 'auth.session.get') result = { person: { id: 'employee' }, session: { id: 'session' }, workspaces: state.workspaces };
      else if (name === 'apps.create') {
        if (createReceipts.has(key)) result = createReceipts.get(key);
        else {
          assert.equal(state.app, null, 'a retry must not create a replacement app');
          state.app = { id: 'app-1', workspaceId: input.workspaceId, name: input.name, url: 'https://team-app.atrax.test', activeReleaseId: null };
          result = { app: { ...state.app }, capabilities: { maintain: true } };
          createReceipts.set(key, result);
        }
      } else if (name === 'apps.get') result = { app: state.app, capabilities: { maintain: true } };
      else if (name === 'releases.upload') {
        const hash = input.artifact.hash;
        if (!releases.has(hash)) releases.set(hash, { id: `release-${releases.size + 1}`, hash });
        result = { release: releases.get(hash) };
      } else if (name === 'deployments.start') {
        if (startReceipts.has(key)) result = { deployment: jobs.get(startReceipts.get(key)) };
        else {
          assert.equal(input.expectedReleaseId, state.app.activeReleaseId);
          const job = { id: `job-${jobs.size + 1}`, appId: input.appId, releaseId: input.releaseId, status: state.failJob ? 'failed' : 'preparing', phase: 'candidate', url: state.app.url, retryAfterMs: 1, ...(state.failJob ? { error: { code: 'provider_unavailable', message: 'Provider temporarily unavailable.' } } : {}) };
          jobs.set(job.id, job);
          startReceipts.set(key, job.id);
          result = { deployment: job };
        }
      } else if (name === 'deployments.get') {
        const job = jobs.get(input.deploymentId);
        if (job.status === 'preparing') { job.status = 'awaiting_verification'; job.phase = 'candidate_check'; }
        result = { deployment: job };
      } else if (name === 'deployments.verify') {
        state.verifyCount++;
        const job = jobs.get(input.deploymentId);
        job.status = 'succeeded'; job.phase = 'complete';
        state.app.activeReleaseId = job.releaseId;
        result = { deployment: job };
      } else if (name === 'deployments.resume') {
        state.resumeCount++;
        const job = jobs.get(input.deploymentId);
        job.status = 'awaiting_verification'; job.error = null;
        result = { deployment: job };
      } else assert.fail(`Unexpected operation: ${name}`);
      if (state.lostResponse === name) { state.lostResponse = null; request.socket.destroy(); return; }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ schemaVersion: 1, status: 'succeeded', result }));
    } catch (error) {
      state.serverError = error;
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'failed', error: { code: 'fixture_error', message: error.message } }));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await writeFile(join(config, 'credentials.json'), JSON.stringify({ origin, accessToken: token, person: { id: 'employee' }, session: { id: 'session' } }));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); });
  state.directory = directory;
  state.origin = origin;
  state.command = async (command,...args) => {
    let output;
    try {
      output = { code: 0, ...await execute(process.execPath, [cli, command, '--json', ...args], { cwd: directory, env: { ...process.env, ATRAX_CONFIG_DIR: config, ATRAX_API_ORIGIN: origin, NO_COLOR: '1' }, timeout: 20000 }) };
    } catch (error) { output = { code: error.code, stdout: error.stdout, stderr: error.stderr }; }
    assert.ifError(state.serverError);
    assert.ok(!output.stdout.includes(token));
    assert.ok(!output.stderr.includes(token));
    return { ...output, envelope: JSON.parse(output.stdout.trim()) };
  };
  state.run = (...args)=>state.command('deploy',...args);
  state.lock = async () => JSON.parse(await readFile(join(directory, 'atrax.lock.json'), 'utf8'));
  state.pending = async () => JSON.parse(await readFile(join(directory, '.atrax/deploy.json'), 'utf8'));
  return state;
}

test('actual deploy command creates, uploads, verifies and publishes with a nonsecret v2 lock', async (t) => {
  const platform = await setup(t);
  const result = await platform.run();
  assert.equal(result.code, 0, result.stdout);
  assert.equal(result.envelope.result.state, 'succeeded');
  assert.equal(result.envelope.result.appId, 'app-1');
  assert.equal(result.envelope.result.deploymentId, 'job-1');
  assert.equal(result.envelope.result.url, 'https://team-app.atrax.test');
  assert.equal(platform.verifyCount, 1);
  assert.deepEqual(await platform.lock(), { version: 2, apiOrigin: platform.origin, workspaceId: 'workspace-1', appId: 'app-1', url: 'https://team-app.atrax.test', activeReleaseId: 'release-1' });
  await assert.rejects(platform.pending(), { code: 'ENOENT' });
});

test('link explicitly refreshes a teammate release and refuses pending or different app identities',async t=>{
  const platform=await setup(t);
  assert.equal((await platform.run()).code,0);
  platform.app.activeReleaseId='teammate-release';
  const blocked=await platform.run();
  assert.equal(blocked.envelope.error.code,'release_conflict');
  assert.equal((await platform.lock()).activeReleaseId,'release-1');
  const linked=await platform.command('link','app-1');
  assert.equal(linked.code,0,linked.stdout);
  assert.equal((await platform.lock()).activeReleaseId,'teammate-release');
  assert.equal((await platform.command('link','another-app')).envelope.error.code,'app_link_conflict');
  platform.lostResponse='releases.upload';
  assert.equal((await platform.run()).code,1);
  assert.equal((await platform.command('link','app-1')).envelope.error.code,'deployment_pending');
});

test('initial action access is saved before deployment and an interrupted retry preserves that choice',async t=>{
  const platform=await setup(t,{lostResponse:'deployments.start'});
  await writeFile(join(platform.directory,'actions.js'),`export const actions={ 'records.list':{description:'List records',effect:'read',inputSchema:{type:'object'},outputSchema:{type:'object'},handler:()=>({})} };`);
  await writeFile(join(platform.directory,'atrax.json'),JSON.stringify({version:2,name:'team-app',web:{assets:'public'},actions:{entry:'actions.js'}}));
  const access={'records.list':{audience:'selected',personIds:['employee']}};
  await writeFile(join(platform.directory,'access.json'),JSON.stringify(access));
  const interrupted=await platform.run('--access','access.json');
  assert.equal(interrupted.code,1,interrupted.stdout);
  assert.deepEqual((await platform.pending()).actionAccess,access);
  await writeFile(join(platform.directory,'access.json'),JSON.stringify({'records.list':{audience:'workspace'}}));
  const resumed=await platform.run('--access','access.json');
  assert.equal(resumed.code,0,resumed.stdout);
  const starts=platform.calls.filter(call=>call.name==='deployments.start');
  assert.equal(starts.length,2);
  assert.ok(starts.every(call=>JSON.stringify(call.input.actionAccess)===JSON.stringify(access)));
});

test('deploy observes an explicitly cancelled job before starting a fresh attempt for the same app',async t=>{
  const platform=await setup(t,{failJob:true});
  assert.equal((await platform.run()).code,1);
  const cancelled=platform.jobs.get('job-1');cancelled.status='cancelled';cancelled.phase='cancelled';
  platform.failJob=false;
  const result=await platform.run();
  assert.equal(result.code,0,result.stdout);
  assert.equal(result.envelope.result.appId,'app-1');
  assert.equal(result.envelope.result.deploymentId,'job-2');
  assert.equal(platform.calls.filter(call=>call.name==='apps.create').length,1);
  assert.equal(platform.calls.filter(call=>call.name==='deployments.resume').length,0);
  const starts=platform.calls.filter(call=>call.name==='deployments.start');
  assert.notEqual(starts[0].key,starts[1].key);
});

test('a lost app-create response reuses its persisted key and original artifact after source edits', async (t) => {
  const platform = await setup(t, { lostResponse: 'apps.create' });
  const first = await platform.run();
  assert.equal(first.code, 1);
  const original = await platform.pending();
  assert.equal(original.appId, null);
  await writeFile(join(platform.directory, 'public/index.html'), '<h1>Edited during an interrupted deployment</h1>');
  const retried = await platform.run();
  assert.equal(retried.code, 0, retried.stdout);
  assert.equal(retried.envelope.result.sourceChanged, true);
  assert.equal(retried.envelope.result.artifactHash, original.artifactHash);
  const creates = platform.calls.filter((call) => call.name === 'apps.create');
  assert.equal(creates.length, 2);
  assert.equal(creates[0].key, creates[1].key);
  assert.equal(platform.releases.size, 1);
  assert.equal(platform.jobs.size, 1);
});

test('a lost start response resumes the same deployment instead of starting another job', async (t) => {
  const platform = await setup(t, { lostResponse: 'deployments.start' });
  const first = await platform.run();
  assert.equal(first.code, 1);
  const pending = await platform.pending();
  assert.equal(pending.releaseId, 'release-1');
  assert.equal(pending.deploymentId, null);
  const second = await platform.run();
  assert.equal(second.code, 0, second.stdout);
  const starts = platform.calls.filter((call) => call.name === 'deployments.start');
  assert.equal(starts.length, 2);
  assert.equal(starts[0].key, starts[1].key);
  assert.equal(platform.jobs.size, 1);
  assert.equal(platform.calls.filter((call) => call.name === 'releases.upload').length, 1);
});

test('failed deployment reports resumable IDs and retry resumes that job through verification', async (t) => {
  const platform = await setup(t, { failJob: true });
  const first = await platform.run();
  assert.equal(first.code, 1);
  assert.equal(first.envelope.error.code, 'provider_unavailable');
  assert.equal(first.envelope.error.details.deploymentId, 'job-1');
  assert.equal(first.envelope.error.details.appId, 'app-1');
  const second = await platform.run();
  assert.equal(second.code, 0, second.stdout);
  assert.equal(platform.resumeCount, 1);
  assert.equal(platform.verifyCount, 1);
  assert.equal(platform.jobs.size, 1);
  assert.equal(platform.calls.filter((call) => call.name === 'deployments.start').length, 1);
});

test('lost verification response is reconciled by job status with current credentials', async (t) => {
  const platform = await setup(t, { lostResponse: 'deployments.verify' });
  assert.equal((await platform.run()).code, 1);
  assert.equal((await platform.pending()).deploymentId, 'job-1');
  const result = await platform.run();
  assert.equal(result.code, 0, result.stdout);
  assert.equal(platform.verifyCount, 1);
  assert.equal((await platform.lock()).activeReleaseId, 'release-1');
});

test('later deployment retains app identity and pins the last observed live release', async (t) => {
  const platform = await setup(t);
  assert.equal((await platform.run()).code, 0);
  await writeFile(join(platform.directory, 'public/index.html'), '<h1>Second release</h1>');
  assert.equal((await platform.run()).code, 0);
  assert.equal(platform.calls.filter((call) => call.name === 'apps.create').length, 1);
  assert.deepEqual(platform.calls.filter((call) => call.name === 'deployments.start').map((call) => call.input.expectedReleaseId), [null, 'release-1']);
  assert.equal((await platform.lock()).activeReleaseId, 'release-2');
  platform.app.activeReleaseId = 'teammate-release';
  const stale = await platform.run();
  assert.equal(stale.code, 1);
  assert.equal(stale.envelope.error.code, 'release_conflict');
  assert.equal(platform.jobs.size, 2);
  assert.equal(platform.releases.size, 2);
});

test('multiple workspaces require an explicit selection before any mutation', async (t) => {
  const platform = await setup(t, { workspaces: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }] });
  const first = await platform.run();
  assert.equal(first.code, 1);
  assert.equal(first.envelope.error.code, 'workspace_required');
  assert.equal(platform.mutationSnapshots.length, 0);
  const selected = await platform.run('--workspace', 'two');
  assert.equal(selected.code, 0, selected.stdout);
  assert.equal((await platform.lock()).workspaceId, 'two');
});

test('a legacy lock is preserved and blocks replacement app creation', async (t) => {
  const platform = await setup(t);
  const legacy = { version: 1, provider: 'atrax-instant', appId: 'old-app', worker: { name: 'old', url: 'https://old.atrax.test' } };
  await writeFile(join(platform.directory, 'atrax.lock.json'), JSON.stringify(legacy));
  const result = await platform.run();
  assert.equal(result.code, 1);
  assert.equal(result.envelope.error.code, 'unsupported_app_link');
  assert.deepEqual(await platform.lock(), legacy);
  assert.equal(platform.mutationSnapshots.length, 0);
});

test('an API mismatch in the app lock blocks deployment without altering the app', async (t) => {
  const platform = await setup(t);
  await writeFile(join(platform.directory, 'atrax.lock.json'), JSON.stringify({ version: 2, apiOrigin: 'https://different.atrax.test', workspaceId: 'workspace-1', appId: 'app-1', url: 'https://team-app.atrax.test', activeReleaseId: null }));
  const result = await platform.run();
  assert.equal(result.code, 1);
  assert.equal(result.envelope.error.code, 'api_origin_conflict');
  assert.equal(platform.mutationSnapshots.length, 0);
});
