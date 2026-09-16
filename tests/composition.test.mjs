import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Miniflare } from 'miniflare';
import { buildApp } from '../cli/build.mjs';
import { bundlePlatform, localWorker, migrateControlPlane } from '../cli/local-platform.mjs';
import { applyMigrations } from '../runtime/migrations.js';

async function company(t) {
  const directory = await mkdtemp(join(tmpdir(), 'atrax-composition-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const artifacts = {};
  for (const name of ['inventory', 'orders']) {
    const folder = join(directory, name);
    await cp(new URL(`../templates/${name}/`, import.meta.url), folder, { recursive: true });
    const manifestPath = join(folder, 'atrax.json');
    await writeFile(manifestPath, (await readFile(manifestPath, 'utf8')).replaceAll('__APP_NAME__', name).replaceAll('inventory-app-id', 'inventory-app'));
    artifacts[name] = await buildApp(folder);
  }
  const gateway = await bundlePlatform('gateway/src/index.js');
  const service = (worker, exportName) => ({ type: 'worker', worker, ...(exportName ? { exportName } : {}) });
  const json = (value) => ({ type: 'json', value });
  let mf;
  const control=localWorker('door', await bundlePlatform('control-plane/src/index.js'), { CP_DB: { type: 'd1', id: 'company' },CONSOLE_ORIGIN:json('https://console.atrax.test') });
  control.dev={outboundService:{type:'fetcher',handler:async request=>{
    const name=new URL(request.url).hostname.split('.')[0];
    if(!['inventory','orders'].includes(name)) return new Response('Unknown test host',{status:502});
    return mf.dispatchFetch(request);
  }}};
  const workers = [control];
  for (const name of ['inventory', 'orders']) {
    workers.push(localWorker(`${name}-runtime`, artifacts[name].runtime, { DB: { type: 'd1', id: name } }));
    const gatewayWorker = localWorker(`${name}-gateway`, gateway, {
      APP_ID: json(`${name}-app`), RELEASE_ID: json(`${name}-release`), WORKSPACE_ID: json('company'),
      CONFIG_KEY: json(`config/${name}.json`), CONSOLE_ORIGIN: json('https://console.atrax.test'),
      ARTIFACTS: { type: 'r2', name: 'artifacts' }, DOOR: service('door', 'Door'), RUNTIME: service(`${name}-runtime`, 'AppRuntime'),
      ...(name === 'orders' ? { DEP_INVENTORY: service('inventory-gateway', 'TargetGateway') } : {}),
    });
    gatewayWorker.config.triggers = [{ type: 'fetch', pattern: `https://${name}.atrax.test/*` }];
    workers.push(gatewayWorker);
  }
  mf = new Miniflare({ workers });
  t.after(() => mf.dispose());
  const cpDb = await mf.getD1Database('CP_DB', 'door');
  await migrateControlPlane(cpDb);
  const token = 'a'.repeat(64);
  const browserToken = 'b'.repeat(64);
  const appToken = 'c'.repeat(64);
  const now = Date.now();
  await cpDb.batch([
    cpDb.prepare("INSERT INTO people(person_id,email,verified_at,created_at) VALUES('owner','owner@example.com',?,?),('employee','employee@example.com',?,?)").bind(now, now, now, now),
    cpDb.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)").bind(now),
    cpDb.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','employee','member','active',?)").bind(now, now),
    cpDb.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,agent_label,created_at,expires_at) VALUES('employee-agent',?,'employee','agent','Office agent',?,?),('employee-browser',?,'employee','browser',NULL,?,?)").bind(createHash('sha256').update(token).digest('hex'), now, now + 3600000, createHash('sha256').update(browserToken).digest('hex'), now, now + 3600000),
  ]);
  const data = {};
  for (const name of ['inventory', 'orders']) {
    const artifact = artifacts[name];
    await cpDb.batch([
      cpDb.prepare("INSERT INTO apps(app_id,workspace_id,name,slug,gateway_name,url,status,audience,created_by,created_at,updated_at,active_release_id) VALUES(?,'company',?,?,?,?,'ready','workspace','owner',?,?,?)").bind(`${name}-app`, name, name, `${name}-gateway`, `https://${name}.atrax.test`, now, now, `${name}-release`),
      cpDb.prepare("INSERT INTO app_hosts(hostname,app_id,kind) VALUES(?,?,'live')").bind(`${name}.atrax.test`, `${name}-app`),
      cpDb.prepare('INSERT INTO releases(release_id,app_id,artifact_hash,artifact_key,manifest_json,actions_json,migrations_json,created_by,created_at) VALUES(?,?,?,?,?,?,?,\'owner\',?)').bind(`${name}-release`, `${name}-app`, artifact.hash, `releases/${artifact.hash}.json`, JSON.stringify(artifact.manifest), JSON.stringify(artifact.actions), JSON.stringify(artifact.migrations), now),
      ...artifact.actions.map((action) => cpDb.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind(`${name}-app`, action.name)),
    ]);
    const bucket = await mf.getR2Bucket('ARTIFACTS', `${name}-gateway`);
    const assets = Object.fromEntries(Object.entries(artifact.assets).map(([path, { hash, size, contentType }]) => [path, { hash, size, contentType }]));
    await bucket.put(`config/${name}.json`, JSON.stringify({ manifest: artifact.manifest, actions: artifact.actions, assets, assetPrefix: `assets/${name}/` }));
    for (const asset of Object.values(artifact.assets)) await bucket.put(`assets/${name}/${asset.hash}`, Buffer.from(asset.content, 'base64'));
    data[name] = await mf.getD1Database('DB', `${name}-runtime`);
    await applyMigrations(data[name], artifact.migrations, `${name}-release`);
  }
  await cpDb.prepare("INSERT INTO sessions(session_id,secret_hash,person_id,kind,parent_session_id,app_id,created_at,expires_at) VALUES('employee-orders',?,'employee','app','employee-browser','orders-app',?,?)").bind(createHash('sha256').update(appToken).digest('hex'), now, now + 3600000).run();
  async function call(app, action, input = {}, { key = input.orderId, browser = false, anonymous = false } = {}) {
    const worker = await mf.getWorker(`${app}-gateway`);
    const headers = { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) };
    if (browser) { headers.Cookie = `__Host-atrax_app=${appToken}`; headers.Origin = `https://${app}.atrax.test`; }
    else if (!anonymous) headers.Authorization = `Bearer ${token}`;
    const response = await worker.fetch(`https://${app}.atrax.test/__atrax/actions/${action}`, { method: 'POST', headers, body: JSON.stringify(input) });
    const body = await response.json();
    return { status: response.status, body, result: body.result };
  }
  async function okay(...args) { const value = await call(...args); assert.equal(value.status, 200, JSON.stringify(value.body)); return value.result; }
  const stock = async (sku = 'paper-a4') => (await data.inventory.prepare('SELECT available FROM stock WHERE sku=?').bind(sku).first()).available;
  async function operation(name,input,{browser=false,key=crypto.randomUUID()}={}) {
    const response=await mf.dispatchFetch(`https://api.atrax.test/v1/operations/${name}`,{
      method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key,...(browser?{Cookie:`__Host-atrax_session=${browserToken}`,Origin:'https://console.atrax.test'}:{Authorization:`Bearer ${token}`})},body:JSON.stringify(input),
    });
    return {status:response.status,body:await response.json()};
  }
  return { mf, cpDb, data, call, okay, stock, token, appToken, artifacts,operation };
}

