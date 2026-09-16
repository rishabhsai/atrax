import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { canonicalJson } from '../shared/app-contract.js';
import {rpcResult,unwrapRpc} from '../shared/rpc-result.js';

const root = resolve(import.meta.dirname, '..');
const compatibilityDate = '2026-07-29';
const appSessionToken = 'a'.repeat(64);
const loginCode = 'b'.repeat(64);

const doorFixture = `
import { WorkerEntrypoint } from 'cloudflare:workers';

function deny(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  throw error;
}

async function sessionFor(env, credential) {
  let token = credential?.kind === 'bearer' ? credential.token : null;
  if (!token && credential?.kind === 'cookie') {
    token = /(?:^|;\\s*)(?:atrax_session|__Host-atrax_app)=([^;]+)/.exec(credential.cookie)?.[1] ?? null;
  }
  if (!token) deny(401, 'unauthorized', 'Sign in required');
  const session = await env.CP_DB.prepare(
    'SELECT id, person_id, email, kind, agent_label FROM sessions WHERE token = ? AND active = 1',
  ).bind(token).first();
  if (!session) deny(401, 'unauthorized', 'Session is no longer active');
  return session;
}

async function allowed(env, personId, appId, actionName) {
  return Boolean(await env.CP_DB.prepare(
    'SELECT 1 AS allowed FROM permissions WHERE person_id = ? AND app_id = ? AND action_name = ? AND allowed = 1',
  ).bind(personId, appId, actionName).first());
}

function result(session, input, invocationId, rootInvocationId, depth, sourceAppId, allowedActions) {
  return {
    person: { id: session.person_id, email: session.email },
    session: { id: session.id, kind: session.kind, agentLabel: session.agent_label },
    workspaceId: 'workspace-1',
    invocationId,
    rootInvocationId,
    depth,
    idempotencyKey: input.idempotencyKey ?? null,
    ...(sourceAppId ? { sourceAppId } : {}),
    ...(allowedActions ? { allowedActions } : {}),
  };
}

export class Door extends WorkerEntrypoint {
  async authorize(input) {
    try {
      return { ok: true, authorization: await this.#authorize(input) };
    } catch (error) {
      if (Number.isInteger(error.status) && typeof error.code === 'string') {
        return { ok: false, error: { code: error.code, status: error.status, message: error.message } };
      }
      throw error;
    }
  }

  async #authorize(input) {
    if (input.kind === 'http') {
      if (input.requireMaintenance === true) {
        await this.env.CP_DB.prepare('INSERT INTO maintenance_checks VALUES (1)').run();
      }
      const session = await sessionFor(this.env, input.credential);
      if (input.actionName === null) {
        const rows = await this.env.CP_DB.prepare(
          'SELECT action_name FROM permissions WHERE person_id = ? AND app_id = ? AND allowed = 1 ORDER BY action_name',
        ).bind(session.person_id, input.appId).all();
        if (!rows.results.length) deny(403, 'access_denied', 'App access denied');
        return result(session, input, null, null, 0, null, rows.results.map((row) => row.action_name));
      }
      if (!await allowed(this.env, session.person_id, input.appId, input.actionName)) {
        deny(403, 'access_denied', 'Action access denied');
      }
      const invocationId = crypto.randomUUID();
      await this.env.CP_DB.prepare(
        'INSERT INTO invocations (id, root_id, parent_id, person_id, session_id, source_app_id, app_id, active, depth) VALUES (?, ?, NULL, ?, ?, NULL, ?, 1, 0)',
      ).bind(invocationId, invocationId, session.person_id, session.id, input.appId).run();
      return result(session, input, invocationId, invocationId, 0);
    }

    if (input.kind === 'child') {
      const parent = await this.env.CP_DB.prepare(
        'SELECT i.*, s.email, s.kind, s.agent_label FROM invocations i JOIN sessions s ON s.id = i.session_id WHERE i.id = ? AND i.active = 1 AND s.active = 1',
      ).bind(input.parentInvocationId).first();
      if (!parent || parent.app_id !== input.sourceAppId) deny(403, 'access_denied', 'Parent invocation is not active');
      if (!await allowed(this.env, parent.person_id, input.appId, input.actionName)) {
        deny(403, 'access_denied', 'Delegated action access denied');
      }
      const invocationId = crypto.randomUUID();
      await this.env.CP_DB.prepare(
        'INSERT INTO invocations (id, root_id, parent_id, person_id, session_id, source_app_id, app_id, active, depth) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)',
      ).bind(invocationId, parent.root_id, parent.id, parent.person_id, parent.session_id, input.sourceAppId, input.appId, parent.depth + 1).run();
      const session = { id: parent.session_id, person_id: parent.person_id, email: parent.email, kind: parent.kind, agent_label: parent.agent_label };
      return result(session, input, invocationId, parent.root_id, parent.depth + 1, input.sourceAppId);
    }
    deny(400, 'invalid_authorization_request', 'Unknown authorization kind');
  }

  async finishInvocation({ invocationId, outcome, errorCode }) {
    await this.env.CP_DB.prepare(
      'UPDATE invocations SET active = 0, outcome = ?, error_code = ? WHERE id = ?',
    ).bind(outcome, errorCode ?? null, invocationId).run();
  }

  async exchangeAppCode(input) {
    const row = await this.env.CP_DB.prepare(
      'SELECT * FROM login_codes WHERE code = ? AND state = ? AND app_id = ? AND callback = ? AND active = 1',
    ).bind(input.code, input.state, input.appId, input.callbackUrl).first();
    if (!row) return { ok: false, error: { code: 'invalid_app_code', status: 401, message: 'App sign-in code is invalid' } };
    await this.env.CP_DB.prepare('UPDATE login_codes SET active = 0 WHERE code = ?').bind(input.code).run();
    await this.env.CP_DB.prepare(
      'INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?, 1)',
    ).bind('session-app', '${appSessionToken}', 'person-alice', 'alice@example.com', 'app', null).run();
    return { ok: true, session: { token: '${appSessionToken}', expiresAt: Date.now() + 3600000 } };
  }
}
`;

