import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  createApp,
  handleRequest,
  runScheduled,
  splitStatements,
} from "../control-plane/src/index.js";
import { buildAssetsModule, buildShim } from "../control-plane/src/shim.js";
import { CpError } from "../control-plane/src/errors.js";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function base64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

// A small generic D1 stand-in. It routes on the statements the control plane
// actually issues rather than parsing SQL, which keeps the fake honest: adding
// a query to the Worker fails loudly here instead of silently doing nothing.
class FakeDatabase {
  constructor() {
    this.apps = [];
    this.meta = new Map();
    this.rate = new Map();
    this.statements = [];
  }

  prepare(sql) {
    const execute = (values) => this.execute(sql, values);
    return {
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async first() {
        return execute(this.values)[0] ?? null;
      },
      async all() {
        return { results: execute(this.values), success: true };
      },
      async run() {
        execute(this.values);
        return { success: true };
      },
    };
  }

  execute(sql, values) {
    this.statements.push({ sql, values });
    const text = sql.replace(/\s+/g, " ").trim();

    if (text.startsWith("INSERT INTO rate")) {
      const [ipHash, day] = values;
      const key = `${ipHash}:${day}`;
      const count = (this.rate.get(key) ?? 0) + 1;
      this.rate.set(key, count);
      return [{ count }];
    }
    if (text.startsWith("SELECT value FROM meta WHERE key = ?")) {
      const value = this.meta.get(values[0]);
      return value === undefined ? [] : [{ value }];
    }
    if (text.startsWith("INSERT INTO meta")) {
      this.meta.set(values[0], values[1]);
      return [];
    }
    if (text.startsWith("INSERT INTO apps")) {
      const columns = sql
        .match(/INSERT INTO apps \(([\s\S]*?)\)/)[1]
        .split(",")
        .map((item) => item.trim());
      const placeholders = sql
        .match(/VALUES \(([\s\S]*?)\)/)[1]
        .split(",")
        .map((item) => item.trim());
      let index = 0;
      const row = {};
      for (const [position, column] of columns.entries()) {
        const token = placeholders[position];
        row[column] = token === "?" ? values[index++] : null;
      }
      this.apps.push(row);
      return [];
    }
    if (text.startsWith("SELECT 1 FROM apps WHERE hostname = ?")) {
      return this.apps
        .filter((row) => row.hostname === values[0])
        .map(() => ({ 1: 1 }));
    }
    if (text.startsWith("SELECT * FROM apps WHERE app_id = ?")) {
      return this.apps.filter((row) => row.app_id === values[0]);
    }
    if (text.startsWith("SELECT * FROM apps WHERE claim_hash = ?")) {
      return this.apps.filter((row) => row.claim_hash === values[0]);
    }
    if (text.startsWith("SELECT * FROM apps WHERE claimed_at IS NULL AND expires_at < ?")) {
      return this.apps.filter(
        (row) => !row.claimed_at && Number(row.expires_at) < values[0],
      );
    }
    if (text.startsWith("UPDATE apps SET claimed_at = ?, expires_at = NULL")) {
      const row = this.apps.find((item) => item.app_id === values[1]);
      if (row) {
        row.claimed_at = values[0];
        row.expires_at = null;
      }
      return [];
    }
    if (text.startsWith("UPDATE apps SET door_secret_set = 1")) {
      const row = this.apps.find((item) => item.app_id === values[0]);
      if (row) row.door_secret_set = 1;
      return [];
    }
    if (text.startsWith("UPDATE apps SET applied_migrations = ?, last_deploy_at = ?")) {
      const row = this.apps.find((item) => item.app_id === values[2]);
      if (row) {
        row.applied_migrations = values[0];
        row.last_deploy_at = values[1];
      }
      return [];
    }
    if (text.startsWith("DELETE FROM apps WHERE app_id = ?")) {
      this.apps = this.apps.filter((row) => row.app_id !== values[0]);
      return [];
    }
    if (text.startsWith("DELETE FROM rate WHERE day < ?")) {
      for (const key of [...this.rate.keys()]) {
        if (key.slice(key.indexOf(":") + 1) < values[0]) this.rate.delete(key);
      }
      return [];
    }
    throw new Error(`FakeDatabase has no route for: ${text}`);
  }
}