test('platform action operations reach the real gateway using current browser or agent permissions',async t=>{
  const apps=await company(t);
  const listed=await apps.operation('actions.list',{appId:'orders-app'});
  assert.equal(listed.status,200,JSON.stringify(listed.body));
  assert.ok(JSON.stringify(listed.body.result).includes('orders.create'));
  const call={appId:'orders-app',actionName:'orders.create',input:{orderId:'platform-order',sku:'paper-a4',quantity:2}};
  const created=await apps.operation('actions.call',call,{browser:true,key:'platform-order'});
  assert.equal(created.status,200,JSON.stringify(created.body));
  assert.equal(created.body.result.result.order.status,'confirmed');
  assert.equal(await apps.stock(),8);
  assert.equal((await apps.operation('actions.call',call,{key:'platform-order'})).status,200);
  assert.equal(await apps.stock(),8);
  await apps.cpDb.prepare("INSERT INTO action_denials(app_id,action_name,person_id) VALUES('orders-app','orders.create','employee')").run();
  for(const browser of [false,true]) {
    const denied=await apps.operation('actions.call',call,{browser,key:'platform-order'});
    assert.equal(denied.status,403,JSON.stringify(denied.body));
    assert.equal((await apps.operation('actions.list',{appId:'orders-app'},{browser})).body.result.actions.some(action=>action.name==='orders.create'),false);
  }
  assert.equal(await apps.stock(),8);
});