const runtimeFixture = `
import { WorkerEntrypoint } from 'cloudflare:workers';
const rpcResult=${rpcResult.toString()};
const unwrapRpc=${unwrapRpc.toString()};
let escapedCapability;

export default class AppRuntime extends WorkerEntrypoint {
  describe() { return this.env.DESCRIPTORS; }

  async invoke(name, input, capability, caller) { return rpcResult(()=>this.run(name,input,capability,caller)); }
  async run(name, input, capability, caller) {
    if (this.env.KIND === 'orders' && name === 'orders.create') {
      await this.env.DB.prepare('INSERT INTO orders (id, quantity) VALUES (?, ?)').bind(input.orderId, input.quantity).run();
      if (input.escape) escapedCapability = capability.dup();
      let reservation = null;
      if (input.reserve) {
        const repeats = input.repeat ?? 1;
        for (let index = 0; index < repeats; index += 1) {
          const childOrderId = repeats === 1 ? input.orderId : input.orderId + '-' + index;
          reservation = unwrapRpc(await capability.call('inventory', 'stock.reserve', { orderId: childOrderId, quantity: input.quantity }, { key: childOrderId }));
        }
      }
      let knowledgeKey = null;
      if (input.knowledge) {
        const knowledge = unwrapRpc(await capability.knowledge('library.entry.create', { title: input.orderId }, { key: caller.idempotencyKey }));
        knowledgeKey = knowledge.idempotencyKey;
      }
      return { created: true, reservation, actorId: caller.person.id, idempotencyKey: caller.idempotencyKey, escaped: Boolean(input.escape), knowledgeKey };
    }
    if (this.env.KIND === 'inventory' && name === 'stock.reserve') {
      await this.env.DB.prepare('INSERT INTO reservations (order_id, quantity) VALUES (?, ?)').bind(input.orderId, input.quantity).run();
      return { reserved: true, actorId: caller.person.id, sourceAppId: caller.chain.sourceAppId };
    }
    throw new Error('Unknown action');
  }

  async replay() {
    if (!escapedCapability) throw new Error('No escaped capability');
    return unwrapRpc(await escapedCapability.call('inventory', 'stock.reserve', { orderId: 'replay', quantity: 1 }, { key: 'replay' }));
  }
}
`;

const libraryFixture = `
import { WorkerEntrypoint } from 'cloudflare:workers';
export class LibraryGateway extends WorkerEntrypoint {
  async invoke(request) {
    return { ok: true, result: { operation: request.operation, idempotencyKey: request.idempotencyKey ?? null } };
  }
}
`;

