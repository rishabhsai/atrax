// Atrax instant hosting control plane.
//
// Anonymous, no-sign-in deploys. A `atrax deploy` with no Cloudflare
// account posts its bundle here; this Worker provisions D1 and a Worker script
// in Atrax's own Cloudflare account, hands back a URL and a claim token,
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
const rateSalt = "atrax-instant-rate-v1";
const rateRetentionDays = 2;
const compatibilityDate = "2026-07-25";
const customDomainZone = "atrax.run";
const namePattern = /^[a-z][a-z0-9-]{1,47}$/;
const migrationPattern = /^\d+.*\.sql$/;
const modulePattern = /^[A-Za-z0-9_.-]+\.(js|mjs)$/;
const secretNamePattern = /^[A-Z][A-Z0-9_]{0,63}$/;
const maxSecretChars = 1024;
// sqlite_master is the only source of exported table names, and every one of
// them is checked against this before it reaches a statement.
const tableNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const maxExportBytes = 5 * 1024 * 1024;
const inviteTtlMs = 14 * 24 * 60 * 60 * 1000;
// The same pattern the CLI validates against, so a member address means the
// same thing on both paths.
const emailPattern = /^[^\s"'`\\;,@]+@[^\s"'`\\;,@]+\.[^\s"'`\\;,@]+$/;

// Reserved ahead of <name>.atrax.run: every label Atrax needs for itself, plus
// the ones a mail or DNS convention would claim. Compared case-insensitively
// even though namePattern already forces lowercase.
const reservedNames = new Set([
  "www",
  "api",
  "docs",
  "app",
  "apps",
  "mail",
  "admin",
  "account",
  "accounts",
  "status",
  "blog",
  "dev",
  "staging",
  "help",
  "support",
  "cdn",
  "assets",
  "atrax",
  "instant",
  "claim",
  "dashboard",
  "console",
  "ftp",
  "smtp",
  "imap",
  "ns1",
  "ns2",
  "root",
  "ssl",
  "test",
]);

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
    throw new CpError(500, "Atrax instant hosting is not configured yet.", {
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
  const visibility = contract.visibility ?? "public";
  if (visibility !== "public" && visibility !== "shared") {
    throw new CpError(
      400,
      'Instant hosting supports visibility "public" and "shared".',
      {
        visibility: contract.visibility,
        recovery:
          'Set "visibility" to "public" or "shared" in atrax.json and deploy again.',
      },
    );
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
  return { contract, modules, assets, migrations, entry, visibility };
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

// Cached like the workers.dev subdomain, with one difference: a lookup that
// fails is not cached. The platform token may be missing the Zone Read
// permission today and gain it tomorrow, and caching a miss would keep every
// app on workers.dev until somebody cleared the row by hand.
async function zoneId(env) {
  const cached = await env.CP_DB.prepare(`SELECT value FROM meta WHERE key = ?`)
    .bind("zone_id")
    .first();
  if (cached?.value) return cached.value;
  let id = null;
  try {
    const result = await cfApiFor(env)(
      env,
      "GET",
      `/zones?name=${customDomainZone}&status=active`,
      null,
    );
    id = result?.[0]?.id ?? null;
  } catch {
    return null;
  }
  if (!id) return null;
  await env.CP_DB.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind("zone_id", id)
    .run();
  return id;
}

// Gives the app the vanity hostname a person would actually type. The labels
// Atrax needs for itself are already refused at name validation, so the only
// clash left is another instant app holding the same name; that one gets four
// hex characters appended. Every Cloudflare failure here — no zone, no
// permission, a rejected attach — returns null and leaves the app on its
// workers.dev URL, because a prettier URL is never worth a failed deploy.
async function attachDomain(env, options) {
  try {
    const zone = await zoneId(env);
    if (!zone) return null;
    let hostname = `${options.name}.${customDomainZone}`;
    const taken = await env.CP_DB.prepare(
      `SELECT 1 FROM apps WHERE hostname = ?`,
    )
      .bind(hostname)
      .first();
    if (taken) {
      const suffix = toHex(crypto.getRandomValues(new Uint8Array(2)));
      hostname = `${options.name}-${suffix}.${customDomainZone}`;
    }
    const result = await cfApiFor(env)(
      env,
      "PUT",
      `/accounts/${accountId(env)}/workers/domains`,
      {
        zone_id: zone,
        hostname,
        service: options.workerName,
        environment: "production",
      },
    );
    return { hostname, domainId: result?.id ?? null };
  } catch {
    return null;
  }
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
      { type: "plain_text", name: "ATRAX_APP_NAME", text: options.name },
      { type: "plain_text", name: "ATRAX_VISIBILITY", text: options.visibility },
    ],
  };
  await cfApiFor(env)(
    env,
    "PUT",
    `/accounts/${accountId(env)}/workers/scripts/${options.workerName}`,
    buildScriptUpload(metadata, files),
  );
}

// A shared app's Door gate signs its session cookies with DOOR_SESSION_SECRET.
// The value is generated here, handed straight to Cloudflare as a Worker
// secret, and never stored or returned; CP_DB records only that provisioning
// happened, so a redeploy leaves live sessions and open invites working.
// That marker is also what tells the member endpoints an app is shared.
async function ensureDoorSecret(env, options) {
  if (options.visibility !== "shared" || options.doorSecretSet) return false;
  await cfApiFor(env)(
    env,
    "PUT",
    `/accounts/${accountId(env)}/workers/scripts/${options.workerName}/secrets`,
    { name: "DOOR_SESSION_SECRET", text: randomToken(), type: "secret_text" },
  );
  return true;
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
  if (reservedNames.has(name.toLowerCase())) {
    throw new CpError(400, `The name ${name} is reserved for Atrax itself.`, {
      name,
      recovery: "Choose a different app name in atrax.json and deploy again.",
    });
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
    visibility: bundle.visibility,
  });
  const doorSecretSet = await ensureDoorSecret(env, {
    visibility: bundle.visibility,
    workerName,
    doorSecretSet: false,
  });
  await cfApiFor(env)(
    env,
    "POST",
    `/accounts/${accountId(env)}/workers/scripts/${workerName}/subdomain`,
    { enabled: true },
  );

  const subdomain = await workersSubdomain(env);
  const domain = await attachDomain(env, { workerName, name });
  const url = domain
    ? `https://${domain.hostname}`
    : `https://${workerName}.${subdomain}.workers.dev`;
  const claimToken = randomToken();
  const manageToken = randomToken();
  const now = Date.now();
  const expiresAt = now + appTtlMs;
  await env.CP_DB.prepare(
    `INSERT INTO apps (
       app_id, name, worker_name, url, d1_id, d1_name, applied_migrations,
       claim_hash, manage_hash, created_at, claimed_at, expires_at, last_deploy_at,
       door_secret_set, hostname, domain_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
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
      doorSecretSet ? 1 : null,
      domain?.hostname ?? null,
      domain?.domainId ?? null,
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
        "Delete .atrax/instant.json and atrax.lock.json to deploy a new instant app.",
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
    visibility: bundle.visibility,
  });
  if (
    await ensureDoorSecret(env, {
      visibility: bundle.visibility,
      workerName: row.worker_name,
      doorSecretSet: Boolean(row.door_secret_set),
    })
  ) {
    await env.CP_DB.prepare(
      `UPDATE apps SET door_secret_set = 1 WHERE app_id = ?`,
    )
      .bind(appId)
      .run();
  }

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

function assertSecretName(name) {
  if (!secretNamePattern.test(name)) {
    throw new CpError(
      400,
      "Secret names use 1 to 64 uppercase letters, numbers, and underscores, starting with a letter.",
      { name },
    );
  }
}

// The value is forwarded to Cloudflare and nowhere else: it is never written to
// CP_DB, never returned, and never part of an error message.
export async function setSecret(request, env, appId, name) {
  const row = await authorize(request, env, appId);
  assertSecretName(name);
  const body = await readBody(request);
  const value = typeof body.value === "string" ? body.value : null;
  if (!value) {
    throw new CpError(400, "value must be a non-empty string.");
  }
  if (value.length > maxSecretChars) {
    throw new CpError(400, "That secret value is too long.", {
      limit: maxSecretChars,
    });
  }
  await cfApiFor(env)(
    env,
    "PUT",
    `/accounts/${accountId(env)}/workers/scripts/${row.worker_name}/secrets`,
    { name, text: value, type: "secret_text" },
  );
  return json({ schemaVersion, status: "set", name });
}

export async function removeSecret(request, env, appId, name) {
  const row = await authorize(request, env, appId);
  assertSecretName(name);
  try {
    await cfApiFor(env)(
      env,
      "DELETE",
      `/accounts/${accountId(env)}/workers/scripts/${row.worker_name}/secrets/${name}`,
      null,
    );
  } catch (error) {
    if (error instanceof CpError && error.details?.status === 404) {
      throw new CpError(404, `${name} is not set on this app.`, { name });
    }
    throw error;
  }
  return json({ schemaVersion, status: "removed", name });
}

// Members of a shared instant app live in that app's own D1 `door_members`
// table, exactly where the Cloudflare-account path puts them. The account path
// gets there with `wrangler d1 execute`; here the control plane uses the same
// platform token it provisions with, and D1's query endpoint takes bound
// parameters, so nothing is escaped into the statement.
async function appQuery(env, row, sql, params = []) {
  const result = await cfApiFor(env)(
    env,
    "POST",
    `/accounts/${accountId(env)}/d1/database/${row.d1_id}/query`,
    { sql, params },
  );
  const first = Array.isArray(result) ? result[0] : result;
  return Array.isArray(first?.results) ? first.results : [];
}

function assertShared(row) {
  if (!row.door_secret_set) {
    throw new CpError(409, "Members are only available on a shared app.", {
      appId: row.app_id,
      recovery:
        'Set "visibility": "shared" in atrax.json, run atrax deploy, then invite members.',
    });
  }
}

// A malformed percent-escape is a bad address, not a control-plane crash: the
// raw segment falls through to assertEmail and comes back as a 400.
function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assertEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length < 3 || email.length > 254 || !emailPattern.test(email)) {
    throw new CpError(
      400,
      "Enter one email address without quotes, commas, or whitespace.",
      { email: typeof value === "string" ? value : null },
    );
  }
  return email;
}

export async function addMember(request, env, appId) {
  const row = await authorize(request, env, appId);
  assertShared(row);
  const body = await readBody(request);
  const email = assertEmail(body.email);

  const existing = await appQuery(
    env,
    row,
    `SELECT id, joined_at FROM door_members WHERE email = ?`,
    [email],
  );
  if (existing[0]?.joined_at) {
    throw new CpError(409, `${email} has already joined this app.`, {
      email,
      recovery: `Run atrax share remove ${email} first if you need to send a new invitation.`,
    });
  }

  // The invite token leaves in the response and nowhere else: only its
  // SHA-256 hex reaches the app's database.
  const token = randomToken();
  const now = Date.now();
  const expiresAt = now + inviteTtlMs;
  await appQuery(
    env,
    row,
    `INSERT INTO door_members (email, invite_hash, invite_expires_at, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       invite_hash = excluded.invite_hash,
       invite_expires_at = excluded.invite_expires_at`,
    [email, await sha256Hex(token), expiresAt, now],
  );

  const inviteUrl = `${String(row.url).replace(/\/+$/, "")}/.door/join?token=${token}`;
  return json({ schemaVersion, status: "invited", email, inviteUrl, expiresAt });
}

export async function listMembers(request, env, appId) {
  const row = await authorize(request, env, appId);
  assertShared(row);
  const rows = await appQuery(
    env,
    row,
    `SELECT email, joined_at, invite_expires_at FROM door_members ORDER BY email ASC`,
  );
  const now = Date.now();
  const members = rows.map((member) => {
    const joinedAt = member.joined_at ?? null;
    const inviteExpiresAt = member.invite_expires_at ?? null;
    return {
      email: member.email,
      state: joinedAt
        ? "joined"
        : inviteExpiresAt && inviteExpiresAt > now
          ? "invited"
          : "expired",
      joinedAt,
      inviteExpiresAt,
    };
  });
  return json({ schemaVersion, status: "ok", members });
}

export async function removeMember(request, env, appId, rawEmail) {
  const row = await authorize(request, env, appId);
  assertShared(row);
  const email = assertEmail(rawEmail);
  await appQuery(env, row, `DELETE FROM door_members WHERE email = ?`, [email]);
  return json({ schemaVersion, status: "removed", email });
}

// Shared by the daily sweep and by an explicit `atrax delete`, so both paths
// tear down exactly the same resources in the same order.
async function deleteAppResources(env, row) {
  // The custom domain goes first and its failure is swallowed: Cloudflare may
  // have dropped the record already, and a hostname nobody can reach must not
  // keep the Worker, the database, and the row alive.
  if (row.domain_id) {
    try {
      await cfApiFor(env)(
        env,
        "DELETE",
        `/accounts/${accountId(env)}/workers/domains/${row.domain_id}`,
        null,
      );
    } catch {
      // Ignored on purpose; teardown continues.
    }
  }
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
}

export async function deleteApp(request, env, appId) {
  const row = await authorize(request, env, appId);
  await deleteAppResources(env, row);
  return json({ schemaVersion, status: "deleted", appId });
}

export async function describeApp(request, env, appId) {
  const row = await authorize(request, env, appId);
  return json({
    schemaVersion,
    status: row.claimed_at ? "claimed" : "unclaimed",
    appId: row.app_id,
    name: row.name,
    url: row.url,
    hostname: row.hostname ?? null,
    expiresAt: row.expires_at ?? null,
    claimedAt: row.claimed_at ?? null,
    lastDeployAt: row.last_deploy_at ?? null,
    resources: { tables: { name: row.d1_name } },
  });
}

// Every table an app created for itself: SQLite's own bookkeeping, D1's
// internal `_cf_` tables, and the migrations ledger are not the app's data.
const exportListSql =
  `SELECT name FROM sqlite_master WHERE type='table'` +
  ` AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'` +
  ` AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'` +
  ` AND name != 'd1_migrations'`;

// The table name is interpolated because D1 cannot bind an identifier, so it
// is taken from sqlite_master and then still checked against tableNamePattern;
// anything else is left out of the export rather than quoted into a statement.
export async function exportApp(request, env, appId) {
  const row = await authorize(request, env, appId);
  const listed = await appQuery(env, row, exportListSql);
  const tables = {};
  let bytes = 0;
  for (const item of listed) {
    const name = typeof item?.name === "string" ? item.name : "";
    if (!tableNamePattern.test(name)) continue;
    const rows = await appQuery(env, row, `SELECT * FROM "${name}"`);
    bytes += textEncoder.encode(JSON.stringify(rows)).byteLength;
    if (bytes > maxExportBytes) {
      throw new CpError(413, "That export is too large for instant hosting.", {
        limitBytes: maxExportBytes,
        recovery:
          "Claim the app and export it with your own Cloudflare account, or delete rows you no longer need.",
      });
    }
    tables[name] = { columns: rows.length ? Object.keys(rows[0]) : [], rows };
  }
  return json({
    schemaVersion,
    status: "exported",
    appId: row.app_id,
    name: row.name,
    exportedAt: Date.now(),
    tables,
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
    const members = path.match(/^\/v1\/apps\/([a-f0-9]{10})\/members$/);
    if (members && request.method === "POST") {
      return await addMember(request, env, members[1]);
    }
    if (members && request.method === "GET") {
      return await listMembers(request, env, members[1]);
    }
    const member = path.match(
      /^\/v1\/apps\/([a-f0-9]{10})\/members\/([^/]{1,320})$/,
    );
    if (member && request.method === "DELETE") {
      return await removeMember(
        request,
        env,
        member[1],
        decodePathSegment(member[2]),
      );
    }
    const exported = path.match(/^\/v1\/apps\/([a-f0-9]{10})\/export$/);
    if (exported && request.method === "GET") {
      return await exportApp(request, env, exported[1]);
    }
    const secret = path.match(/^\/v1\/apps\/([a-f0-9]{10})\/secrets\/([^/]{1,80})$/);
    if (secret && request.method === "PUT") {
      return await setSecret(request, env, secret[1], secret[2]);
    }
    if (secret && request.method === "DELETE") {
      return await removeSecret(request, env, secret[1], secret[2]);
    }
    const app = path.match(/^\/v1\/apps\/([a-f0-9]{10})$/);
    if (app && request.method === "GET") {
      return await describeApp(request, env, app[1]);
    }
    if (app && request.method === "DELETE") {
      return await deleteApp(request, env, app[1]);
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
        error: "Atrax instant hosting hit an unexpected error.",
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
    await deleteAppResources(env, row);
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