test('unpublished preview actions require a registered non-live host and current maintainer',async t=>{
  const apps=await company(t);
  const gateway=await apps.mf.getWorker('inventory-gateway');
  const action=apps.artifacts.inventory.actions.find(action=>action.effect==='read').name;
  // Use the template's declared read action, so the runtime validates the same descriptor.
  const invoke=async host=>{
    const response=await gateway.fetch(`https://${host}/__atrax/actions/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apps.token}`},body:JSON.stringify({})});
    return {status:response.status,body:await response.json()};
  };
  await apps.cpDb.prepare('DELETE FROM action_policies WHERE app_id=? AND action_name=?').bind('inventory-app',action).run();
  await apps.cpDb.prepare("INSERT INTO app_hosts(hostname,app_id,release_id,kind) VALUES('preview.atrax.test','inventory-app','inventory-release','preview')").run();
  assert.equal((await invoke('preview.atrax.test')).status,403);
  await apps.cpDb.prepare("INSERT INTO app_maintainers(app_id,person_id) VALUES('inventory-app','employee')").run();
  const preview=await invoke('preview.atrax.test');
  assert.equal(preview.status,200,JSON.stringify(preview.body));
  assert.equal((await invoke('inventory.atrax.test')).status,404);
  assert.equal((await invoke('unregistered.atrax.test')).status,403);
  await apps.cpDb.prepare("INSERT INTO action_policies(app_id,action_name,audience) VALUES(?,?,'workspace')").bind('inventory-app',action).run();
  await apps.cpDb.prepare('INSERT INTO action_denials(app_id,action_name,person_id) VALUES(?,?,?)').bind('inventory-app',action,'employee').run();
  assert.equal((await invoke('preview.atrax.test')).status,403);
});

test('real Orders and Inventory gateways preserve employee identity and reserve once across concurrent retries', async (t) => {
  const companyApps = await company(t);
  const input = { orderId: 'office-order', sku: 'paper-a4', quantity: 3 };
  const results = await Promise.all(Array.from({ length: 8 }, () => companyApps.okay('orders', 'orders.create', input)));
  for (const result of results) assert.equal(result.order.status, 'confirmed');
  assert.equal(await companyApps.stock(), 7);
  assert.equal((await companyApps.data.inventory.prepare('SELECT COUNT(*) AS count FROM reservations').first()).count, 1);
  const reservation = await companyApps.data.inventory.prepare('SELECT * FROM reservations').first();
  assert.equal(reservation.source_id, 'orders-app');
  const invocations = (await companyApps.cpDb.prepare("SELECT person_id,session_id,source_app_id,app_id FROM invocations WHERE source_app_id IS NOT NULL").all()).results;
  assert.ok(invocations.length >= 8);
  assert.ok(invocations.every((row) => row.person_id === 'employee' && row.session_id === 'employee-agent' && row.source_app_id === 'orders-app' && row.app_id === 'inventory-app'));
  const changed = await companyApps.okay('orders', 'orders.create', { ...input, quantity: 4 });
  assert.equal(changed.status, 'idempotency_conflict');
  assert.equal(await companyApps.stock(), 7);
});