const assetBytes = new TextEncoder().encode('<h1>protected</h1>');
const assetHash = createHash('sha256').update(assetBytes).digest('hex');
const assetManifest = {
  '/index.html': { hash: assetHash, contentType: 'text/html; charset=utf-8', size: assetBytes.byteLength },
};

const ordersDescriptors = [{
  name: 'orders.create', description: 'Create an order', effect: 'write',
  inputSchema: { type: 'object', required: ['orderId', 'quantity'], properties: {
    orderId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 },
    reserve: { type: 'boolean' }, escape: { type: 'boolean' }, knowledge: { type: 'boolean' }, repeat: { type: 'integer', minimum: 1 },
  }, additionalProperties: false },
  outputSchema: { type: 'object', required: ['created', 'reservation', 'actorId', 'idempotencyKey', 'escaped', 'knowledgeKey'], properties: {
    created: { const: true }, reservation: { anyOf: [{ type: 'null' }, { type: 'object' }] },
    actorId: { type: 'string' }, idempotencyKey: { type: 'string' }, escaped: { type: 'boolean' },
    knowledgeKey: { type: ['string', 'null'] },
  }, additionalProperties: false },
}];

const inventoryDescriptors = [{
  name: 'stock.reserve', description: 'Reserve stock', effect: 'write',
  inputSchema: { type: 'object', required: ['orderId', 'quantity'], properties: {
    orderId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 },
  }, additionalProperties: false },
  outputSchema: { type: 'object', required: ['reserved', 'actorId', 'sourceAppId'], properties: {
    reserved: { const: true }, actorId: { type: 'string' }, sourceAppId: { type: ['string', 'null'] },
  }, additionalProperties: false },
}];

const ordersConfig = {
  manifest: { version: 2, name: 'orders', web: { assets: 'dist', fallback: 'index.html' }, actions: { entry: 'actions.js' }, dependencies: { inventory: { appId: 'inventory-app' } } },
  actions: ordersDescriptors,
  assets: assetManifest,
  assetPrefix: 'assets/orders-r1/',
};
const inventoryConfig = {
  manifest: { version: 2, name: 'inventory', web: { assets: 'dist', fallback: 'index.html' }, actions: { entry: 'actions.js' } },
  actions: inventoryDescriptors,
  assets: assetManifest,
  assetPrefix: 'assets/inventory-r1/',
};

function worker(name, mainModule, contents, env = {}) {
  return { config: { type: 'worker', name, compatibilityDate, manifest: {
    mainModule, modules: { [mainModule]: { type: 'esm', contents } },
  }, env } };
}