function fakeCfApi() {
  const calls = [];
  let databases = 0;
  let domains = 0;
  const api = async (env, method, path, body = null) => {
    calls.push({ method, path, body });
    if (method === "POST" && path.endsWith("/d1/database")) {
      databases += 1;
      return { uuid: `d1-${databases}`, name: body.name };
    }
    if (method === "GET" && path.endsWith("/workers/subdomain")) {
      return { subdomain: "atrax-apps" };
    }
    // The custom domain path. A token without Zone Read fails the lookup, and
    // Cloudflare can refuse the attach on its own; both are flags here because
    // both must leave the deploy standing on workers.dev.
    if (method === "GET" && path.startsWith("/zones")) {
      if (api.zoneFails) {
        throw new CpError(502, "Cloudflare rejected an instant hosting operation.", {
          status: 403,
        });
      }
      return api.zones;
    }
    if (method === "PUT" && path.endsWith("/workers/domains")) {
      if (api.domainFails) {
        throw new CpError(502, "Cloudflare rejected an instant hosting operation.", {
          status: 400,
        });
      }
      domains += 1;
      return { id: `dom${domains}`, hostname: body.hostname };
    }
    // D1's query endpoint answers in the same envelope for every statement;
    // `api.rows` is what a SELECT against an app's own database finds.
    if (method === "POST" && path.endsWith("/query")) {
      const sql = String(body?.sql ?? "");
      return [
        { results: /^\s*SELECT/i.test(sql) ? (api.rows ?? []) : [], success: true },
      ];
    }
    return {};
  };
  api.calls = calls;
  api.rows = [];
  api.zones = [{ id: "zone1" }];
  api.zoneFails = false;
  api.domainFails = false;
  return api;
}

function environment(overrides = {}) {
  return {
    CP_DB: new FakeDatabase(),
    CP_ACCOUNT_ID: "account-1",
    CF_API_TOKEN: "cf-token",
    __cfApi: fakeCfApi(),
    ...overrides,
  };
}

const contract = {
  version: 1,
  name: "open-chat",
  visibility: "public",
  web: { entry: "src/worker.js", assets: "public" },
  tables: { migrations: "migrations" },
};

function bundle(extra = {}) {
  return {
    contract,
    modules: {
      "worker.js": "export default { async fetch() { return new Response('ok'); } };",
      "door.js": "export const gate = null;\n",
    },
    assets: {
      "/index.html": base64("<!doctype html><title>chat</title>"),
      "/styles.css": base64("body { margin: 0 }"),
    },
    migrations: {
      "0001_messages.sql": "CREATE TABLE messages (id INTEGER);\n",
      "0002_guardrails.sql":
        "CREATE TABLE limits (id INTEGER);\nCREATE INDEX limits_id ON limits (id);\n",
    },
    ...extra,
  };
}

