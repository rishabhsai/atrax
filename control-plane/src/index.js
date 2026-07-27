// Tarantula instant hosting control plane.
//
// Anonymous, no-sign-in deploys. A `tarantula deploy` with no Cloudflare
// account posts its bundle here; this Worker provisions D1 and a Worker script
// in Tarantula's own Cloudflare account, hands back a URL and a claim token,
// and deletes the app after 30 days unless somebody claims it.
//
// Two secrets are set by a human before the first deploy: CF_API_TOKEN (a
// scoped platform token) and the CP_ACCOUNT_ID var. This Worker never mints
// credentials of its own.

import { buildScriptUpload, cfApiFor } from "./cf.js";
import {
  assetsModuleName,
  buildAssetsModule,
  buildShim,
  shimModuleName,
} from "./shim.js";
import { CpError } from "./errors.js";

const schemaVersion = 1;
const appTtlMs = 30 * 24 * 60 * 60 * 1000;
const maxBodyBytes = 3 * 1024 * 1024;
const maxAssets = 40;
const maxModules = 20;
const maxCreatesPerDay = 10;
const rateSalt = "tarantula-instant-rate-v1";
const rateRetentionDays = 2;
const compatibilityDate = "2026-07-25";
const namePattern = /^[a-z][a-z0-9-]{1,47}$/;
const migrationPattern = /^\d+.*\.sql$/;
const modulePattern = /^[A-Za-z0-9_.-]+\.(js|mjs)$/;

const textEncoder = new TextEncoder();

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomAppId() {
  return toHex(crypto.getRandomValues(new Uint8Array(5)));
}

function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function accountId(env) {
  const value = env.CP_ACCOUNT_ID;
  if (!value) {
    throw new CpError(500, "Tarantula instant hosting is not configured yet.", {
      recovery: "Set CP_ACCOUNT_ID and the CF_API_TOKEN secret on the control plane Worker.",
    });
  }
  return value;
}

function basename(pathname) {
  const parts = String(pathname).split("/");
  return parts[parts.length - 1];
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    throw new CpError(413, "That app is too large for instant hosting.", {
      limitBytes: maxBodyBytes,
      recovery: "Deploy with a Cloudflare account, or trim the app's assets.",
    });
  }
  const source = await request.text();
  if (textEncoder.encode(source).byteLength > maxBodyBytes) {
    throw new CpError(413, "That app is too large for instant hosting.", {
      limitBytes: maxBodyBytes,
      recovery: "Deploy with a Cloudflare account, or trim the app's assets.",
    });
  }
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value;
  } catch {
    throw new CpError(400, "Expected a JSON object request body.");
  }
}

function stringMap(value, label, limit, keyCheck) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CpError(400, `${label} must be an object.`);
  }
  const keys = Object.keys(value);
  if (keys.length > limit) {
    throw new CpError(400, `${label} may contain at most ${limit} entries.`, {
      count: keys.length,
      limit,
    });
  }
  for (const key of keys) {
    if (!keyCheck(key)) {
      throw new CpError(400, `${label} contains an unsupported name: ${key}`);
    }
    if (typeof value[key] !== "string") {
      throw new CpError(400, `${label} values must be strings: ${key}`);
    }
  }
  return value;
}

function assetKey(key) {
  return (
    key.startsWith("/") &&
    !key.includes("..") &&
    !key.includes("\\") &&
    key.length <= 512
  );
}

function readBundle(body) {
  const contract = body.contract;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    throw new CpError(400, "contract must be an object.");
  }
  if (contract.visibility && contract.visibility !== "public") {
    throw new CpError(400, "Instant hosting supports public apps only.", {
      visibility: contract.visibility,
      recovery: "Deploy shared apps with a Cloudflare account for now.",
    });
  }
  const modules = stringMap(body.modules, "modules", maxModules, (key) =>
    modulePattern.test(key),
  );
  const assets = stringMap(body.assets, "assets", maxAssets, assetKey);
  const migrations = stringMap(body.migrations, "migrations", 200, (key) =>
    migrationPattern.test(key),
  );
  const entry = basename(contract.web?.entry ?? "");
  if (!entry || !Object.hasOwn(modules, entry)) {
    throw new CpError(400, "modules must include the file named by web.entry.", {
      entry: contract.web?.entry ?? null,
    });
  }
  return { contract, modules, assets, migrations, entry };
}