async function start(t) {
  const built = await build({
    entryPoints: [resolve(root, 'gateway/src/index.js')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['cloudflare:workers'],
    write: false,
  });
  const gatewaySource = built.outputFiles[0].text;
  const service = (workerName, exportName) => ({ type: 'worker', worker: workerName, ...(exportName ? { exportName } : {}) });
  const json = (value) => ({ type: 'json', value });
  const mf = new Miniflare({ workers: [
    worker('orders-gateway', 'gateway.js', gatewaySource, {
      APP_ID: json('orders-app'), RELEASE_ID: json('orders-r1'), WORKSPACE_ID: json('workspace-1'),
      CONFIG_KEY: json('configs/orders-r1.json'), CONSOLE_ORIGIN: json('https://console.test'),
      DOOR: service('door', 'Door'), RUNTIME: service('orders-runtime'),
      ARTIFACTS: { type: 'r2', name: 'artifacts' }, DEP_INVENTORY: service('inventory-gateway', 'TargetGateway'),
      LIBRARY: service('library', 'LibraryGateway'),
    }),
    worker('inventory-gateway', 'gateway.js', gatewaySource, {
      APP_ID: json('inventory-app'), RELEASE_ID: json('inventory-r1'), WORKSPACE_ID: json('workspace-1'),
      CONFIG_KEY: json('configs/inventory-r1.json'), CONSOLE_ORIGIN: json('https://console.test'),
      DOOR: service('door', 'Door'), RUNTIME: service('inventory-runtime'), ARTIFACTS: { type: 'r2', name: 'artifacts' },
    }),
    worker('orders-runtime', 'runtime.js', runtimeFixture, { KIND: json('orders'), DESCRIPTORS: json(ordersDescriptors), DB: { type: 'd1', id: 'orders-db' } }),
    worker('inventory-runtime', 'runtime.js', runtimeFixture, { KIND: json('inventory'), DESCRIPTORS: json(inventoryDescriptors), DB: { type: 'd1', id: 'inventory-db' } }),
    worker('door', 'door.js', doorFixture, { CP_DB: { type: 'd1', id: 'door-db' } }),
    worker('library', 'library.js', libraryFixture),
  ] });
  t.after(() => mf.dispose());

  const cp = await mf.getD1Database('CP_DB', 'door');
  await cp.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, token TEXT UNIQUE, person_id TEXT, email TEXT, kind TEXT, agent_label TEXT, active INTEGER);
    CREATE TABLE permissions (person_id TEXT, app_id TEXT, action_name TEXT, allowed INTEGER, PRIMARY KEY (person_id, app_id, action_name));
    CREATE TABLE invocations (id TEXT PRIMARY KEY, root_id TEXT, parent_id TEXT, person_id TEXT, session_id TEXT, source_app_id TEXT, app_id TEXT, active INTEGER, depth INTEGER, outcome TEXT, error_code TEXT);
    CREATE TABLE login_codes (code TEXT PRIMARY KEY, state TEXT, app_id TEXT, callback TEXT, active INTEGER);
    CREATE TABLE maintenance_checks (required INTEGER);
    INSERT INTO sessions VALUES ('session-alice', 'token-alice', 'person-alice', 'alice@example.com', 'agent', 'Test agent', 1);
    INSERT INTO permissions VALUES ('person-alice', 'orders-app', 'orders.create', 1);
    INSERT INTO permissions VALUES ('person-alice', 'inventory-app', 'stock.reserve', 0);
  `);
  await (await mf.getD1Database('DB', 'orders-runtime')).exec('CREATE TABLE orders (id TEXT PRIMARY KEY, quantity INTEGER NOT NULL);');
  await (await mf.getD1Database('DB', 'inventory-runtime')).exec('CREATE TABLE reservations (order_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL);');
  const artifacts = await mf.getR2Bucket('ARTIFACTS', 'orders-gateway');
  await artifacts.put('configs/orders-r1.json', JSON.stringify(ordersConfig));
  await artifacts.put('configs/inventory-r1.json', JSON.stringify(inventoryConfig));
  await artifacts.put(`assets/orders-r1/${assetHash}`, assetBytes);
  await artifacts.put(`assets/inventory-r1/${assetHash}`, assetBytes);

  async function request(path, { method = 'GET', body, token = 'token-alice', key, accept, cookie } = {}) {
    const response = await mf.dispatchFetch(`https://orders.test${path}`, {
      method,
      redirect: 'manual',
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
        ...(accept ? { accept } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const type = response.headers.get('content-type') ?? '';
    return {
      status: response.status,
      headers: response.headers,
      body: type.includes('json') ? await response.json() : await response.text(),
    };
  }
  async function setInventoryAccess(allowed) {
    await cp.prepare("UPDATE permissions SET allowed = ? WHERE person_id = 'person-alice' AND app_id = 'inventory-app' AND action_name = 'stock.reserve'").bind(allowed ? 1 : 0).run();
  }
  async function activeInvocations() {
    return (await cp.prepare('SELECT count(*) AS count FROM invocations WHERE active = 1').first()).count;
  }
  async function revokeSession() {
    await cp.prepare("UPDATE sessions SET active = 0 WHERE id = 'session-alice'").run();
  }
  async function addLoginCode(state) {
    await cp.prepare('INSERT INTO login_codes VALUES (?, ?, ?, ?, 1)')
      .bind(loginCode, state, 'orders-app', 'https://orders.test/__atrax/auth/callback').run();
  }
  async function maintenanceChecks() {
    return (await cp.prepare('SELECT count(*) AS count FROM maintenance_checks').first()).count;
  }
  return { mf, cp, request, setInventoryAccess, activeInvocations, revokeSession, addLoginCode, maintenanceChecks };
}