function post(path, body, headers = {}) {
  return new Request(`https://instant.atrax.dev${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function request(method, path, body, headers = {}) {
  return new Request(`https://instant.atrax.dev${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const sharedContract = { ...contract, visibility: "shared" };

function sharedBundle(extra = {}) {
  return bundle({ contract: sharedContract, ...extra });
}

async function createdApp(env, body = bundle()) {
  const response = await handleRequest(
    post("/v1/apps", { name: "open-chat", ...body }),
    env,
  );
  const payload = await response.json();
  env.__cfApi.calls.length = 0;
  return payload;
}

test("creates an instant app end to end", async () => {
  const env = environment();
  const response = await createApp(
    post("/v1/apps", { name: "open-chat", ...bundle() }, {
      "cf-connecting-ip": "203.0.113.7",
    }),
    env,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, "deployed");
  assert.equal(payload.name, "open-chat");
  assert.match(payload.appId, /^[a-f0-9]{10}$/);
  assert.equal(payload.url, "https://open-chat.atrax.run");
  assert.equal(payload.resources.tables.name, `i-${payload.appId}-tables`);
  assert.ok(payload.expiresAt > Date.now() + 29 * 24 * 60 * 60 * 1000);
  assert.notEqual(payload.claimToken, payload.manageToken);
  assert.ok(payload.claimToken.length >= 40);

  // Tokens are stored hashed and never in the clear.
  const row = env.CP_DB.apps[0];
  assert.equal(row.claim_hash, sha256Hex(payload.claimToken));
  assert.equal(row.manage_hash, sha256Hex(payload.manageToken));
  const stored = JSON.stringify(env.CP_DB.apps);
  assert.ok(!stored.includes(payload.claimToken));
  assert.ok(!stored.includes(payload.manageToken));
  assert.equal(row.claimed_at, null);
  assert.deepEqual(JSON.parse(row.applied_migrations), [
    "0001_messages.sql",
    "0002_guardrails.sql",
  ]);

  const calls = env.__cfApi.calls;
  const created = calls.find(
    (call) => call.method === "POST" && call.path.endsWith("/d1/database"),
  );
  assert.equal(created.body.name, `i-${payload.appId}-tables`);

  const queries = calls.filter((call) => call.path.endsWith("/query"));
  assert.deepEqual(
    queries.map((call) => call.body.sql),
    [
      "CREATE TABLE messages (id INTEGER)",
      "CREATE TABLE limits (id INTEGER)",
      "CREATE INDEX limits_id ON limits (id)",
    ],
  );
  assert.ok(queries.every((call) => call.path.includes("/d1/database/d1-1/")));

  const upload = calls.find((call) => call.method === "PUT");
  assert.equal(
    upload.path,
    `/accounts/account-1/workers/scripts/i-${payload.appId}`,
  );
  assert.match(upload.body.__contentType, /^multipart\/form-data; boundary=/);
  const form = upload.body.__body;
  assert.ok(form.includes('"main_module":"_atrax_shim.mjs"'));
  assert.ok(form.includes('"compatibility_date":"2026-07-25"'));
  assert.ok(form.includes('{"type":"d1","name":"DB","id":"d1-1"}'));
  assert.ok(
    form.includes('{"type":"plain_text","name":"ATRAX_APP_NAME","text":"open-chat"}'),
  );
  assert.ok(
    form.includes('{"type":"plain_text","name":"ATRAX_VISIBILITY","text":"public"}'),
  );
  for (const name of [
    "worker.js",
    "door.js",
    "_atrax_assets.mjs",
    "_atrax_shim.mjs",
  ]) {
    assert.ok(
      form.includes(`name="${name}"; filename="${name}"`),
      `${name} should be a module part`,
    );
  }
  assert.ok(form.includes("content-type: application/javascript+module"));

  const subdomain = calls.find((call) => call.path.endsWith("/subdomain") && call.method === "POST");
  assert.deepEqual(subdomain.body, { enabled: true });
  assert.equal(env.CP_DB.meta.get("workers_subdomain"), "atrax-apps");
});

test("a created app gets <name>.atrax.run and remembers the domain", async () => {
  const env = environment();
  const payload = await (
    await handleRequest(post("/v1/apps", { name: "open-chat", ...bundle() }), env)
  ).json();

  assert.equal(payload.url, "https://open-chat.atrax.run");

  const attach = env.__cfApi.calls.find((call) =>
    call.path.endsWith("/workers/domains"),
  );
  assert.equal(attach.method, "PUT");
  assert.equal(attach.path, "/accounts/account-1/workers/domains");
  assert.deepEqual(attach.body, {
    zone_id: "zone1",
    hostname: "open-chat.atrax.run",
    service: `i-${payload.appId}`,
    environment: "production",
  });

  const row = env.CP_DB.apps[0];
  assert.equal(row.url, "https://open-chat.atrax.run");
  assert.equal(row.hostname, "open-chat.atrax.run");
  assert.equal(row.domain_id, "dom1");

  // The zone lookup is cached, so a second create never repeats it.
  assert.equal(env.CP_DB.meta.get("zone_id"), "zone1");
  env.__cfApi.calls.length = 0;
  await handleRequest(post("/v1/apps", { name: "other-chat", ...bundle() }), env);
  assert.equal(
    env.__cfApi.calls.filter((call) => call.path.startsWith("/zones")).length,
    0,
  );
});

test("a failed zone lookup leaves the app on workers.dev and is not cached", async () => {
  const env = environment();
  env.__cfApi.zoneFails = true;

  const payload = await (
    await handleRequest(post("/v1/apps", { name: "open-chat", ...bundle() }), env)
  ).json();
  assert.equal(payload.status, "deployed");
  assert.equal(
    payload.url,
    `https://i-${payload.appId}.atrax-apps.workers.dev`,
  );

  const row = env.CP_DB.apps[0];
  assert.equal(row.hostname, null);
  assert.equal(row.domain_id, null);
  assert.equal(env.CP_DB.meta.get("zone_id"), undefined);
  assert.equal(
    env.__cfApi.calls.filter((call) => call.path.endsWith("/workers/domains")).length,
    0,
  );

  // The token can gain Zone Read later, so the next create asks again.
  const second = await (
    await handleRequest(post("/v1/apps", { name: "open-chat", ...bundle() }), env)
  ).json();
  assert.equal(second.status, "deployed");
  assert.equal(
    env.__cfApi.calls.filter((call) => call.path.startsWith("/zones")).length,
    2,
  );
});

test("a hostname already taken gets a four hex suffix", async () => {
  const env = environment();
  env.CP_DB.apps.push({
    app_id: "aaaaaaaaaa",
    name: "open-chat",
    hostname: "open-chat.atrax.run",
  });

  const payload = await (
    await handleRequest(post("/v1/apps", { name: "open-chat", ...bundle() }), env)
  ).json();
  assert.match(payload.url, /^https:\/\/open-chat-[0-9a-f]{4}\.atrax\.run$/);

  const row = env.CP_DB.apps[1];
  assert.equal(row.hostname, payload.url.slice("https://".length));
  assert.equal(row.domain_id, "dom1");
});

test("a refused domain attach still deploys, on workers.dev", async () => {
  const env = environment();
  env.__cfApi.domainFails = true;

  const response = await handleRequest(
    post("/v1/apps", { name: "open-chat", ...bundle() }),
    env,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "deployed");
  assert.equal(
    payload.url,
    `https://i-${payload.appId}.atrax-apps.workers.dev`,
  );
  assert.equal(env.CP_DB.apps[0].hostname, null);
  assert.equal(env.CP_DB.apps[0].domain_id, null);
});

test("claiming an app is idempotent and clears the expiry", async () => {
  const env = environment();
  const created = await (
    await handleRequest(post("/v1/apps", { name: "open-chat", ...bundle() }), env)
  ).json();

  const first = await handleRequest(
    post("/v1/claims", { claimToken: created.claimToken }),
    env,
  );
  const firstPayload = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstPayload.schemaVersion, 1);
  assert.equal(firstPayload.status, "claimed");
  assert.equal(firstPayload.appId, created.appId);
  assert.equal(firstPayload.url, created.url);

  const claimedAt = env.CP_DB.apps[0].claimed_at;
  assert.ok(claimedAt);
  assert.equal(env.CP_DB.apps[0].expires_at, null);

  const second = await handleRequest(
    post("/v1/claims", { claimToken: created.claimToken }),
    env,
  );
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), firstPayload);
  assert.equal(env.CP_DB.apps[0].claimed_at, claimedAt);

  const unknown = await handleRequest(
    post("/v1/claims", { claimToken: "nope" }),
    env,
  );
  assert.equal(unknown.status, 404);
  assert.match((await unknown.json()).error, /does not match an instant app/);
});

