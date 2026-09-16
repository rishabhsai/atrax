import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir, mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {bundlePlatform, localMailboxSource, localWorker, migrateControlPlane} from '../../cli/local-platform.mjs';
import {providerApi} from './provider-api.mjs';

const cli = resolve(import.meta.dirname, '../../bin/atrax.mjs');
const consoleOrigin = 'https://console.atrax.test';
const json = value => ({type: 'json', value});
const service = (worker, exportName) => ({type: 'worker', worker, ...(exportName ? {exportName} : {})});
export const httpResult = outcome => {assert.equal(outcome.status, 200, JSON.stringify(outcome.body)); return outcome.body.result;};
export const cliResult = outcome => {assert.equal(outcome.code, 0, outcome.stdout + outcome.stderr); return outcome.envelope.result;};
export const toolResult = outcome => {assert.notEqual(outcome.isError, true, JSON.stringify(outcome)); return outcome.structuredContent;};

export async function recipePlatform(t) {
  const directory = await mkdtemp(join(tmpdir(), 'atrax-recipes-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const provider = providerApi();
  const [controlSource, gatewaySource] = await Promise.all([bundlePlatform('control-plane/src/index.js'), bundlePlatform('gateway/src/index.js')]);
  const apps = new Map();
  let mf, db, proxyError, lostResponse;
  const control = localWorker('control-plane', controlSource, {
    CP_DB: {type: 'd1', id: 'recipes-control'},
    ARTIFACTS: {type: 'r2', name: 'recipes-artifacts'},
    LIBRARY_FILES: {type: 'r2', name: 'recipes-library'},
    DEPLOYMENTS: {type: 'durable-object', worker: 'control-plane', exportName: 'DeploymentCoordinator'},
    CONSOLE_ORIGIN: json(consoleOrigin), EMAIL_FROM: json('test@example.com'), EMAIL: service('mailbox', 'Mail'),
    CF_API_TOKEN: json('local-provider-token'), CP_ACCOUNT_ID: json('account'), CP_ZONE_ID: json('zone'),
    APP_DOMAIN: json('apps.atrax.test'), ARTIFACT_BUCKET: json('recipes-artifacts'), CONTROL_PLANE_NAME: json('control-plane'),
  });
  control.config.exports = {DeploymentCoordinator: {type: 'durable-object', storage: 'sqlite'}};
  control.dev = {outboundService: {type: 'fetcher', handler: async request => {
    if (new URL(request.url).hostname === 'api.cloudflare.com') return provider.fetch(request);
    const hostname = new URL(request.url).hostname;
    const domain = provider.domains.get(hostname);
    assert.ok(domain, `Unexpected external request: ${request.url}`);
    const uploaded = provider.workers.get(domain.service);
    assert.equal(uploaded.source, gatewaySource, 'Run the trusted gateway actually sent to the provider');
    const appId = uploaded.metadata.bindings.find(binding => binding.name === 'APP_ID').text;
    const app = apps.get(appId);
    const releaseId = uploaded.metadata.bindings.find(binding => binding.name === 'RELEASE_ID').text;
    const release = app.releases.get(releaseId);
    const host = await db.prepare('SELECT kind FROM app_hosts WHERE hostname=?').bind(hostname).first();
    return (await mf.getWorker(host?.kind === 'live' ? release.liveGateway : release.candidateGateway)).fetch(request);
  }}};

  const options = {host: '127.0.0.1', port: 0, resourcePersistencePath: join(directory, 'state')};
  const workers = () => [control, localWorker('mailbox', localMailboxSource), ...[...apps.values()].flatMap(app => app.workers)];
  mf = new Miniflare({...options, workers: workers()});
  t.after(() => mf.dispose());
  db = await mf.getD1Database('CP_DB', 'control-plane');
  await migrateControlPlane(db);

  provider.database = async id => {
    const stored = [...provider.databases.values()].find(database => database.uuid === id);
    assert.ok(stored, `Unknown provider database ${id}`);
    let binding;
    const candidate = stored.name.startsWith('check-');
    if (candidate) {
      const job = await db.prepare("SELECT app_id,release_id FROM deployments WHERE replace(deployment_id,'-','')=?").bind(stored.name.slice(6)).first();
      binding = apps.get(job.app_id)?.releases.get(job.release_id)?.candidateBinding;
    } else binding = [...apps.values()].find(value => `data-${value.appId.replaceAll('-', '')}` === stored.name)?.liveBinding;
    assert.ok(binding, `Unknown app database ${stored.name}`);
    return mf.getD1Database(binding, 'control-plane');
  };

  // Register the uploaded artifact only after the real upload operation completed,
  // before the CLI starts deployment. D1/R2 and the control Worker survive reload.
  async function registerRelease(input, release) {
    if (apps.get(input.appId)?.releases.has(release.id)) return;
    const record = await db.prepare('SELECT workspace_id FROM apps WHERE app_id=?').bind(input.appId).first();
    let app = apps.get(input.appId);
    if (!app) {
      app = {appId: input.appId, index: apps.size, liveBinding: `LIVE_${apps.size}`, releases: new Map(), workers: []};
      apps.set(input.appId, app);
    }
    const suffix = `${app.index}-${app.releases.size}`;
    const registered = {liveGateway: `live-${suffix}`, candidateGateway: `candidate-${suffix}`, candidateBinding: `CANDIDATE_${suffix.replaceAll('-', '_')}`};
    for (const candidate of [true, false]) {
      const name = candidate ? registered.candidateGateway : registered.liveGateway;
      const databaseId = candidate ? `recipes-${name}` : `recipes-live-${app.index}`;
      control.config.env[candidate ? registered.candidateBinding : app.liveBinding] = {type: 'd1', id: databaseId};
      const gatewayEnv = {
        APP_ID: json(input.appId), RELEASE_ID: json(release.id), WORKSPACE_ID: json(record.workspace_id),
        CONFIG_KEY: json(`config/${input.artifact.hash}.json`), CONSOLE_ORIGIN: json(consoleOrigin),
        ARTIFACTS: {type: 'r2', name: 'recipes-artifacts'}, DOOR: service('control-plane', 'Door'),
      };
      if (input.artifact.runtime) {
        gatewayEnv.RUNTIME = service(`runtime-${name}`, 'AppRuntime');
        app.workers.push(localWorker(`runtime-${name}`, input.artifact.runtime, {DB: {type: 'd1', id: databaseId}}));
      }
      app.workers.push(localWorker(name, gatewaySource, gatewayEnv));
    }
    app.releases.set(release.id, registered);
    await mf.setOptions({...options, workers: workers()});
    db = await mf.getD1Database('CP_DB', 'control-plane');
  }

  const calls = [];
  const server = createServer(async (request, response) => {
    try {
      let body = '';
      for await (const chunk of request) body += chunk;
      const upstream = await fetch(`${(await mf.ready).origin}${request.url}`, {method: request.method, headers: request.headers, ...(body ? {body} : {})});
      const bytes = await upstream.text();
      const result = JSON.parse(bytes);
      const name = decodeURIComponent(request.url.split('/').at(-1));
      const input = body ? JSON.parse(body) : {};
      calls.push({name, input, key: request.headers['idempotency-key'], status: upstream.status, body: result});
      if (name === 'releases.upload' && upstream.ok) await registerRelease(input, result.result.release);
      if (name === lostResponse) {
        lostResponse = undefined;
        request.socket.destroy();
        return;
      }
      // fetch decoded the body; transport encoding/length headers no longer apply.
      response.writeHead(upstream.status, {'Content-Type': 'application/json', ...(upstream.headers.has('set-cookie') ? {'Set-Cookie': upstream.headers.getSetCookie()} : {})});
      response.end(bytes);
    } catch (error) {
      proxyError = error;
      response.writeHead(500, {'Content-Type': 'application/json'});
      response.end(JSON.stringify({status: 'failed', error: {code: 'fixture_error', message: error.message}}));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));});
  const origin = `http://127.0.0.1:${server.address().port}`;
  const people = {};
  const config = person => join(directory, `config-${person}`);
  const observedMail = new Map();
  const mailbox = async () => {
    const current = await (await (await mf.getWorker('mailbox')).fetch('https://mailbox.test')).json();
    for (const mail of current) observedMail.set(JSON.stringify(mail), mail);
    return [...observedMail.values()];
  };
  async function call(name, input = {}, person, key = crypto.randomUUID()) {
    const response = await fetch(`${origin}/v1/operations/${name}`, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: consoleOrigin, 'Idempotency-Key': key, ...(person ? {Cookie: people[person].cookie} : {})}, body: JSON.stringify(input)});
    const result = {status: response.status, body: await response.json(), headers: response.headers};
    assert.ifError(proxyError);
    return result;
  }
  async function signIn(person) {
    httpResult(await call('auth.email.start', {email: `${person}@example.com`}));
    const mail = (await mailbox()).at(-1);
    assert.equal(mail.to, `${person}@example.com`);
    const link = new URL(mail.text.match(/https:\/\/\S+/)[0]);
    const proof = new URLSearchParams(link.hash.slice(1));
    const verified = await call('auth.email.verify', {challengeId: proof.get('challengeId'), secret: proof.get('secret')});
    people[person] = {...httpResult(verified), cookie: verified.headers.get('set-cookie').split(';')[0]};
    return people[person];
  }
  async function run(person, args, {cwd = directory, approve = false, human = false, executable = cli} = {}) {
    await mkdir(config(person), {recursive: true});
    const child = spawn(process.execPath, [executable, ...args, ...(human || args.includes('--json') ? [] : ['--json'])], {cwd, env: {...process.env, ATRAX_API_ORIGIN: origin, ATRAX_CONFIG_DIR: config(person)}, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '', stderr = '', pending = '';
    const approvals = [];
    child.stdout.on('data', chunk => {
      stdout += chunk; pending += chunk;
      while (pending.includes('\n')) {
        const position = pending.indexOf('\n'), line = pending.slice(0, position); pending = pending.slice(position + 1);
        if (approve) {
          const value = JSON.parse(line).result;
          if (value.status === 'authorization_required') approvals.push(call('auth.device.approve', {userCode: value.userCode, decision: 'approve'}, person).then(httpResult));
        }
      }
    });
    child.stderr.on('data', chunk => {stderr += chunk;});
    const code = await new Promise((resolve, reject) => {child.once('error', reject); child.once('close', resolve);});
    await Promise.all(approvals);
    assert.ifError(proxyError);
    return {code, stdout, stderr, envelope: human ? null : JSON.parse(stdout.trim().split('\n').at(-1))};
  }
  async function mcp(person, workspaceId) {
    const transport = new StdioClientTransport({command: process.execPath, args: [cli, 'mcp', ...(workspaceId ? ['--workspace', workspaceId] : [])], env: {...process.env, ATRAX_API_ORIGIN: origin, ATRAX_CONFIG_DIR: config(person)}, stderr: 'pipe'});
    const client = new Client({name: 'recipe-verifier', version: '1.0.0'});
    await client.connect(transport);
    t.after(() => client.close());
    return client;
  }
  async function openApp(person, appId) {
    const app = apps.get(appId);
    const row = await db.prepare('SELECT url,active_release_id FROM apps WHERE app_id=?').bind(appId).first();
    const worker = await mf.getWorker(app.releases.get(row.active_release_id).liveGateway);
    const navigation = await worker.fetch(row.url, {headers: {Accept: 'text/html'}, redirect: 'manual'});
    assert.equal(navigation.status, 302);
    const login = new URL(navigation.headers.get('location'));
    const stateCookie = navigation.headers.get('set-cookie').split(';')[0];
    const allowed = await call('apps.login', {appId, hostname: new URL(row.url).hostname, state: login.searchParams.get('state')}, person);
    if (allowed.status !== 200) return allowed;
    const callback = await worker.fetch(httpResult(allowed).redirectUrl, {headers: {Cookie: stateCookie}, redirect: 'manual'});
    assert.equal(callback.status, 302, await callback.clone().text());
    const response = await worker.fetch(row.url, {headers: {Cookie: callback.headers.get('set-cookie').split(';')[0]}});
    return {status: response.status, body: await response.text()};
  }
  return {directory, origin, get db() {return db;}, mf, provider, calls, people, apps, call, run, signIn, mailbox, mcp, openApp, loseResponse(name) {lostResponse = name;}, credentials: async person => JSON.parse(await readFile(join(config(person), 'credentials.json'), 'utf8'))};
}