test('gateway authenticates metadata and assets and validates the named action boundary', async (t) => {
  const api = await start(t);
  assert.equal((await api.request('/__atrax/actions', { token: null })).status, 401);
  const discovery = await api.request('/__atrax/actions');
  assert.equal(discovery.status, 200, JSON.stringify(discovery.body));
  assert.deepEqual(discovery.body.actions.map(({ name }) => name), ['orders.create']);
  assert.equal((await api.request('/', { token: null })).status, 401);
  const asset = await api.request('/');
  assert.equal(asset.body, '<h1>protected</h1>');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('cache-control'), 'private, no-store');
  assert.equal(asset.headers.get('content-type'), 'text/html; charset=utf-8');
  const assetHead = await api.request('/index.html', { method: 'HEAD' });
  assert.equal(assetHead.status, 200);
  assert.equal(assetHead.body, '');
  assert.equal(assetHead.headers.get('content-length'), String(assetBytes.byteLength));
  const routeFallback = await api.request('/orders/42', { accept: 'text/html' });
  assert.equal(routeFallback.body, '<h1>protected</h1>');
  assert.equal((await api.request('/missing.js', { accept: 'text/html' })).status, 404);
  assert.equal((await api.request('/orders/42', { accept: 'application/json' })).status, 404);
  assert.equal((await api.request('/api/arbitrary', { method: 'POST', body: {} })).status, 404);
  const inventoryGateway = await api.mf.getWorker('inventory-gateway');
  const spoofed = await inventoryGateway.fetch('https://inventory.test/invokeDelegated', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-session-id': 'session-alice' },
    body: JSON.stringify({ parentInvocationId: 'forged', actionName: 'stock.reserve' }),
  });
  assert.equal(spoofed.status, 404);
  assert.equal((await api.request('/__atrax/actions/orders.create', { method: 'POST', body: { orderId: 'o1', quantity: 1 } })).body.error.code, 'idempotency_key_required');
  const invalid = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'invalid', body: { orderId: 'o1', quantity: 0 } });
  assert.equal(invalid.body.error.code, 'invalid_action_input');
  const created = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'create-o1', body: { orderId: 'o1', quantity: 1, knowledge: true } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.result.actorId, 'person-alice');
  assert.equal(created.body.result.idempotencyKey, 'create-o1');
  assert.equal(created.body.result.knowledgeKey, 'create-o1');
  assert.equal(created.body.result.reservation, null);
});

test('browser navigation signs in through a state-bound one-time app code', async (t) => {
  const api = await start(t);
  const action = await api.request('/__atrax/actions/orders.create', {
    method: 'POST', token: null, accept: 'text/html', key: 'anonymous',
    body: { orderId: 'anonymous', quantity: 1 },
  });
  assert.equal(action.status, 401);
  assert.equal(action.body.error.code, 'unauthorized');

  const started = await api.request('/orders/42?tab=open', { token: null, accept: 'text/html' });
  assert.equal(started.status, 302);
  const destination = new URL(started.headers.get('location'));
  assert.equal(destination.origin, 'https://console.test');
  assert.equal(destination.pathname, '/auth/app');
  assert.equal(destination.searchParams.get('appId'), 'orders-app');
  assert.equal(destination.searchParams.get('hostname'), 'orders.test');
  const state = destination.searchParams.get('state');
  assert.match(state, /^[a-f0-9]{64}$/);
  const loginCookie = started.headers.get('set-cookie').split(';', 1)[0];
  assert.match(started.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/);

  const missingCookie = await api.request(
    `/__atrax/auth/callback?code=${loginCode}&state=${state}`,
    { token: null },
  );
  assert.equal(missingCookie.status, 400);
  assert.equal(missingCookie.body.error.code, 'login_state_missing');
  const wrongState = await api.request(
    `/__atrax/auth/callback?code=${loginCode}&state=${'c'.repeat(64)}`,
    { token: null, cookie: loginCookie },
  );
  assert.equal(wrongState.status, 400);
  assert.equal(wrongState.body.error.code, 'login_state_mismatch');
  const externalPath = btoa('//evil.example/path').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const forgedReturn = await api.request(
    `/__atrax/auth/callback?code=${loginCode}&state=${state}`,
    { token: null, cookie: `__Host-atrax_app_login=${state}.${externalPath}` },
  );
  assert.equal(forgedReturn.status, 400);
  assert.equal(forgedReturn.body.error.code, 'login_return_invalid');

  await api.addLoginCode(state);
  const completed = await api.request(
    `/__atrax/auth/callback?code=${loginCode}&state=${state}`,
    { token: null, cookie: loginCookie },
  );
  assert.equal(completed.status, 302, JSON.stringify(completed.body));
  assert.equal(completed.headers.get('location'), '/orders/42?tab=open');
  const issuedCookies = completed.headers.getSetCookie?.() ?? [completed.headers.get('set-cookie')];
  assert.equal(issuedCookies.some((value) => value.startsWith('__Host-atrax_app=')), true);
  assert.equal(issuedCookies.some((value) => value.startsWith('__Host-atrax_app_login=;')), true);
  const appCookie = `__Host-atrax_app=${appSessionToken}`;
  const asset = await api.request('/', { token: null, cookie: appCookie });
  assert.equal(asset.status, 200);
  assert.equal(asset.body, '<h1>protected</h1>');

  const replayed = await api.request(
    `/__atrax/auth/callback?code=${loginCode}&state=${state}`,
    { token: null, cookie: loginCookie },
  );
  assert.equal(replayed.status, 401);
  assert.equal(replayed.body.error.code, 'invalid_app_code');
});