test("redeploy authenticates, applies only new migrations, and re-uploads", async () => {
  const env = environment();
  const created = await (
    await handleRequest(post("/v1/apps", { name: "open-chat", ...bundle() }), env)
  ).json();
  env.__cfApi.calls.length = 0;

  const next = bundle();
  next.migrations["0003_new.sql"] = "CREATE TABLE later (id INTEGER);\n";

  const unauthorized = await handleRequest(
    post(`/v1/apps/${created.appId}/deploys`, next),
    env,
  );
  assert.equal(unauthorized.status, 401);

  const wrongToken = await handleRequest(
    post(`/v1/apps/${created.appId}/deploys`, next, {
      authorization: "Bearer not-the-token",
    }),
    env,
  );
  assert.equal(wrongToken.status, 404);

  const response = await handleRequest(
    post(`/v1/apps/${created.appId}/deploys`, next, {
      authorization: `Bearer ${created.manageToken}`,
    }),
    env,
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "deployed");
  assert.equal(payload.appId, created.appId);
  assert.equal(payload.url, created.url);
  assert.equal(payload.claimToken, undefined);
  assert.equal(payload.manageToken, undefined);

  const queries = env.__cfApi.calls.filter((call) => call.path.endsWith("/query"));
  assert.deepEqual(
    queries.map((call) => call.body.sql),
    ["CREATE TABLE later (id INTEGER)"],
  );
  assert.equal(
    env.__cfApi.calls.filter((call) => call.method === "PUT").length,
    1,
  );
  assert.deepEqual(JSON.parse(env.CP_DB.apps[0].applied_migrations), [
    "0001_messages.sql",
    "0002_guardrails.sql",
    "0003_new.sql",
  ]);

  const described = await handleRequest(
    new Request(`https://instant.atrax.dev/v1/apps/${created.appId}`, {
      headers: { authorization: `Bearer ${created.manageToken}` },
    }),
    env,
  );
  const describedPayload = await described.json();
  assert.equal(describedPayload.status, "unclaimed");
  assert.equal(describedPayload.url, created.url);
});