test('concurrent different orders cannot oversell and terminal rejections remain stable after replenishment', async (t) => {
  const apps = await company(t);
  const inputs = Array.from({ length: 14 }, (_, index) => ({ orderId: `order-${index}`, sku: 'paper-a4', quantity: 1 }));
  const results = await Promise.all(inputs.map((input) => apps.okay('orders', 'orders.create', input)));
  assert.equal(results.filter((result) => result.order.status === 'confirmed').length, 10);
  assert.equal(results.filter((result) => result.order.outcome === 'insufficient_stock').length, 4);
  assert.equal(await apps.stock(), 0);
  const confirmed = results.find((result) => result.order.status === 'confirmed').order;
  await apps.okay('orders', 'orders.cancel', { orderId: confirmed.orderId });
  assert.equal(await apps.stock(), 1);
  const rejected = results.find((result) => result.order.status === 'rejected').order;
  const retried = await apps.okay('orders', 'orders.create', { orderId: rejected.orderId, sku: rejected.sku, quantity: rejected.quantity });
  assert.equal(retried.order.outcome, 'insufficient_stock');
  assert.equal(await apps.stock(), 1);
  const unknown = { orderId: 'unknown-product', sku: 'future-product', quantity: 1 };
  assert.equal((await apps.okay('orders', 'orders.create', unknown)).order.outcome, 'unknown_sku');
  await apps.data.inventory.prepare("INSERT INTO stock(sku,name,available) VALUES('future-product','New product',5)").run();
  assert.equal((await apps.okay('orders', 'orders.create', unknown)).order.outcome, 'unknown_sku');
  assert.equal(await apps.stock('future-product'), 5);
});

test('Inventory commit survives lost Orders finalization and retry reconciles without reserving again', async (t) => {
  const apps = await company(t);
  await apps.data.orders.prepare("CREATE TRIGGER fail_order_finalization BEFORE UPDATE OF status ON orders WHEN NEW.status='confirmed' BEGIN SELECT RAISE(FAIL,'simulated finalization failure'); END").run();
  const input = { orderId: 'lost-finalization', sku: 'paper-a4', quantity: 4 };
  assert.equal((await apps.call('orders', 'orders.create', input)).status, 500);
  assert.equal(await apps.stock(), 6);
  const fresh = await apps.okay('orders', 'orders.get', { orderId: input.orderId });
  assert.equal(fresh.order.status, 'pending');
  assert.equal(fresh.reservation.status, 'reserved');
  await apps.data.orders.prepare('DROP TRIGGER fail_order_finalization').run();
  const result = await apps.okay('orders', 'orders.create', input);
  assert.equal(result.order.status, 'confirmed');
  assert.equal(await apps.stock(), 6);
  // Treat the successful HTTP response as lost and submit the same business command again.
  assert.deepEqual(await apps.okay('orders', 'orders.create', input), result);
  assert.equal(await apps.stock(), 6);
});

test('cancellation releases once and Orders reads current Inventory state', async (t) => {
  const apps = await company(t);
  const input = { orderId: 'cancel-order', sku: 'paper-a4', quantity: 3 };
  await apps.okay('orders', 'orders.create', input, { browser: true });
  const results = await Promise.all(Array.from({ length: 6 }, () => apps.okay('orders', 'orders.cancel', { orderId: input.orderId })));
  assert.ok(results.every((result) => result.order.status === 'cancelled'));
  assert.equal(await apps.stock(), 10);
  const current = await apps.okay('orders', 'orders.get', { orderId: input.orderId });
  assert.equal(current.reservation.released, true);
  assert.equal(current.order.status, 'cancelled');
  await apps.okay('orders', 'orders.create', input);
  assert.equal(await apps.stock(), 10, 'a delayed creation replay cannot reserve a cancelled order');
});

test('cancellation arriving before Inventory reserve prevents delayed stock mutation', async (t) => {
  const apps = await company(t);
  await apps.cpDb.prepare("INSERT INTO action_denials(app_id,action_name,person_id) VALUES('inventory-app','stock.reserve','employee')").run();
  const input = { orderId: 'cancel-before-reserve', sku: 'paper-a4', quantity: 3 };
  assert.equal((await apps.call('orders', 'orders.create', input)).status, 403);
  const cancelled = await apps.okay('orders', 'orders.cancel', { orderId: input.orderId });
  assert.equal(cancelled.order.status, 'cancelled');
  await apps.cpDb.prepare('DELETE FROM action_denials').run();
  assert.equal((await apps.okay('orders', 'orders.create', input)).order.status, 'cancelled');
  assert.equal(await apps.stock(), 10);
  const reservation = await apps.data.inventory.prepare('SELECT * FROM reservations WHERE order_id=?').bind(input.orderId).first();
  assert.equal(reservation.outcome, 'cancelled');
  assert.equal(reservation.released, 1);
});