test('maintenance health hashes descriptors from the private runtime', async (t) => {
  const api = await start(t);
  const anonymous = await api.request('/__atrax/health', { token: null, accept: 'text/html' });
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.error.code, 'unauthorized');
  const health = await api.request('/__atrax/health');
  assert.equal(health.status, 200, JSON.stringify(health.body));
  assert.equal(health.body.appId, 'orders-app');
  assert.equal(health.body.releaseId, 'orders-r1');
  assert.equal(
    health.body.descriptorHash,
    createHash('sha256').update(canonicalJson(ordersDescriptors)).digest('hex'),
  );
  assert.equal(health.headers.get('cache-control'), 'private, no-store');
  assert.equal(await api.maintenanceChecks(), 2);
});

test('target gateway rechecks current Door policy for every cross-app action', async (t) => {
  const api = await start(t);
  const denied = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'denied', body: { orderId: 'denied', quantity: 1, reserve: true } });
  assert.equal(denied.status, 403, JSON.stringify(denied.body));
  assert.equal(denied.body.error.code, 'access_denied');
  assert.equal(await api.activeInvocations(), 0);
  await api.setInventoryAccess(true);
  const allowed = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'allowed', body: { orderId: 'allowed', quantity: 1, reserve: true } });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
  assert.deepEqual(allowed.body.result.reservation, { reserved: true, actorId: 'person-alice', sourceAppId: 'orders-app' });
  assert.equal(await api.activeInvocations(), 0);
  await api.setInventoryAccess(false);
  const revoked = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'revoked', body: { orderId: 'revoked', quantity: 1, reserve: true } });
  assert.equal(revoked.status, 403, JSON.stringify(revoked.body));
  assert.equal(revoked.body.error.code, 'access_denied');
  assert.equal(await api.activeInvocations(), 0);
  await api.revokeSession();
  const signedOut = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'signed-out', body: { orderId: 'signed-out', quantity: 1 } });
  assert.equal(signedOut.status, 401, JSON.stringify(signedOut.body));
  assert.equal(signedOut.body.error.code, 'unauthorized');
});

test('closed request capability denies a duplicated runtime stub after completion', async (t) => {
  const api = await start(t);
  await api.setInventoryAccess(true);
  const response = await api.request('/__atrax/actions/orders.create', { method: 'POST', key: 'escape', body: { orderId: 'escape', quantity: 1, escape: true } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const runtime = await api.mf.getWorker('orders-runtime');
  await assert.rejects(async () => runtime.replay(), /closed|disposed|request/i);
});

test('request capability enforces its per-action call budget', async (t) => {
  const api = await start(t);
  await api.setInventoryAccess(true);
  const response = await api.request('/__atrax/actions/orders.create', {
    method: 'POST', key: 'too-many',
    body: { orderId: 'too-many', quantity: 1, reserve: true, repeat: 5 },
  });
  assert.equal(response.status, 429, JSON.stringify(response.body));
  assert.equal(response.body.error.code, 'action_call_limit');
  assert.equal(await api.activeInvocations(), 0);
});