test("the eleventh create from one address is rate limited", async () => {
  const env = environment();
  const headers = { "cf-connecting-ip": "198.51.100.42" };
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await handleRequest(
      post("/v1/apps", { name: "open-chat", ...bundle() }, headers),
      env,
    );
    assert.equal(response.status, 200, `create ${attempt + 1} should succeed`);
  }
  const limited = await handleRequest(
    post("/v1/apps", { name: "open-chat", ...bundle() }, headers),
    env,
  );
  assert.equal(limited.status, 429);
  const payload = await limited.json();
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, "error");
  assert.match(payload.error, /Too many instant deploys/);
  assert.match(payload.details.recovery, /Cloudflare account/);
  assert.equal(env.CP_DB.apps.length, 10);

  // A different address is unaffected.
  const other = await handleRequest(
    post("/v1/apps", { name: "open-chat", ...bundle() }, {
      "cf-connecting-ip": "198.51.100.43",
    }),
    env,
  );
  assert.equal(other.status, 200);
});

test("the daily sweep deletes expired unclaimed apps and prunes rate rows", async () => {
  const env = environment();
  const now = Date.now();
  env.CP_DB.apps = [
    {
      app_id: "aaaaaaaaaa",
      worker_name: "i-aaaaaaaaaa",
      d1_id: "d1-expired",
      claimed_at: null,
      expires_at: now - 1000,
    },
    {
      app_id: "bbbbbbbbbb",
      worker_name: "i-bbbbbbbbbb",
      d1_id: "d1-live",
      claimed_at: null,
      expires_at: now + 1000,
    },
    {
      app_id: "cccccccccc",
      worker_name: "i-cccccccccc",
      d1_id: "d1-claimed",
      claimed_at: now - 5000,
      expires_at: null,
    },
  ];
  env.CP_DB.rate.set("hash-old:2020-01-01", 4);
  env.CP_DB.rate.set(`hash-new:${new Date(now).toISOString().slice(0, 10)}`, 2);

  const result = await runScheduled(env);
  assert.deepEqual(result.deleted, ["aaaaaaaaaa"]);
  assert.deepEqual(
    env.CP_DB.apps.map((row) => row.app_id),
    ["bbbbbbbbbb", "cccccccccc"],
  );
  assert.deepEqual(
    env.__cfApi.calls.filter((call) => call.method === "DELETE"),
    [
      {
        method: "DELETE",
        path: "/accounts/account-1/workers/scripts/i-aaaaaaaaaa?force=true",
        body: null,
      },
      {
        method: "DELETE",
        path: "/accounts/account-1/d1/database/d1-expired",
        body: null,
      },
    ],
  );
  assert.deepEqual([...env.CP_DB.rate.keys()].map((key) => key.split(":")[0]), [
    "hash-new",
  ]);
});

test("rejects oversized bundles, bad names, and unknown visibility", async () => {
  const env = environment();

  const named = await handleRequest(
    post("/v1/apps", { name: "Not A Name", ...bundle() }),
    env,
  );
  assert.equal(named.status, 400);
  assert.match((await named.json()).error, /App names use 2 to 48 lowercase/);

  const private_ = await handleRequest(
    post("/v1/apps", {
      name: "open-chat",
      ...bundle({ contract: { ...contract, visibility: "private" } }),
    }),
    env,
  );
  assert.equal(private_.status, 400);
  const privatePayload = await private_.json();
  assert.match(privatePayload.error, /supports visibility "public" and "shared"/);
  assert.equal(privatePayload.details.visibility, "private");

  const tooManyAssets = {};
  for (let index = 0; index < 41; index += 1) {
    tooManyAssets[`/file-${index}.txt`] = base64("x");
  }
  const capped = await handleRequest(
    post("/v1/apps", {
      name: "open-chat",
      ...bundle({ assets: tooManyAssets }),
    }),
    env,
  );
  assert.equal(capped.status, 400);
  assert.match((await capped.json()).error, /at most 40 entries/);

  const missingEntry = await handleRequest(
    post("/v1/apps", {
      name: "open-chat",
      ...bundle({ modules: { "other.js": "export default {};" } }),
    }),
    env,
  );
  assert.equal(missingEntry.status, 400);
  assert.match((await missingEntry.json()).error, /must include the file named by web\.entry/);

  const missing = await handleRequest(
    new Request("https://instant.atrax.dev/v1/nope"),
    env,
  );
  assert.equal(missing.status, 404);
  assert.equal(env.CP_DB.apps.length, 0);
});

test("rejects app names reserved for Atrax itself", async () => {
  const env = environment();
  for (const name of ["www", "api", "atrax", "ns1"]) {
    const response = await handleRequest(
      post("/v1/apps", { name, ...bundle() }),
      env,
    );
    assert.equal(response.status, 400, `${name} should be rejected`);
    const payload = await response.json();
    assert.match(payload.error, /is reserved for Atrax itself/);
    assert.equal(payload.details.name, name);
  }
  assert.equal(env.CP_DB.apps.length, 0);
});