async function checkRate(request, env) {
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await sha256Hex(`${rateSalt}:${address}`);
  const day = dayKey(Date.now());
  const row = await env.CP_DB.prepare(
    `INSERT INTO rate (ip_hash, day, count)
     VALUES (?, ?, 1)
     ON CONFLICT(ip_hash, day) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(ipHash, day)
    .first();
  if (Number(row?.count ?? 0) > maxCreatesPerDay) {
    throw new CpError(429, "Too many instant deploys from this network today.", {
      limit: maxCreatesPerDay,
      recovery:
        "Try again tomorrow, or deploy with a Cloudflare account for unlimited deploys.",
    });
  }
}

// The account's workers.dev subdomain never changes, so it is fetched once and
// cached in CP_DB rather than on every create.
async function workersSubdomain(env) {
  const cached = await env.CP_DB.prepare(
    `SELECT value FROM meta WHERE key = ?`,
  )
    .bind("workers_subdomain")
    .first();
  if (cached?.value) return cached.value;
  const result = await cfApiFor(env)(
    env,
    "GET",
    `/accounts/${accountId(env)}/workers/subdomain`,
    null,
  );
  const subdomain = result?.subdomain;
  if (!subdomain) {
    throw new CpError(502, "Cloudflare did not report a workers.dev subdomain.");
  }
  await env.CP_DB.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind("workers_subdomain", subdomain)
    .run();
  return subdomain;
}

// D1's query endpoint takes one statement per call in practice, so migrations
// are split on the semicolon-plus-newline boundaries the CLI already enforces
// in its own migration files.
export function splitStatements(sql) {
  return String(sql)
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function applyMigrations(env, databaseId, migrations, alreadyApplied) {
  const pending = Object.keys(migrations)
    .sort()
    .filter((name) => !alreadyApplied.includes(name));
  for (const name of pending) {
    for (const statement of splitStatements(migrations[name])) {
      await cfApiFor(env)(
        env,
        "POST",
        `/accounts/${accountId(env)}/d1/database/${databaseId}/query`,
        { sql: statement },
      );
    }
  }
  return [...alreadyApplied, ...pending];
}

async function uploadScript(env, options) {
  const files = {
    ...options.modules,
    [assetsModuleName]: buildAssetsModule(options.assets),
    [shimModuleName]: buildShim(options.entry),
  };
  const metadata = {
    main_module: shimModuleName,
    compatibility_date: compatibilityDate,
    bindings: [
      { type: "d1", name: "DB", id: options.databaseId },
      { type: "plain_text", name: "TARANTULA_APP_NAME", text: options.name },
      { type: "plain_text", name: "TARANTULA_VISIBILITY", text: "public" },
    ],
  };
  await cfApiFor(env)(
    env,
    "PUT",
    `/accounts/${accountId(env)}/workers/scripts/${options.workerName}`,
    buildScriptUpload(metadata, files),
  );
}

export async function createApp(request, env) {
  const body = await readBody(request);
  const name = typeof body.name === "string" ? body.name : "";
  if (!namePattern.test(name)) {
    throw new CpError(
      400,
      "App names use 2 to 48 lowercase letters, numbers, and hyphens, starting with a letter.",
    );
  }
  const bundle = readBundle(body);
  await checkRate(request, env);

  const appId = randomAppId();
  const workerName = `i-${appId}`;
  const databaseName = `${workerName}-tables`;
  const database = await cfApiFor(env)(
    env,
    "POST",
    `/accounts/${accountId(env)}/d1/database`,
    { name: databaseName },
  );
  const databaseId = database?.uuid ?? database?.id;
  if (!databaseId) {
    throw new CpError(502, "Cloudflare did not return a database id.");
  }

  const applied = await applyMigrations(env, databaseId, bundle.migrations, []);
  await uploadScript(env, {
    modules: bundle.modules,
    assets: bundle.assets,
    entry: bundle.entry,
    databaseId,
    name,
    workerName,
  });
  await cfApiFor(env)(
    env,
    "POST",
    `/accounts/${accountId(env)}/workers/scripts/${workerName}/subdomain`,
    { enabled: true },
  );

  const subdomain = await workersSubdomain(env);
  const url = `https://${workerName}.${subdomain}.workers.dev`;
  const claimToken = randomToken();
  const manageToken = randomToken();
  const now = Date.now();
  const expiresAt = now + appTtlMs;
  await env.CP_DB.prepare(
    `INSERT INTO apps (
       app_id, name, worker_name, url, d1_id, d1_name, applied_migrations,
       claim_hash, manage_hash, created_at, claimed_at, expires_at, last_deploy_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  )
    .bind(
      appId,
      name,
      workerName,
      url,
      databaseId,
      databaseName,
      JSON.stringify(applied),
      await sha256Hex(claimToken),
      await sha256Hex(manageToken),
      now,
      expiresAt,
      now,
    )
    .run();

  return json({
    schemaVersion,
    status: "deployed",
    appId,
    name,
    url,
    claimToken,
    manageToken,
    expiresAt,
    resources: { tables: { name: databaseName } },
  });
}

async function authorize(request, env, appId) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token) {
    throw new CpError(401, "This request needs the app's manage token.");
  }
  const row = await env.CP_DB.prepare(`SELECT * FROM apps WHERE app_id = ?`)
    .bind(appId)
    .first();
  if (!row || row.manage_hash !== (await sha256Hex(token))) {
    throw new CpError(404, "That instant app was not found.", {
      appId,
      recovery:
        "Delete .tarantula/instant.json and tarantula.lock.json to deploy a new instant app.",
    });
  }
  return row;
}

export async function redeployApp(request, env, appId) {
  const row = await authorize(request, env, appId);
  const body = await readBody(request);
  const bundle = readBundle(body);

  let alreadyApplied = [];
  try {
    const parsed = JSON.parse(row.applied_migrations ?? "[]");
    if (Array.isArray(parsed)) alreadyApplied = parsed;
  } catch {
    alreadyApplied = [];
  }
  const applied = await applyMigrations(
    env,
    row.d1_id,
    bundle.migrations,
    alreadyApplied,
  );
  await uploadScript(env, {
    modules: bundle.modules,
    assets: bundle.assets,
    entry: bundle.entry,
    databaseId: row.d1_id,
    name: row.name,
    workerName: row.worker_name,
  });

  const now = Date.now();
  await env.CP_DB.prepare(
    `UPDATE apps SET applied_migrations = ?, last_deploy_at = ? WHERE app_id = ?`,
  )
    .bind(JSON.stringify(applied), now, appId)
    .run();

  return json({
    schemaVersion,
    status: "deployed",
    appId,
    name: row.name,
    url: row.url,
    expiresAt: row.expires_at ?? null,
    claimed: Boolean(row.claimed_at),
    resources: { tables: { name: row.d1_name } },
  });
}

export async function claimApp(request, env) {
  const body = await readBody(request);
  const claimToken = typeof body.claimToken === "string" ? body.claimToken : "";
  if (!claimToken) {
    throw new CpError(400, "claimToken is required.");
  }
  const row = await env.CP_DB.prepare(`SELECT * FROM apps WHERE claim_hash = ?`)
    .bind(await sha256Hex(claimToken))
    .first();
  if (!row) {
    throw new CpError(404, "That claim token does not match an instant app.", {
      recovery:
        "Claim tokens are printed once, by the deploy that created the app. Deploy again to get a new app and token.",
    });
  }
  if (!row.claimed_at) {
    await env.CP_DB.prepare(
      `UPDATE apps SET claimed_at = ?, expires_at = NULL WHERE app_id = ?`,
    )
      .bind(Date.now(), row.app_id)
      .run();
  }
  return json({
    schemaVersion,
    status: "claimed",
    appId: row.app_id,
    url: row.url,
  });
}

export async function describeApp(request, env, appId) {
  const row = await authorize(request, env, appId);
  return json({
    schemaVersion,
    status: row.claimed_at ? "claimed" : "unclaimed",
    appId: row.app_id,
    name: row.name,
    url: row.url,
    expiresAt: row.expires_at ?? null,
    claimedAt: row.claimed_at ?? null,
    lastDeployAt: row.last_deploy_at ?? null,
  });
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (path === "/v1/apps" && request.method === "POST") {
      return await createApp(request, env);
    }
    if (path === "/v1/claims" && request.method === "POST") {
      return await claimApp(request, env);
    }
    const deploys = path.match(/^\/v1\/apps\/([a-f0-9]{10})\/deploys$/);
    if (deploys && request.method === "POST") {
      return await redeployApp(request, env, deploys[1]);
    }
    const app = path.match(/^\/v1\/apps\/([a-f0-9]{10})$/);
    if (app && request.method === "GET") {
      return await describeApp(request, env, app[1]);
    }
    throw new CpError(404, `No such endpoint: ${request.method} ${path}`);
  } catch (error) {
    if (error instanceof CpError) {
      return json(
        {
          schemaVersion,
          status: "error",
          error: error.message,
          details: error.details,
        },
        error.status,
      );
    }
    return json(
      {
        schemaVersion,
        status: "error",
        error: "Tarantula instant hosting hit an unexpected error.",
        details: { message: String(error?.message ?? error) },
      },
      500,
    );
  }
}

export async function runScheduled(env) {
  const now = Date.now();
  const expired = await env.CP_DB.prepare(
    `SELECT * FROM apps WHERE claimed_at IS NULL AND expires_at < ?`,
  )
    .bind(now)
    .all();
  const deleted = [];
  for (const row of expired?.results ?? []) {
    await cfApiFor(env)(
      env,
      "DELETE",
      `/accounts/${accountId(env)}/workers/scripts/${row.worker_name}?force=true`,
      null,
    );
    await cfApiFor(env)(
      env,
      "DELETE",
      `/accounts/${accountId(env)}/d1/database/${row.d1_id}`,
      null,
    );
    await env.CP_DB.prepare(`DELETE FROM apps WHERE app_id = ?`)
      .bind(row.app_id)
      .run();
    deleted.push(row.app_id);
  }
  await env.CP_DB.prepare(`DELETE FROM rate WHERE day < ?`)
    .bind(dayKey(now - rateRetentionDays * 24 * 60 * 60 * 1000))
    .run();
  return { deleted };
}

const worker = {
  fetch: handleRequest,
  scheduled: (event, env, ctx) => {
    ctx.waitUntil(runScheduled(env));
  },
};

export default worker;