test('an interrupted cancellation recovers its final state without returning stock twice', async (t) => {
  const apps = await company(t);
  const input = { orderId: 'cancel-finalization', sku: 'paper-a4', quantity: 4 };
  await apps.okay('orders', 'orders.create', input);
  await apps.data.orders.prepare("CREATE TRIGGER fail_cancel_finalization BEFORE UPDATE OF status ON orders WHEN NEW.status='cancelled' BEGIN SELECT RAISE(FAIL,'simulated cancellation finalization failure'); END").run();
  assert.equal((await apps.call('orders', 'orders.cancel', { orderId: input.orderId })).status, 500);
  assert.equal(await apps.stock(), 10);
  const current = await apps.okay('orders', 'orders.get', { orderId: input.orderId });
  assert.equal(current.order.status, 'cancelling');
  assert.equal(current.reservation.released, true);
  await apps.data.orders.prepare('DROP TRIGGER fail_cancel_finalization').run();
  assert.equal((await apps.okay('orders', 'orders.cancel', { orderId: input.orderId })).order.status, 'cancelled');
  assert.equal(await apps.stock(), 10);
});

test('downstream action denial applies to direct, browser and agent replays; revoked membership invalidates existing sessions', async (t) => {
  const apps = await company(t);
  const input = { orderId: 'permissions-order', sku: 'paper-a4', quantity: 2 };
  await apps.okay('orders', 'orders.create', input);
  await apps.cpDb.prepare("INSERT INTO action_denials(app_id,action_name,person_id) VALUES('inventory-app','stock.reserve','employee')").run();
  assert.equal((await apps.call('inventory', 'stock.reserve', input)).status, 403);
  assert.equal((await apps.call('orders', 'orders.create', input)).status, 403);
  assert.equal((await apps.call('orders', 'orders.create', input, { browser: true })).status, 403);
  assert.equal(await apps.stock(), 8);
  await apps.cpDb.prepare('DELETE FROM action_denials').run();
  await apps.cpDb.prepare("UPDATE workspace_members SET status='removed' WHERE person_id='employee'").run();
  assert.equal((await apps.call('orders', 'orders.create', input)).status, 403);
  assert.equal((await apps.call('orders', 'orders.get', { orderId: input.orderId }, { browser: true })).status, 403);
  assert.equal(await apps.stock(), 8);
});

test('direct inventory calls have independent receipt ownership, reject changed input, and require the stable order key', async (t) => {
  const apps = await company(t);
  const input = { orderId: 'shared-name', sku: 'paper-a4', quantity: 2 };
  assert.equal((await apps.okay('inventory', 'stock.reserve', input, { key: 'different-key' })).status, 'idempotency_key_mismatch');
  assert.equal(await apps.stock(), 10);
  const reserved = await apps.okay('inventory', 'stock.reserve', input);
  assert.deepEqual(await apps.okay('inventory', 'stock.reserve', input), reserved);
  assert.equal((await apps.okay('inventory', 'stock.reserve', { ...input, quantity: 3 })).status, 'idempotency_conflict');
  await apps.okay('orders', 'orders.create', input);
  assert.equal(await apps.stock(), 6);
  assert.equal((await apps.okay('inventory', 'stock.release', { ...input, quantity: 3 })).status, 'idempotency_conflict');
  assert.equal(await apps.stock(), 6);
  await apps.okay('inventory', 'stock.release', input);
  assert.equal(await apps.stock(), 8, 'a direct call releases only that employee reservation');
  assert.equal((await apps.okay('orders', 'orders.get', { orderId: input.orderId })).reservation.released, false);
  assert.equal((await apps.call('orders', 'orders.list', {}, { anonymous: true })).status, 401);
});