test("secrets are set and removed on the app's script and never stored", async () => {
  const env = environment();
  const created = await createdApp(env);
  const auth = { authorization: `Bearer ${created.manageToken}` };
  const secretPath = `/v1/apps/${created.appId}/secrets/OPENAI_API_KEY`;

  const anonymous = await handleRequest(
    request("PUT", secretPath, { value: "sk-live-1" }),
    env,
  );
  assert.equal(anonymous.status, 401);

  const badName = await handleRequest(
    request(
      "PUT",
      `/v1/apps/${created.appId}/secrets/openai-key`,
      { value: "sk-live-1" },
      auth,
    ),
    env,
  );
  assert.equal(badName.status, 400);
  assert.match((await badName.json()).error, /Secret names use 1 to 64/);

  const set = await handleRequest(
    request("PUT", secretPath, { value: "sk-live-1" }, auth),
    env,
  );
  assert.equal(set.status, 200);
  assert.deepEqual(await set.json(), {
    schemaVersion: 1,
    status: "set",
    name: "OPENAI_API_KEY",
  });

  const put = env.__cfApi.calls.find((call) => call.method === "PUT");
  assert.equal(
    put.path,
    `/accounts/account-1/workers/scripts/i-${created.appId}/secrets`,
  );
  assert.deepEqual(put.body, {
    name: "OPENAI_API_KEY",
    text: "sk-live-1",
    type: "secret_text",
  });
  assert.ok(!JSON.stringify(env.CP_DB.apps).includes("sk-live-1"));
  assert.ok(!JSON.stringify(env.CP_DB.statements).includes("sk-live-1"));

  const removed = await handleRequest(
    request("DELETE", secretPath, undefined, auth),
    env,
  );
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), {
    schemaVersion: 1,
    status: "removed",
    name: "OPENAI_API_KEY",
  });
  const deleted = env.__cfApi.calls.find((call) => call.method === "DELETE");
  assert.equal(
    deleted.path,
    `/accounts/account-1/workers/scripts/i-${created.appId}/secrets/OPENAI_API_KEY`,
  );

  // A 404 from Cloudflare becomes a clean "not set" rather than a 502.
  env.__cfApi = async () => {
    throw new CpError(502, "Cloudflare rejected an instant hosting operation.", {
      status: 404,
    });
  };
  const missing = await handleRequest(
    request("DELETE", secretPath, undefined, auth),
    env,
  );
  assert.equal(missing.status, 404);
  assert.match((await missing.json()).error, /is not set on this app/);
});

test("a shared app binds shared visibility and gets one Door secret ever", async () => {
  const env = environment();
  const response = await handleRequest(
    post("/v1/apps", { name: "open-chat", ...sharedBundle() }),
    env,
  );
  assert.equal(response.status, 200);
  const created = await response.json();

  const upload = env.__cfApi.calls.find(
    (call) => call.method === "PUT" && !call.path.endsWith("/secrets"),
  );
  assert.ok(
    upload.body.__body.includes(
      '{"type":"plain_text","name":"ATRAX_VISIBILITY","text":"shared"}',
    ),
  );

  const secrets = env.__cfApi.calls.filter((call) =>
    call.path.endsWith("/secrets"),
  );
  assert.equal(secrets.length, 1);
  assert.equal(
    secrets[0].path,
    `/accounts/account-1/workers/scripts/i-${created.appId}/secrets`,
  );
  assert.equal(secrets[0].body.name, "DOOR_SESSION_SECRET");
  assert.equal(secrets[0].body.type, "secret_text");
  assert.ok(secrets[0].body.text.length >= 40);

  // The value is never stored and never returned, only the marker.
  const row = env.CP_DB.apps[0];
  assert.equal(row.door_secret_set, 1);
  assert.ok(!JSON.stringify(env.CP_DB.apps).includes(secrets[0].body.text));
  assert.equal(created.doorSecret, undefined);

  env.__cfApi.calls.length = 0;
  const redeployed = await handleRequest(
    post(`/v1/apps/${created.appId}/deploys`, sharedBundle(), {
      authorization: `Bearer ${created.manageToken}`,
    }),
    env,
  );
  assert.equal(redeployed.status, 200);
  assert.equal(
    env.__cfApi.calls.filter((call) => call.path.endsWith("/secrets")).length,
    0,
  );
  assert.equal(env.CP_DB.apps[0].door_secret_set, 1);

  // A public app never gets one.
  const publicEnv = environment();
  await createdApp(publicEnv);
  assert.equal(publicEnv.CP_DB.apps[0].door_secret_set, null);
});

