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
  const api = async (env, method, path, body = null) => {
    calls.push({ method, path, body });
    if (method === "POST" && path.endsWith("/d1/database")) {
      databases += 1;
      return { uuid: `d1-${databases}`, name: body.name };
    }
    if (method === "GET" && path.endsWith("/workers/subdomain")) {
      return { subdomain: "tarantula-apps" };
    }
    return {};
  };
  api.calls = calls;
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
  return new Request(`https://instant.tarantula.dev${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
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
  assert.equal(
    payload.url,
    `https://i-${payload.appId}.tarantula-apps.workers.dev`,
  );
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
  assert.ok(form.includes('"main_module":"_tarantula_shim.mjs"'));
  assert.ok(form.includes('"compatibility_date":"2026-07-25"'));
  assert.ok(form.includes('{"type":"d1","name":"DB","id":"d1-1"}'));
  assert.ok(
    form.includes('{"type":"plain_text","name":"TARANTULA_APP_NAME","text":"open-chat"}'),
  );
  assert.ok(
    form.includes('{"type":"plain_text","name":"TARANTULA_VISIBILITY","text":"public"}'),
  );
  for (const name of [
    "worker.js",
    "door.js",
    "_tarantula_assets.mjs",
    "_tarantula_shim.mjs",
  ]) {
    assert.ok(
      form.includes(`name="${name}"; filename="${name}"`),
      `${name} should be a module part`,
    );
  }
  assert.ok(form.includes("content-type: application/javascript+module"));

  const subdomain = calls.find((call) => call.path.endsWith("/subdomain") && call.method === "POST");
  assert.deepEqual(subdomain.body, { enabled: true });
  assert.equal(env.CP_DB.meta.get("workers_subdomain"), "tarantula-apps");
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
    new Request(`https://instant.tarantula.dev/v1/apps/${created.appId}`, {
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

test("rejects oversized bundles, bad names, and shared visibility", async () => {
  const env = environment();

  const named = await handleRequest(
    post("/v1/apps", { name: "Not A Name", ...bundle() }),
    env,
  );
  assert.equal(named.status, 400);
  assert.match((await named.json()).error, /App names use 2 to 48 lowercase/);

  const shared = await handleRequest(
    post("/v1/apps", {
      name: "open-chat",
      ...bundle({ contract: { ...contract, visibility: "shared" } }),
    }),
    env,
  );
  assert.equal(shared.status, 400);
  const sharedPayload = await shared.json();
  assert.match(sharedPayload.error, /supports public apps only/);
  assert.match(sharedPayload.details.recovery, /Cloudflare account/);

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
    new Request("https://instant.tarantula.dev/v1/nope"),
    env,
  );
  assert.equal(missing.status, 404);
  assert.equal(env.CP_DB.apps.length, 0);
});

test("the generated shim wires an ASSETS binding around the user's Worker", () => {
  const shim = buildShim("worker.js");
  assert.ok(shim.includes('import userWorker from "./worker.js";'));
  assert.ok(shim.includes('from "./_tarantula_assets.mjs"'));
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