test("members are invited, listed, and removed on the app's own database", async () => {
  const env = environment();
  const created = await createdApp(env, sharedBundle());
  const auth = { authorization: `Bearer ${created.manageToken}` };

  const anonymous = await handleRequest(
    post(`/v1/apps/${created.appId}/members`, { email: "ana@example.com" }),
    env,
  );
  assert.equal(anonymous.status, 401);

  const badEmail = await handleRequest(
    post(`/v1/apps/${created.appId}/members`, { email: "not an email" }, auth),
    env,
  );
  assert.equal(badEmail.status, 400);
  assert.match((await badEmail.json()).error, /one email address/);

  const invited = await handleRequest(
    post(`/v1/apps/${created.appId}/members`, { email: "Ana@Example.com" }, auth),
    env,
  );
  assert.equal(invited.status, 200);
  const payload = await invited.json();
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, "invited");
  assert.equal(payload.email, "ana@example.com");
  assert.ok(payload.expiresAt > Date.now() + 13 * 24 * 60 * 60 * 1000);
  assert.match(
    payload.inviteUrl,
    new RegExp(
      `^${created.url.replaceAll(".", "\\.")}/\\.door/join\\?token=[A-Za-z0-9_-]+$`,
    ),
  );

  const token = new URL(payload.inviteUrl).searchParams.get("token");
  const queries = env.__cfApi.calls.filter((call) => call.path.endsWith("/query"));
  assert.equal(queries.length, 2);
  assert.ok(
    queries.every((call) =>
      call.path.startsWith("/accounts/account-1/d1/database/d1-1/"),
    ),
    "member queries run against the app's own database",
  );
  const upsert = queries[1];
  assert.match(upsert.body.sql, /INSERT INTO door_members/);
  assert.match(upsert.body.sql, /ON CONFLICT\(email\) DO UPDATE/);
  assert.deepEqual(upsert.body.params.slice(0, 2), [
    "ana@example.com",
    sha256Hex(token),
  ]);
  assert.ok(!JSON.stringify(env.__cfApi.calls).includes(token));

  env.__cfApi.calls.length = 0;
  env.__cfApi.rows = [
    { email: "ana@example.com", joined_at: null, invite_expires_at: Date.now() + 1000 },
    { email: "joined@example.com", joined_at: 1, invite_expires_at: null },
    { email: "stale@example.com", joined_at: null, invite_expires_at: 1 },
  ];
  const listed = await handleRequest(
    request("GET", `/v1/apps/${created.appId}/members`, undefined, auth),
    env,
  );
  assert.equal(listed.status, 200);
  const listPayload = await listed.json();
  assert.equal(listPayload.status, "ok");
  assert.deepEqual(
    listPayload.members.map((item) => [item.email, item.state]),
    [
      ["ana@example.com", "invited"],
      ["joined@example.com", "joined"],
      ["stale@example.com", "expired"],
    ],
  );

  env.__cfApi.calls.length = 0;
  env.__cfApi.rows = [];
  const removed = await handleRequest(
    request(
      "DELETE",
      `/v1/apps/${created.appId}/members/${encodeURIComponent("ana@example.com")}`,
      undefined,
      auth,
    ),
    env,
  );
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), {
    schemaVersion: 1,
    status: "removed",
    email: "ana@example.com",
  });
  const deleteQuery = env.__cfApi.calls.find((call) => call.path.endsWith("/query"));
  assert.match(deleteQuery.body.sql, /DELETE FROM door_members WHERE email = \?/);
  assert.deepEqual(deleteQuery.body.params, ["ana@example.com"]);
});

test("member endpoints refuse a public app and name the fix", async () => {
  const env = environment();
  const created = await createdApp(env);
  const auth = { authorization: `Bearer ${created.manageToken}` };

  for (const call of [
    post(`/v1/apps/${created.appId}/members`, { email: "ana@example.com" }, auth),
    request("GET", `/v1/apps/${created.appId}/members`, undefined, auth),
    request(
      "DELETE",
      `/v1/apps/${created.appId}/members/${encodeURIComponent("ana@example.com")}`,
      undefined,
      auth,
    ),
  ]) {
    const response = await handleRequest(call, env);
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.match(payload.error, /only available on a shared app/);
    assert.match(payload.details.recovery, /"visibility": "shared".*atrax deploy/s);
  }
  assert.equal(
    env.__cfApi.calls.filter((item) => item.path.endsWith("/query")).length,
    0,
  );
});

test("delete tears down the script, the database, and the row", async () => {
  const env = environment();
  const created = await createdApp(env);

  const wrongToken = await handleRequest(
    request("DELETE", `/v1/apps/${created.appId}`, undefined, {
      authorization: "Bearer not-the-token",
    }),
    env,
  );
  assert.equal(wrongToken.status, 404);
  assert.equal(env.CP_DB.apps.length, 1);
  assert.equal(env.__cfApi.calls.length, 0);

  const response = await handleRequest(
    request("DELETE", `/v1/apps/${created.appId}`, undefined, {
      authorization: `Bearer ${created.manageToken}`,
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    schemaVersion: 1,
    status: "deleted",
    appId: created.appId,
  });
  assert.deepEqual(
    env.__cfApi.calls.filter((call) => call.method === "DELETE"),
    [
      {
        method: "DELETE",
        path: "/accounts/account-1/workers/domains/dom1",
        body: null,
      },
      {
        method: "DELETE",
        path: `/accounts/account-1/workers/scripts/i-${created.appId}?force=true`,
        body: null,
      },
      {
        method: "DELETE",
        path: "/accounts/account-1/d1/database/d1-1",
        body: null,
      },
    ],
  );
  assert.equal(env.CP_DB.apps.length, 0);

  const again = await handleRequest(
    request("DELETE", `/v1/apps/${created.appId}`, undefined, {
      authorization: `Bearer ${created.manageToken}`,
    }),
    env,
  );
  assert.equal(again.status, 404);
});

test("a domain that will not detach does not block the rest of teardown", async () => {
  const env = environment();
  const created = await createdApp(env);
  assert.equal(env.CP_DB.apps[0].domain_id, "dom1");

  const inner = env.__cfApi;
  const failing = async (innerEnv, method, path, body = null) => {
    if (method === "DELETE" && path.includes("/workers/domains/")) {
      inner.calls.push({ method, path, body });
      throw new CpError(502, "Cloudflare rejected an instant hosting operation.", {
        status: 404,
      });
    }
    return inner(innerEnv, method, path, body);
  };
  failing.calls = inner.calls;
  env.__cfApi = failing;

  const response = await handleRequest(
    request("DELETE", `/v1/apps/${created.appId}`, undefined, {
      authorization: `Bearer ${created.manageToken}`,
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    failing.calls.filter((call) => call.method === "DELETE").map((call) => call.path),
    [
      "/accounts/account-1/workers/domains/dom1",
      `/accounts/account-1/workers/scripts/i-${created.appId}?force=true`,
      "/accounts/account-1/d1/database/d1-1",
    ],
  );
  assert.equal(env.CP_DB.apps.length, 0);
});

test("the generated shim wires an ASSETS binding around the user's Worker", () => {
  const shim = buildShim("worker.js");
  assert.ok(shim.includes('import userWorker from "./worker.js";'));
  assert.ok(shim.includes('from "./_atrax_assets.mjs"'));
  assert.ok(shim.includes("const ASSETS = {"));
  assert.ok(shim.includes("userWorker.fetch(request, { ...env, ASSETS }, ctx)"));
  assert.ok(shim.includes('const indexPath = "/index.html";'));
  assert.ok(shim.includes("response.status === 404"));
  assert.ok(shim.includes('url.pathname.startsWith("/api/")'));
  assert.ok(shim.includes('typeof userWorker.scheduled === "function"'));
  assert.ok(shim.includes("export default shim;"));
});

test("the generated assets module embeds base64 with a content-type map", () => {
  const source = buildAssetsModule({
    "/index.html": base64("<h1>hi</h1>"),
    "/app.js": base64("console.log(1)"),
  });
  assert.ok(source.includes(`"/index.html": "${base64("<h1>hi</h1>")}"`));
  assert.ok(source.includes(`"/app.js": "${base64("console.log(1)")}"`));
  assert.ok(source.includes('"html": "text/html; charset=utf-8"'));
  assert.ok(source.includes('"woff2": "font/woff2"'));
  assert.ok(source.includes('"application/octet-stream"'));
  assert.ok(source.includes("export function assetBytes(path)"));
  assert.ok(source.includes("export function hasAsset(path)"));
  assert.ok(source.includes("atob(encoded[path])"));
});

test("splits migration files into statements", () => {
  assert.deepEqual(splitStatements("CREATE TABLE a (id INTEGER);\n"), [
    "CREATE TABLE a (id INTEGER)",
  ]);
  assert.deepEqual(
    splitStatements("CREATE TABLE a (id INTEGER);\n\nCREATE INDEX x ON a (id);"),
    ["CREATE TABLE a (id INTEGER)", "CREATE INDEX x ON a (id)"],
  );
  assert.deepEqual(splitStatements("\n\n  \n"), []);
});
