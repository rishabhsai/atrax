#!/usr/bin/env node

import {
  access,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);

// npm may hoist wrangler next to atrax instead of nesting it, so resolve it
// like a module before falling back to the in-repo layout.
function resolveWranglerBin() {
  try {
    const require = createRequire(import.meta.url);
    return join(
      dirname(require.resolve("wrangler/package.json")),
      "bin",
      "wrangler.js",
    );
  } catch {
    return join(packageRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  }
}

const wranglerBin = process.env.ATRAX_WRANGLER_BIN ?? resolveWranglerBin();
// Atrax instant hosting. The deployed Worker still carries its original name,
// so the origin below stays until api.atrax.run lands.
const instantOriginDefault = "https://tarantula-instant.rishabhsai-mdbar.workers.dev";
const instantOrigin = process.env.ATRAX_INSTANT_ORIGIN ?? instantOriginDefault;
const argv = process.argv.slice(2);
const command = argv[0] ?? "help";
const commandArgs = argv.slice(1);
const jsonOutput = commandArgs.includes("--json");

class CliError extends Error {
  constructor(message, details = null) {
    super(message);
    this.details = details;
  }
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    process.stdout.write(
      `${JSON.stringify({
        schemaVersion: 1,
        status: "error",
        error: message,
        details: error instanceof CliError ? error.details : null,
      })}\n`,
    );
  } else {
    process.stderr.write(`atrax: ${message}\n`);
  }
  process.exitCode = 1;
}

function hasFlag(name) {
  return commandArgs.includes(name);
}

function optionValue(name) {
  const index = commandArgs.indexOf(name);
  if (index === -1) return null;
  const value = commandArgs[index + 1];
  if (!value || value.startsWith("-")) {
    throw new CliError(`${name} needs a value`);
  }
  return value;
}

function positionals() {
  const values = [];
  for (let index = 0; index < commandArgs.length; index += 1) {
    const value = commandArgs[index];
    if (value === "--json" || value === "--dry-run") {
      continue;
    }
    if (value === "--template" || value === "--port") {
      index += 1;
      continue;
    }
    // A claim token is base64url and may legitimately begin with "-".
    if (command === "claim" || !value.startsWith("-")) values.push(value);
  }
  return values;
}

function validateCommandArgs() {
  const specs = {
    new: { flags: ["--json"], values: ["--template"], positionals: 1 },
    dev: { flags: [], values: ["--port"], positionals: 0 },
    deploy: {
      flags: ["--json", "--dry-run", "--instant"],
      values: [],
      positionals: 0,
    },
    claim: { flags: ["--json"], values: [], positionals: 1, rawPositionals: true },
    plan: { flags: ["--json"], values: [], positionals: 0 },
    drift: { flags: ["--json"], values: [], positionals: 0 },
    inspect: { flags: ["--json"], values: [], positionals: 0 },
    logs: { flags: ["--json"], values: [], positionals: 0 },
    doctor: { flags: ["--json"], values: [], positionals: 0 },
    share: { flags: ["--json"], values: [], positionals: null },
    secret: { flags: ["--json"], values: [], positionals: null },
    delete: { flags: ["--json", "--yes"], values: [], positionals: 0 },
    help: { flags: [], values: [], positionals: 0 },
    "--help": { flags: [], values: [], positionals: 0 },
    "-h": { flags: [], values: [], positionals: 0 },
    "--version": { flags: [], values: [], positionals: 0 },
    "-v": { flags: [], values: [], positionals: 0 },
  };
  const spec = specs[command];
  if (!spec) return;
  let positionalCount = 0;
  for (let index = 0; index < commandArgs.length; index += 1) {
    const value = commandArgs[index];
    if (spec.flags.includes(value)) continue;
    if (spec.values.includes(value)) {
      const option = commandArgs[index + 1];
      if (!option || option.startsWith("-")) {
        throw new CliError(`${value} needs a value`);
      }
      index += 1;
      continue;
    }
    if (value.startsWith("-") && !spec.rawPositionals) {
      throw new CliError(`Unknown option for ${command}: ${value}`);
    }
    positionalCount += 1;
  }
  if (spec.positionals !== null && positionalCount !== spec.positionals) {
    throw new CliError(
      `${command} expects ${spec.positionals} positional argument${spec.positionals === 1 ? "" : "s"}`,
    );
  }
}

async function pathExists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function readJson(pathname, label) {
  let source;
  try {
    source = await readFile(pathname, "utf8");
  } catch {
    throw new CliError(`${label} is missing at ${pathname}`);
  }

  try {
    return JSON.parse(source);
  } catch {
    throw new CliError(`${label} is not valid JSON at ${pathname}`);
  }
}

async function findAppRoot(start = process.cwd()) {
  let current = resolve(start);
  while (true) {
    if (await pathExists(join(current, "atrax.json"))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new CliError(
        "No atrax.json found. Run this inside an Atrax app.",
      );
    }
    current = parent;
  }
}

function validateName(name) {
  if (!/^[a-z][a-z0-9-]{1,47}$/.test(name)) {
    throw new CliError(
      "App names use 2 to 48 lowercase letters, numbers, and hyphens, starting with a letter.",
    );
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(`${label} must be an object`);
  }
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new CliError(`${label} contains an unknown property: ${key}`);
    }
  }
}

function validateContract(contract) {
  assertObject(contract, "atrax.json");
  rejectUnknownKeys(
    contract,
    ["$schema", "version", "name", "visibility", "web", "tables"],
    "atrax.json",
  );
  if (contract.version !== 1) {
    throw new CliError("atrax.json version must be 1");
  }
  validateName(contract.name);
  if (contract.visibility !== "public" && contract.visibility !== "shared") {
    throw new CliError(
      'Atrax v0 supports visibility "public" and "shared". Private apps are not available yet.',
    );
  }
  if (!contract.web?.entry || !contract.web?.assets) {
    throw new CliError("atrax.json needs web.entry and web.assets");
  }
  assertObject(contract.web, "web");
  rejectUnknownKeys(contract.web, ["entry", "assets", "health"], "web");
  if (
    typeof contract.web.entry !== "string" ||
    typeof contract.web.assets !== "string"
  ) {
    throw new CliError("web.entry and web.assets must be strings");
  }
  if (
    contract.web.health !== undefined &&
    (typeof contract.web.health !== "string" ||
      !contract.web.health.startsWith("/") ||
      contract.web.health.startsWith("//") ||
      contract.web.health.includes("\\"))
  ) {
    throw new CliError(
      "web.health must be a same-origin absolute path when provided",
    );
  }
  if (!contract.tables?.migrations) {
    throw new CliError("atrax.json needs tables.migrations");
  }
  assertObject(contract.tables, "tables");
  rejectUnknownKeys(contract.tables, ["migrations"], "tables");
  if (typeof contract.tables.migrations !== "string") {
    throw new CliError("tables.migrations must be a string");
  }
}

function toConfigPath(appRoot, configDir, pathname) {
  return relative(configDir, resolve(appRoot, pathname)).split(sep).join("/");
}

function localDatabaseId(name) {
  const hex = createHash("sha256").update(name).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function loadApp() {
  const root = await findAppRoot();
  const contract = await readJson(join(root, "atrax.json"), "atrax.json");
  validateContract(contract);
  const lockPath = join(root, "atrax.lock.json");
  const lock = (await pathExists(lockPath))
    ? await readJson(lockPath, "atrax.lock.json")
    : null;
  // An instant app's Worker is named by the control plane (i-<appId>), not by
  // the contract, so the ownership guard only applies to provider-named apps.
  if (lock && lock.mode !== "instant" && lock.worker?.name !== contract.name) {
    throw new CliError(
      "atrax.json name does not match the Worker recorded in atrax.lock.json.",
      {
        contractName: contract.name,
        lockedWorker: lock.worker?.name ?? null,
        recovery: "Restore the original app name. Rename is not available in v0.",
      },
    );
  }
  return { root, contract, lock, lockPath };
}

function resolveContractPath(root, declared, label) {
  if (isAbsolute(declared) || declared.includes("\\")) {
    throw new CliError(`${label} must be a portable relative path`);
  }
  const pathname = resolve(root, declared);
  const relation = relative(root, pathname);
  if (
    !relation ||
    relation === ".." ||
    relation.startsWith(`..${sep}`)
  ) {
    throw new CliError(`${label} must point inside the app directory`);
  }
  return pathname;
}

async function rejectSymlinks(pathname, label) {
  const details = await lstat(pathname);
  if (details.isSymbolicLink()) {
    throw new CliError(`${label} cannot contain symbolic links: ${pathname}`);
  }
  if (!details.isDirectory()) return;
  const entries = await readdir(pathname, { withFileTypes: true });
  for (const entry of entries) {
    await rejectSymlinks(join(pathname, entry.name), label);
  }
}

async function requirePath(pathname, kind, label) {
  let details;
  try {
    details = await stat(pathname);
  } catch {
    throw new CliError(`${label} does not exist at ${pathname}`);
  }
  const matches = kind === "file" ? details.isFile() : details.isDirectory();
  if (!matches) {
    throw new CliError(`${label} must be a ${kind}: ${pathname}`);
  }
}

async function validateAppFiles(app) {
  const entry = resolveContractPath(
    app.root,
    app.contract.web.entry,
    "web.entry",
  );
  const assets = resolveContractPath(
    app.root,
    app.contract.web.assets,
    "web.assets",
  );
  const migrations = resolveContractPath(
    app.root,
    app.contract.tables.migrations,
    "tables.migrations",
  );
  await requirePath(entry, "file", "web.entry");
  await requirePath(assets, "directory", "web.assets");
  await requirePath(migrations, "directory", "tables.migrations");
  await rejectSymlinks(entry, "web.entry");
  await rejectSymlinks(assets, "web.assets");
  await rejectSymlinks(migrations, "tables.migrations");
  const migrationFiles = (await readdir(migrations)).filter((name) =>
    /^\d+.*\.sql$/.test(name),
  );
  if (!migrationFiles.length) {
    throw new CliError(
      `tables.migrations needs at least one numbered .sql file: ${migrations}`,
    );
  }
  return { entry, assets, migrations, migrationFiles: migrationFiles.sort() };
}

async function compileProviderConfig(app, databaseId = null, options = {}) {
  const configDir = join(app.root, ".atrax");
  await mkdir(configDir, { recursive: true });
  const databaseName =
    app.lock?.resources?.tables?.name ?? `${app.contract.name}-tables`;
  const config = {
    name: app.contract.name,
    main: toConfigPath(app.root, configDir, app.contract.web.entry),
    compatibility_date: "2026-07-25",
    assets: {
      directory: toConfigPath(app.root, configDir, app.contract.web.assets),
      binding: "ASSETS",
      not_found_handling: "single-page-application",
      // A shared app has to run the Worker before any asset is served, or the
      // Door gate would never see requests for HTML, CSS, and JavaScript.
      run_worker_first:
        app.contract.visibility === "shared"
          ? true
          : ["/api/*", "/.well-known/*"],
    },
    d1_databases: [
      {
        binding: "DB",
        database_name: databaseName,
        database_id:
          databaseId ??
          app.lock?.resources?.tables?.id ??
          localDatabaseId(databaseName),
        migrations_dir: toConfigPath(
          app.root,
          configDir,
          app.contract.tables.migrations,
        ),
      },
    ],
    vars: {
      ATRAX_APP_NAME: app.contract.name,
      ATRAX_VISIBILITY: app.contract.visibility,
      // Only atrax dev compiles this. A local run has no members and no
      // session secret, so the Door gate stands down instead of locking the
      // developer out of their own app. Deploy never writes it.
      ...(options.local ? { ATRAX_LOCAL: "1" } : {}),
    },
    observability: {
      enabled: true,
      head_sampling_rate: 1,
    },
  };
  const configPath = join(configDir, "wrangler.jsonc");
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { config, configPath };
}

async function runWrangler(appRoot, args, options = {}) {
  if (!(await pathExists(wranglerBin))) {
    throw new CliError(
      "Wrangler is missing from the Atrax installation. Reinstall Atrax.",
    );
  }

  const capture = options.capture ?? false;
  const quiet = options.quiet ?? false;
  const env = {
    ...process.env,
    ...(options.env ?? {}),
    WRANGLER_LOG_PATH: join(appRoot, ".atrax", "wrangler.log"),
  };

  const stdin = options.input === undefined ? "inherit" : "pipe";

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [wranglerBin, ...args], {
      cwd: appRoot,
      env,
      stdio: capture ? [stdin, "pipe", "pipe"] : [stdin, "inherit", "inherit"],
    });
    let stdout = "";
    let stderr = "";

    if (options.input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(options.input);
    }

    if (capture) {
      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        if (!quiet) process.stdout.write(text);
      });
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        if (!quiet) process.stderr.write(text);
      });
    }

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        rejectPromise(
          new CliError(`Wrangler exited with code ${code}`, {
            command: ["wrangler", ...args].join(" "),
            output: `${stdout}\n${stderr}`.trim(),
          }),
        );
      }
    });
  });
}

function parseJsonOutput(output, label) {
  const trimmed = output.trim();
  const starts = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter(
    (index) => index >= 0,
  );
  const start = starts.length ? Math.min(...starts) : -1;
  if (start === -1) throw new CliError(`${label} did not return JSON`);
  try {
    return JSON.parse(trimmed.slice(start));
  } catch {
    throw new CliError(`${label} returned unreadable JSON`);
  }
}

function findAccounts(value) {
  const candidates = [
    value?.accounts,
    value?.result?.accounts,
    value?.memberships,
    value?.result?.memberships,
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const accounts = candidate
      .map((item) => item?.account ?? item)
      .filter((item) => item?.id)
      .map((item) => ({ id: item.id, name: item.name ?? item.id }));
    if (accounts.length) return accounts;
  }
  return [];
}

async function currentAccount(app, quiet) {
  const result = await runWrangler(app.root, ["whoami", "--json"], {
    capture: true,
    quiet,
  });
  const payload = parseJsonOutput(
    `${result.stdout}\n${result.stderr}`,
    "wrangler whoami",
  );
  const accounts = findAccounts(payload);
  const requested = process.env.CLOUDFLARE_ACCOUNT_ID;
  const account = requested
    ? accounts.find((item) => item.id === requested)
    : accounts.length === 1
      ? accounts[0]
      : null;

  if (!account) {
    throw new CliError(
      accounts.length > 1
        ? "More than one Cloudflare account is available. Set CLOUDFLARE_ACCOUNT_ID."
        : "No Cloudflare account is available. Run wrangler login.",
      { accounts },
    );
  }
  if (app.lock?.accountId && app.lock.accountId !== account.id) {
    throw new CliError(
      "This app is locked to a different Cloudflare account. Switch accounts before deploying.",
      { expected: app.lock.accountId, actual: account.id },
    );
  }
  return account;
}

async function listDatabases(app, quiet) {
  const result = await runWrangler(app.root, ["d1", "list", "--json"], {
    capture: true,
    quiet,
  });
  const payload = parseJsonOutput(
    `${result.stdout}\n${result.stderr}`,
    "wrangler d1 list",
  );
  return Array.isArray(payload) ? payload : payload.result ?? [];
}

function databaseIdentity(database) {
  return {
    id: database.uuid ?? database.id,
    name: database.name,
  };
}

async function resolveDatabase(app, quiet) {
  const locked = app.lock?.resources?.tables;
  const name = locked?.name ?? `${app.contract.name}-tables`;
  let databases = await listDatabases(app, quiet);
  let database = locked
    ? databases.find(
        (item) =>
          (item.uuid ?? item.id) === locked.id && item.name === locked.name,
      )
    : databases.find((item) => item.name === name);

  if (!locked && database) {
    throw new CliError(
      `A D1 database named ${name} already exists, but this app has no lockfile proving ownership.`,
      {
        name,
        id: database.uuid ?? database.id,
        recovery:
          "Choose a different app name. Explicit resource adoption is not available in v0.",
      },
    );
  }

  if (locked && !database) {
    throw new CliError(
      "The D1 database in atrax.lock.json was not found in this account.",
      { name: locked.name, id: locked.id },
    );
  }

  if (!database) {
    await runWrangler(app.root, ["d1", "create", name], {
      capture: true,
      quiet,
    });
    databases = await listDatabases(app, quiet);
    database = databases.find((item) => item.name === name);
  }

  const identity = database ? databaseIdentity(database) : null;
  if (!identity?.id) {
    throw new CliError(`Could not resolve the D1 database ${name}`);
  }
  return identity;
}

async function workerExists(app, account) {
  try {
    await runWrangler(
      app.root,
      ["deployments", "list", "--name", app.contract.name, "--json"],
      {
        capture: true,
        quiet: true,
        env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
      },
    );
  } catch (error) {
    if (
      error instanceof CliError &&
      error.details?.output?.includes("[code: 10007]")
    ) {
      return false;
    }
    throw error;
  }
  return true;
}

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function parsePendingMigrations(output, knownFiles) {
  const text = output.replace(ansiPattern, "");
  if (/no migrations to apply/i.test(text)) return [];
  const names = [];
  for (const line of text.split("\n")) {
    if (!/[│|]/.test(line)) continue;
    for (const cell of line.split(/[│|]/)) {
      const value = cell.trim();
      if (/^\d.*\.sql$/.test(value) && !names.includes(value)) names.push(value);
    }
  }
  if (names.length) return names;
  return knownFiles.filter((name) => text.includes(name));
}

async function pendingMigrations(app, configPath, account, knownFiles) {
  const result = await runWrangler(
    app.root,
    ["d1", "migrations", "list", "DB", "--remote", "--config", configPath],
    {
      capture: true,
      quiet: true,
      env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
    },
  );
  return parsePendingMigrations(
    `${result.stdout}\n${result.stderr}`,
    knownFiles,
  );
}

async function assertWorkerNameAvailable(app, account) {
  if (app.lock) return;
  if (!(await workerExists(app, account))) return;
  throw new CliError(
    `A Worker named ${app.contract.name} already exists, but this app has no lockfile proving ownership.`,
    {
      name: app.contract.name,
      recovery:
        "Choose a different app name. Explicit resource adoption is not available in v0.",
    },
  );
}

async function deploymentStatus(app, configPath, quiet) {
  const result = await runWrangler(
    app.root,
    ["deployments", "status", "--config", configPath, "--json"],
    { capture: true, quiet },
  );
  return parseJsonOutput(
    `${result.stdout}\n${result.stderr}`,
    "wrangler deployments status",
  );
}

async function waitForLive(url, healthPath) {
  if (!url) {
    throw new CliError("Wrangler did not return the deployment URL.");
  }
  const baseUrl = new URL(url);
  const healthUrl = new URL(healthPath, baseUrl);
  if (healthUrl.origin !== baseUrl.origin) {
    throw new CliError("web.health must resolve on the deployed app origin.");
  }
  // Offline harnesses point the readiness probe at a local stand-in. The
  // deployed URL recorded in the lockfile is unaffected.
  const probeUrl = process.env.ATRAX_READINESS_ORIGIN
    ? new URL(healthUrl.pathname + healthUrl.search, process.env.ATRAX_READINESS_ORIGIN)
    : healthUrl;
  let lastStatus = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(probeUrl, { cache: "no-store" });
      lastStatus = response.status;
      if (response.ok) return;
    } catch {
      lastStatus = "unreachable";
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  }
  throw new CliError("The deployment did not become ready within 30 seconds.", {
    url,
    lastStatus,
  });
}

function findFirstValue(value, keys) {
  if (!value || typeof value !== "object") return null;
  for (const key of keys) {
    if (typeof value[key] === "string") return value[key];
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findFirstValue(item, keys);
        if (found) return found;
      }
    } else if (child && typeof child === "object") {
      const found = findFirstValue(child, keys);
      if (found) return found;
    }
  }
  return null;
}

const inviteTtlMs = 14 * 24 * 60 * 60 * 1000;

// Door v0 talks to remote D1 through `wrangler d1 execute --command`, which has
// no bind parameters. Emails are validated against a strict pattern that
// excludes quotes and whitespace first, then single-quote escaped, so a member
// address can never terminate the literal it sits in.
function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function validateEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s"'`\\;,@]+@[^\s"'`\\;,@]+\.[^\s"'`\\;,@]+$/.test(email)
  ) {
    throw new CliError(
      "Enter one email address without quotes, commas, or whitespace.",
      { email: typeof value === "string" ? value : null },
    );
  }
  return email;
}

async function loadSharedApp() {
  const app = await loadApp();
  if (app.contract.visibility !== "shared") {
    throw new CliError(
      `atrax share needs visibility "shared" in atrax.json. This app is "${app.contract.visibility}".`,
      {
        visibility: app.contract.visibility,
        recovery:
          'Set "visibility": "shared" in atrax.json, run atrax deploy, then run atrax share add <email>.',
      },
    );
  }
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run atrax deploy.", {
      recovery:
        "Run atrax deploy so the shared app and its member table exist, then run atrax share add <email>.",
    });
  }
  return app;
}

async function runQuery(app, configPath, account, sql) {
  const result = await runWrangler(
    app.root,
    ["d1", "execute", "DB", "--remote", "--config", configPath, "--command", sql, "--json"],
    {
      capture: true,
      quiet: true,
      env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
    },
  );
  const payload = parseJsonOutput(
    `${result.stdout}\n${result.stderr}`,
    "wrangler d1 execute",
  );
  const first = Array.isArray(payload) ? payload[0] : payload;
  return Array.isArray(first?.results) ? first.results : [];
}

// The Worker must exist before a Worker secret can be attached to it, so this
// runs after the first successful `wrangler deploy`. `wrangler secret put`
// publishes a new Worker version carrying the secret; no second deploy is
// needed. The secret is generated here, piped through stdin, and never written
// to disk: the lockfile records only that provisioning happened.
async function provisionDoorSecret(app, configPath, account) {
  await runWrangler(
    app.root,
    ["secret", "put", "DOOR_SESSION_SECRET", "--config", configPath],
    {
      capture: true,
      quiet: true,
      input: `${randomBytes(32).toString("base64")}\n`,
      env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
    },
  );
}

// Two backends write the same member table: the Cloudflare-account path
// through Wrangler, and the instant path through the control plane. The
// payloads and the human output are produced here once, so `atrax share`
// reads identically whichever one answered.
function emitInvited(payload) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Invited ${payload.email}\n\n  ${payload.inviteUrl}\n\nSend this link to ${payload.email}. It works once and expires in 14 days.\n`,
    );
  }
}

function emitMembers(app, payload) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else if (!payload.members.length) {
    process.stdout.write(
      `No members yet. Run atrax share add <email> to invite someone.\n`,
    );
  } else {
    const lines = payload.members.map(
      (item) => `  ${item.state.padEnd(8)} ${item.email}\n`,
    );
    process.stdout.write(
      `Members of ${app.contract.name}\n\n${lines.join("")}`,
    );
  }
}

function emitRemoved(payload) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Removed ${payload.email}. Their session stops working when it expires.\n`,
    );
  }
}

async function shareAdd(app, configPath, account, email) {
  const workerUrl = app.lock.worker?.url;
  if (!workerUrl) {
    throw new CliError(
      "This app has no recorded URL yet. Run atrax deploy before inviting people.",
    );
  }
  const existing = await runQuery(
    app,
    configPath,
    account,
    `SELECT id, joined_at FROM door_members WHERE email = ${sqlText(email)}`,
  );
  if (existing[0]?.joined_at) {
    throw new CliError(`${email} has already joined this app.`, {
      email,
      recovery: `Run atrax share remove ${email} first if you need to send a new invitation.`,
    });
  }

  const token = randomBytes(32).toString("base64url");
  const inviteHash = createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const expiresAt = now + inviteTtlMs;
  await runQuery(
    app,
    configPath,
    account,
    `INSERT INTO door_members (email, invite_hash, invite_expires_at, created_at)
     VALUES (${sqlText(email)}, ${sqlText(inviteHash)}, ${expiresAt}, ${now})
     ON CONFLICT(email) DO UPDATE SET
       invite_hash = excluded.invite_hash,
       invite_expires_at = excluded.invite_expires_at`,
  );

  const inviteUrl = `${workerUrl.replace(/\/+$/, "")}/.door/join?token=${token}`;
  emitInvited({
    schemaVersion: 1,
    status: "invited",
    email,
    inviteUrl,
    expiresAt,
  });
}

async function shareList(app, configPath, account) {
  const rows = await runQuery(
    app,
    configPath,
    account,
    `SELECT email, joined_at, invite_expires_at FROM door_members ORDER BY email ASC`,
  );
  const now = Date.now();
  const members = rows.map((row) => {
    const joinedAt = row.joined_at ?? null;
    const inviteExpiresAt = row.invite_expires_at ?? null;
    return {
      email: row.email,
      state: joinedAt
        ? "joined"
        : inviteExpiresAt && inviteExpiresAt > now
          ? "invited"
          : "expired",
      joinedAt,
      inviteExpiresAt,
    };
  });
  emitMembers(app, { schemaVersion: 1, status: "ok", members });
}

async function shareRemove(app, configPath, account, email) {
  await runQuery(
    app,
    configPath,
    account,
    `DELETE FROM door_members WHERE email = ${sqlText(email)}`,
  );
  emitRemoved({ schemaVersion: 1, status: "removed", email });
}

// The instant path never touches Wrangler: the control plane holds the
// platform token that reaches the app's own D1, and the manage token in
// .atrax/instant.json is what proves this machine owns the app.
async function instantShareAdd(state, email) {
  const result = await instantRequest(`/v1/apps/${state.appId}/members`, {
    body: { email },
    token: state.manageToken,
  });
  emitInvited({
    schemaVersion: 1,
    status: "invited",
    email: result.email ?? email,
    inviteUrl: result.inviteUrl,
    expiresAt: result.expiresAt ?? null,
  });
}

async function instantShareList(app, state) {
  const result = await instantRequest(`/v1/apps/${state.appId}/members`, {
    method: "GET",
    token: state.manageToken,
  });
  emitMembers(app, {
    schemaVersion: 1,
    status: "ok",
    members: result.members ?? [],
  });
}

async function instantShareRemove(state, email) {
  await instantRequest(
    `/v1/apps/${state.appId}/members/${encodeURIComponent(email)}`,
    { method: "DELETE", token: state.manageToken },
  );
  emitRemoved({ schemaVersion: 1, status: "removed", email });
}

async function share() {
  const [action, ...rest] = positionals();
  if (!action) {
    throw new CliError(
      "Usage: atrax share add <email> | atrax share list | atrax share remove <email>",
    );
  }
  if (!["add", "list", "remove"].includes(action)) {
    throw new CliError(`Unknown share action: ${action}`, {
      recovery: "Use atrax share add, atrax share list, or atrax share remove.",
    });
  }
  const wantsEmail = action !== "list";
  if (wantsEmail && rest.length !== 1) {
    throw new CliError(`share ${action} expects one email address`);
  }
  if (!wantsEmail && rest.length) {
    throw new CliError("share list expects no positional arguments");
  }
  const email = wantsEmail ? validateEmail(rest[0]) : null;

  const app = await loadSharedApp();
  if (app.lock.mode === "instant") {
    const { state } = await loadInstantState(
      app,
      "share",
      "Run atrax deploy first so the instant app exists, then run atrax share add <email>.",
    );
    if (action === "add") return instantShareAdd(state, email);
    if (action === "list") return instantShareList(app, state);
    return instantShareRemove(state, email);
  }
  const account = await currentAccount(app, true);
  const { configPath } = await compileProviderConfig(
    app,
    app.lock.resources?.tables?.id ?? null,
  );
  if (action === "add") return shareAdd(app, configPath, account, email);
  if (action === "list") return shareList(app, configPath, account);
  return shareRemove(app, configPath, account, email);
}

async function replaceTemplateTokens(root, name) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const pathname = join(root, entry.name);
    if (entry.isDirectory()) {
      await replaceTemplateTokens(pathname, name);
      continue;
    }
    const source = await readFile(pathname, "utf8");
    await writeFile(pathname, source.replaceAll("__APP_NAME__", name));
  }
}

async function createApp() {
  const [name] = positionals();
  if (!name) throw new CliError("Usage: atrax new <name> --template chat");
  validateName(name);
  const template = optionValue("--template") ?? "chat";
  if (template !== "chat") {
    throw new CliError('Atrax v0 includes one template: "chat"');
  }
  const target = resolve(process.cwd(), name);
  if (await pathExists(target)) {
    const targetStat = await stat(target);
    if (!targetStat.isDirectory() || (await readdir(target)).length > 0) {
      throw new CliError(`Target already exists and is not empty: ${target}`);
    }
  }
  await mkdir(target, { recursive: true });
  await cp(join(packageRoot, "templates", template), target, { recursive: true });
  await replaceTemplateTokens(target, name);
  // npm strips .gitignore from published packages, so the template ships it
  // as "gitignore" and the scaffold restores the real name.
  if (await pathExists(join(target, "gitignore"))) {
    await rename(join(target, "gitignore"), join(target, ".gitignore"));
  }

  const payload = {
    schemaVersion: 1,
    status: "created",
    name,
    template,
    directory: target,
    next: [`cd ${name}`, "atrax dev", "atrax deploy"],
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Created ${name}\n\n  cd ${name}\n  atrax dev\n\nDeploy when it is ready:\n\n  atrax deploy\n`,
    );
  }
}

async function develop() {
  const app = await loadApp();
  await validateAppFiles(app);
  const { configPath } = await compileProviderConfig(app, null, { local: true });
  const persistPath = join(app.root, ".atrax", "state");
  await runWrangler(
    app.root,
    [
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      configPath,
      "--persist-to",
      persistPath,
    ],
    { env: { CI: "1" } },
  );
  const port = optionValue("--port");
  const args = [
    "dev",
    "--config",
    configPath,
    "--persist-to",
    persistPath,
    "--live-reload",
  ];
  if (port) args.push("--port", port);
  await runWrangler(app.root, args);
}

// Instant hosting: an anonymous deploy through the Atrax control plane for
// people who have no Cloudflare account yet. The app is real and public, but
// unclaimed apps are deleted after 30 days.

function rejectInstantLock(app, name) {
  if (app.lock?.mode !== "instant") return;
  throw new CliError(`atrax ${name} is not available for instant apps yet.`, {
    mode: "instant",
    url: app.lock.worker?.url ?? null,
    recovery:
      "Claim the app with atrax claim <token>, or deploy it with a Cloudflare account to use this command.",
  });
}

// Conservative: only a genuinely absent Cloudflare login counts. Two accounts,
// a locked account mismatch, or a broken Wrangler install must surface as
// themselves rather than silently rerouting a deploy to instant hosting.
function isMissingCloudflareAuth(error) {
  if (!(error instanceof CliError)) return false;
  if (error.message.startsWith("No Cloudflare account is available")) return true;
  if (error.details?.command === "wrangler whoami --json") return true;
  return (
    error.message === "wrangler whoami did not return JSON" ||
    error.message === "wrangler whoami returned unreadable JSON"
  );
}

async function instantRequest(path, options = {}) {
  const url = `${instantOrigin.replace(/\/+$/, "")}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method: options.method ?? "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new CliError(
      `Atrax instant hosting is unreachable at ${instantOrigin}.`,
      {
        cause: String(error?.message ?? error),
        recovery:
          "Check your network connection, or run wrangler login and deploy with your own Cloudflare account.",
      },
    );
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new CliError(
      payload?.error ?? `Atrax instant hosting returned ${response.status}.`,
      payload?.details ?? { status: response.status },
    );
  }
  if (!payload) {
    throw new CliError("Atrax instant hosting returned an unreadable response.");
  }
  return payload;
}

// The template keeps worker.js next to its helper modules in src/, and instant
// hosting has no bundler, so every sibling module travels with the entry.
async function readInstantModules(entryPath) {
  const directory = dirname(entryPath);
  const entryName = basename(entryPath);
  const names = (await readdir(directory, { withFileTypes: true }))
    .filter((item) => item.isFile() && /\.(js|mjs)$/.test(item.name))
    .map((item) => item.name)
    .sort();
  if (!names.includes(entryName)) names.push(entryName);
  const modules = {};
  for (const name of names) {
    modules[name] = await readFile(join(directory, name), "utf8");
  }
  return modules;
}

async function readInstantAssets(directory, prefix = "", into = {}) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  for (const entry of entries) {
    const pathname = join(directory, entry.name);
    const key = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await readInstantAssets(pathname, key, into);
    } else if (entry.isFile()) {
      into[key] = (await readFile(pathname)).toString("base64");
    }
  }
  return into;
}

async function readInstantMigrations(directory, files) {
  const migrations = {};
  for (const name of files) {
    migrations[name] = await readFile(join(directory, name), "utf8");
  }
  return migrations;
}

async function instantDeploy(app, announce) {
  const files = await validateAppFiles(app);
  if (announce && !jsonOutput) {
    process.stdout.write(
      "No Cloudflare account detected — deploying to Atrax instant hosting.\n",
    );
  }

  const configDir = join(app.root, ".atrax");
  await mkdir(configDir, { recursive: true });
  const statePath = join(configDir, "instant.json");
  const state = (await pathExists(statePath))
    ? await readJson(statePath, ".atrax/instant.json")
    : null;

  const bundle = {
    contract: app.contract,
    modules: await readInstantModules(files.entry),
    assets: await readInstantAssets(files.assets),
    migrations: await readInstantMigrations(files.migrations, files.migrationFiles),
  };

  const result = state?.appId
    ? await instantRequest(`/v1/apps/${state.appId}/deploys`, {
        body: bundle,
        token: state.manageToken,
      })
    : await instantRequest("/v1/apps", {
        body: { name: app.contract.name, ...bundle },
      });

  const appId = result.appId;
  const url = result.url;
  const tables = result.resources?.tables?.name ?? `i-${appId}-tables`;
  // The manage token is a credential; the claim token is deliberately never
  // written down, so it exists only in the output of the deploy that minted it.
  await writeFile(
    statePath,
    `${JSON.stringify({ appId, manageToken: state?.manageToken ?? result.manageToken, url }, null, 2)}\n`,
    { mode: 0o600 },
  );
  app.lock = {
    version: 1,
    provider: "atrax-instant",
    mode: "instant",
    appId,
    worker: { name: `i-${appId}`, url },
  };
  await writeFile(app.lockPath, `${JSON.stringify(app.lock, null, 2)}\n`);

  await waitForLive(
    url,
    app.contract.web.health ?? "/.well-known/atrax.json",
  );

  const access = app.contract.visibility === "shared" ? "shared" : "public";
  const payload = {
    schemaVersion: 1,
    status: "deployed",
    mode: "instant",
    name: app.contract.name,
    url,
    appId,
    access,
    ...(result.claimToken ? { claimToken: result.claimToken } : {}),
    expiresAt: result.expiresAt ?? null,
    resources: { tables: { name: tables } },
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  process.stdout.write(`\nDeployed ${app.contract.name}\nURL: ${url}\n`);
  // Who can open this URL is the one thing a person cannot check by looking at
  // it, so every instant deploy says it plainly.
  if (access === "shared") {
    process.stdout.write(
      "Shared app: only invited members can open it. Invite someone: atrax share add <email>\n",
    );
  } else {
    process.stdout.write(
      "This app is public: anyone with the URL can open it.\n",
    );
  }
  if (result.claimToken) {
    process.stdout.write(
      `\nUnclaimed apps disappear after 30 days. Claim it to keep it and manage access:\n\n  atrax claim ${result.claimToken}\n`,
    );
  }
}

async function claim() {
  const [token] = positionals();
  if (!token) throw new CliError("Usage: atrax claim <token>");
  const result = await instantRequest("/v1/claims", {
    body: { claimToken: token },
  });
  const payload = {
    schemaVersion: 1,
    status: "claimed",
    appId: result.appId,
    url: result.url,
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Claimed ${payload.appId}\n${payload.url ? `URL: ${payload.url}\n` : ""}\nThis app no longer expires.\n`,
    );
  }
}

// Both commands below act on the control plane with the manage token, so they
// need an app that instant hosting owns rather than one in the caller's
// Cloudflare account.
async function loadInstantState(app, name, recovery) {
  const statePath = join(app.root, ".atrax", "instant.json");
  if (!(await pathExists(statePath))) {
    throw new CliError(
      `atrax ${name} works on instant apps only right now.`,
      { recovery },
    );
  }
  const state = await readJson(statePath, ".atrax/instant.json");
  if (!state?.appId || !state?.manageToken) {
    throw new CliError(
      ".atrax/instant.json is missing appId or manageToken.",
      {
        recovery:
          "Run atrax deploy to recreate the instant app, or delete .atrax/instant.json and atrax.lock.json to start over.",
      },
    );
  }
  return { state, statePath };
}

async function loadInstantApp(name, recovery) {
  const app = await loadApp();
  const { state, statePath } = await loadInstantState(app, name, recovery);
  return { app, state, statePath };
}

// The value is never an argv argument: process arguments are readable by every
// other process on the machine and land in shell history. stdin is the only
// channel that leaks neither.
async function readSecretValue() {
  if (process.stdin.isTTY) process.stderr.write("Value: ");
  process.stdin.setEncoding("utf8");
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.replace(/\r?\n$/, "");
}

async function secret() {
  const [action, ...rest] = positionals();
  if (!action) {
    throw new CliError(
      "Usage: atrax secret set <NAME> | atrax secret remove <NAME>",
    );
  }
  if (action !== "set" && action !== "remove") {
    throw new CliError(`Unknown secret action: ${action}`, {
      recovery: "Use atrax secret set or atrax secret remove.",
    });
  }
  if (rest.length !== 1) {
    throw new CliError(`secret ${action} expects one name`);
  }
  const name = rest[0];
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(name)) {
    throw new CliError(
      "Secret names use 1 to 64 uppercase letters, numbers, and underscores, starting with a letter.",
      { name },
    );
  }
  const { app, state } = await loadInstantApp(
    "secret",
    "Use npx wrangler secret put <NAME> --config .atrax/wrangler.jsonc for account apps; atrax secret covers instant apps today.",
  );

  if (action === "remove") {
    await instantRequest(`/v1/apps/${state.appId}/secrets/${name}`, {
      method: "DELETE",
      token: state.manageToken,
    });
    const payload = {
      schemaVersion: 1,
      status: "removed",
      name,
      appId: state.appId,
    };
    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(payload)}\n`);
    } else {
      process.stdout.write(`Removed ${name} from ${app.contract.name}.\n`);
    }
    return;
  }

  const value = await readSecretValue();
  if (!value) {
    throw new CliError("The secret value was empty.", {
      recovery: `Pipe the value in: printf %s "$VALUE" | atrax secret set ${name}`,
    });
  }
  if (value.length > 1024) {
    throw new CliError("Secret values are at most 1024 characters.", {
      length: value.length,
    });
  }
  await instantRequest(`/v1/apps/${state.appId}/secrets/${name}`, {
    method: "PUT",
    body: { value },
    token: state.manageToken,
  });
  const payload = { schemaVersion: 1, status: "set", name, appId: state.appId };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Set ${name} on ${app.contract.name}. It reaches the app on the next deploy or request.\n`,
    );
  }
}

async function destroy() {
  const { app, state, statePath } = await loadInstantApp(
    "delete",
    "Account apps are your own Cloudflare resources: remove them with npx wrangler delete --config .atrax/wrangler.jsonc until atrax destroy ships.",
  );
  if (!hasFlag("--yes")) {
    throw new CliError(
      "atrax delete permanently deletes the live app and everything in its Tables database.",
      {
        appId: state.appId,
        url: state.url ?? null,
        recovery: "Re-run with --yes when you are sure: atrax delete --yes",
      },
    );
  }
  await instantRequest(`/v1/apps/${state.appId}`, {
    method: "DELETE",
    token: state.manageToken,
  });
  await rm(statePath, { force: true });
  await rm(app.lockPath, { force: true });
  const payload = {
    schemaVersion: 1,
    status: "deleted",
    appId: state.appId,
    url: state.url ?? null,
    removed: [".atrax/instant.json", "atrax.lock.json"],
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Deleted ${app.contract.name} (${state.appId})\n${state.url ? `${state.url} is gone, along with its Tables database.\n` : ""}Removed .atrax/instant.json and atrax.lock.json.\n`,
    );
  }
}

async function deploy() {
  const app = await loadApp();
  await validateAppFiles(app);
  const quiet = jsonOutput;
  if (hasFlag("--dry-run")) {
    const { configPath } = await compileProviderConfig(app);
    await runWrangler(
      app.root,
      ["deploy", "--config", configPath, "--dry-run"],
      { capture: true, quiet, env: { CI: "1" } },
    );
    const payload = {
      schemaVersion: 1,
      status: "validated",
      name: app.contract.name,
    };
    process.stdout.write(
      jsonOutput
        ? `${JSON.stringify(payload)}\n`
        : `Validated ${app.contract.name}. No remote resources changed.\n`,
    );
    return;
  }

  if (hasFlag("--instant") || app.lock?.mode === "instant") {
    return instantDeploy(app, false);
  }

  let account;
  try {
    account = await currentAccount(app, quiet);
  } catch (error) {
    if (app.lock || !isMissingCloudflareAuth(error)) throw error;
    return instantDeploy(app, true);
  }
  await assertWorkerNameAvailable(app, account);
  const database = await resolveDatabase(app, quiet);
  const door = app.lock?.door ?? null;
  app.lock = {
    version: 1,
    provider: "cloudflare",
    accountId: account.id,
    worker: {
      name: app.contract.name,
      url: app.lock?.worker?.url ?? null,
      lastDeploymentId: app.lock?.worker?.lastDeploymentId ?? null,
    },
    resources: {
      tables: {
        binding: "DB",
        name: database.name,
        id: database.id,
      },
    },
    ...(door ? { door } : {}),
  };
  await writeFile(app.lockPath, `${JSON.stringify(app.lock, null, 2)}\n`);
  const { configPath } = await compileProviderConfig(app, database.id);
  await runWrangler(
    app.root,
    [
      "d1",
      "migrations",
      "apply",
      "DB",
      "--remote",
      "--config",
      configPath,
    ],
    {
      capture: true,
      quiet,
      env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
    },
  );
  const result = await runWrangler(app.root, ["deploy", "--config", configPath], {
    capture: true,
    quiet,
    env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
  });

  if (
    app.contract.visibility === "shared" &&
    !app.lock.door?.secretProvisioned
  ) {
    await provisionDoorSecret(app, configPath, account);
    app.lock.door = { secretProvisioned: true };
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const url =
    output.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/)?.[0] ??
    app.lock.worker.url;
  await waitForLive(
    url,
    app.contract.web.health ?? "/.well-known/atrax.json",
  );
  const status = await deploymentStatus(app, configPath, quiet);
  const deploymentId = findFirstValue(status, [
    "deployment_id",
    "deploymentId",
    "id",
  ]);
  app.lock.worker.url = url;
  app.lock.worker.lastDeploymentId = deploymentId ?? null;
  await writeFile(app.lockPath, `${JSON.stringify(app.lock, null, 2)}\n`);
  const payload = {
    schemaVersion: 1,
    status: "deployed",
    name: app.contract.name,
    url,
    deploymentId,
    resources: {
      tables: database,
    },
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `\nDeployed ${app.contract.name}\n${url ? `URL: ${url}\n` : ""}Tables: ${database.name}\n`,
    );
  }
}

const actionMarks = {
  create: "+",
  recreate: "+",
  update: "~",
  apply: "~",
  provision: "+",
  keep: "=",
  none: "=",
};

async function plan() {
  const app = await loadApp();
  rejectInstantLock(app, "plan");
  const files = await validateAppFiles(app);
  const quiet = jsonOutput;
  const { configPath } = await compileProviderConfig(app);
  await runWrangler(app.root, ["deploy", "--config", configPath, "--dry-run"], {
    capture: true,
    quiet,
    env: { CI: "1" },
  });

  const account = await currentAccount(app, true);
  const exists = await workerExists(app, account);
  const locked = app.lock?.resources?.tables ?? null;
  const databaseName = locked?.name ?? `${app.contract.name}-tables`;
  const databases = await listDatabases(app, true);
  const database = locked
    ? databases.find(
        (item) =>
          (item.uuid ?? item.id) === locked.id && item.name === locked.name,
      )
    : databases.find((item) => item.name === databaseName);

  const conflicts = [];
  if (!app.lock && exists) {
    conflicts.push({
      resource: `worker/${app.contract.name}`,
      name: app.contract.name,
      reason: `A Worker named ${app.contract.name} already exists, but this app has no lockfile proving ownership.`,
      recovery:
        "Choose a different app name. Explicit resource adoption is not available in v0.",
    });
  }
  if (!locked && database) {
    conflicts.push({
      resource: `d1/${databaseName}`,
      name: databaseName,
      reason: `A D1 database named ${databaseName} already exists, but this app has no lockfile proving ownership.`,
      recovery:
        "Choose a different app name. Explicit resource adoption is not available in v0.",
    });
  }

  if (conflicts.length) {
    const blocked = {
      schemaVersion: 1,
      status: "blocked",
      name: app.contract.name,
      changes: false,
      actions: [],
      migrations: { pending: [] },
      conflicts,
    };
    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(blocked)}\n`);
    } else {
      process.stderr.write(
        `Plan blocked for ${app.contract.name}\n\n${conflicts
          .map((item) => `  ! ${item.resource}\n    ${item.reason}\n    ${item.recovery}\n`)
          .join("")}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const actions = [];
  if (!app.lock) {
    actions.push({
      product: "launchpad",
      resource: `worker/${app.contract.name}`,
      action: "create",
      reason: "No Worker with this name exists in the account yet.",
    });
  } else if (exists) {
    actions.push({
      product: "launchpad",
      resource: `worker/${app.contract.name}`,
      action: "update",
      reason: "The locked Worker exists and would receive a new version.",
    });
  } else {
    actions.push({
      product: "launchpad",
      resource: `worker/${app.contract.name}`,
      action: "recreate",
      reason:
        "atrax.lock.json records this Worker, but it is missing from the account. Deploy would create it again.",
    });
  }

  if (locked && database) {
    actions.push({
      product: "tables",
      resource: `d1/${databaseName}`,
      action: "keep",
      reason: "The locked D1 database is present and unchanged.",
    });
  } else if (!locked) {
    actions.push({
      product: "tables",
      resource: `d1/${databaseName}`,
      action: "create",
      reason: "No D1 database with this name exists in the account yet.",
    });
  } else {
    actions.push({
      product: "tables",
      resource: `d1/${databaseName}`,
      action: "recreate",
      reason:
        "atrax.lock.json records this D1 database, but it is missing from the account.",
    });
  }

  let pending;
  if (database) {
    const remote = await compileProviderConfig(app, databaseIdentity(database).id);
    pending = await pendingMigrations(
      app,
      remote.configPath,
      account,
      files.migrationFiles,
    );
  } else {
    pending = [...files.migrationFiles];
  }

  if (pending.length) {
    actions.push({
      product: "tables",
      resource: "migrations",
      action: "apply",
      reason: `${pending.length} migration${pending.length === 1 ? "" : "s"} would be applied remotely.`,
    });
  } else {
    actions.push({
      product: "tables",
      resource: "migrations",
      action: "none",
      reason: "Every migration in the contract is already applied.",
    });
  }

  if (app.contract.visibility === "shared") {
    const provisioned = Boolean(app.lock?.door?.secretProvisioned);
    actions.push({
      product: "door",
      resource: "session-secret",
      action: provisioned ? "keep" : "provision",
      reason: provisioned
        ? "The Door session secret is already provisioned for this Worker."
        : "Deploy would generate DOOR_SESSION_SECRET and store it as a Worker secret.",
    });
  }

  const changes = actions.some(
    (item) => item.action !== "keep" && item.action !== "none",
  );
  const payload = {
    schemaVersion: 1,
    status: "planned",
    name: app.contract.name,
    changes,
    actions,
    migrations: { pending },
    conflicts: [],
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    const lines = actions.map(
      (item) =>
        `  ${actionMarks[item.action] ?? "?"} ${item.action.padEnd(8)} ${item.resource}\n`,
    );
    process.stdout.write(
      `Plan for ${app.contract.name}\n\n${lines.join("")}\nPending migrations: ${pending.length}\n${
        changes ? "" : "No changes.\n"
      }`,
    );
  }
}

async function drift() {
  const app = await loadApp();
  rejectInstantLock(app, "drift");
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run atrax deploy.");
  }
  const files = await validateAppFiles(app);
  const checks = [];
  let account = null;

  try {
    account = await currentAccount(app, true);
    checks.push({
      check: "account",
      expected: app.lock.accountId ?? null,
      observed: account.id,
      result: "ok",
      reason: null,
    });
  } catch (error) {
    if (!(error instanceof CliError) || !error.details?.actual) throw error;
    checks.push({
      check: "account",
      expected: error.details.expected,
      observed: error.details.actual,
      result: "drift",
      reason:
        "The active Cloudflare account is not the account recorded in atrax.lock.json.",
    });
    const skipped = ["worker", "deployment", "url", "tables", "migrations"];
    if (app.contract.visibility === "shared") skipped.push("door");
    for (const check of skipped) {
      checks.push({
        check,
        expected: null,
        observed: null,
        result: "unknown",
        reason: "Skipped because the active Cloudflare account does not match.",
      });
    }
  }

  if (account) {
    const exists = await workerExists(app, account);
    checks.push({
      check: "worker",
      expected: "present",
      observed: exists ? "present" : "missing",
      result: exists ? "ok" : "drift",
      reason: exists
        ? null
        : "The locked Worker no longer exists in this Cloudflare account.",
    });

    const { configPath } = await compileProviderConfig(
      app,
      app.lock.resources?.tables?.id ?? null,
    );

    if (!exists) {
      checks.push({
        check: "deployment",
        expected: app.lock.worker?.lastDeploymentId ?? null,
        observed: null,
        result: "unknown",
        reason: "The Worker is missing, so no deployment can be read.",
      });
      checks.push({
        check: "url",
        expected: app.lock.worker?.url ?? null,
        observed: null,
        result: "unknown",
        reason: "The Worker is missing, so no URL can be read.",
      });
    } else {
      const status = await deploymentStatus(app, configPath, true);
      const deploymentId = findFirstValue(status, [
        "deployment_id",
        "deploymentId",
        "id",
      ]);
      const lockedDeploymentId = app.lock.worker?.lastDeploymentId ?? null;
      if (!lockedDeploymentId) {
        checks.push({
          check: "deployment",
          expected: null,
          observed: deploymentId,
          result: "unknown",
          reason:
            "atrax.lock.json does not record a deployment id yet. Deploy once with this version of Atrax to record it.",
        });
      } else {
        checks.push({
          check: "deployment",
          expected: lockedDeploymentId,
          observed: deploymentId,
          result: lockedDeploymentId === deploymentId ? "ok" : "drift",
          reason:
            lockedDeploymentId === deploymentId
              ? null
              : "The live deployment was not created by this lockfile. Something deployed outside Atrax.",
        });
      }

      const observedUrl =
        JSON.stringify(status).match(
          /https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/,
        )?.[0] ?? null;
      const lockedUrl = app.lock.worker?.url ?? null;
      if (!observedUrl) {
        checks.push({
          check: "url",
          expected: lockedUrl,
          observed: null,
          result: "unknown",
          reason: "Cloudflare did not report a workers.dev URL for this Worker.",
        });
      } else {
        checks.push({
          check: "url",
          expected: lockedUrl,
          observed: observedUrl,
          result: lockedUrl === observedUrl ? "ok" : "drift",
          reason:
            lockedUrl === observedUrl
              ? null
              : "The live URL is not the URL recorded in atrax.lock.json.",
        });
      }
    }

    const locked = app.lock.resources?.tables ?? null;
    const databases = await listDatabases(app, true);
    const database = locked
      ? databases.find((item) => (item.uuid ?? item.id) === locked.id)
      : null;
    const lockedTables = locked ? `${locked.name} (${locked.id})` : null;
    if (!database) {
      checks.push({
        check: "tables",
        expected: lockedTables,
        observed: "missing",
        result: "drift",
        reason: "The locked D1 database is not present in this account.",
      });
    } else {
      const identity = databaseIdentity(database);
      const observedTables = `${identity.name} (${identity.id})`;
      checks.push({
        check: "tables",
        expected: lockedTables,
        observed: observedTables,
        result: lockedTables === observedTables ? "ok" : "drift",
        reason:
          lockedTables === observedTables
            ? null
            : "The locked D1 database was renamed outside Atrax.",
      });
    }

    if (!database) {
      checks.push({
        check: "migrations",
        expected: [],
        observed: [],
        result: "unknown",
        reason:
          "The locked D1 database is missing, so remote migration state cannot be read.",
      });
    } else {
      const pending = await pendingMigrations(
        app,
        configPath,
        account,
        files.migrationFiles,
      );
      checks.push({
        check: "migrations",
        expected: [],
        observed: pending,
        result: pending.length ? "drift" : "ok",
        reason: pending.length
          ? `${pending.length} migration${pending.length === 1 ? "" : "s"} in the contract are not applied remotely.`
          : null,
      });
    }

    if (app.contract.visibility === "shared") {
      const expected = app.lock.door?.secretProvisioned ? "present" : "absent";
      try {
        const secrets = await runWrangler(
          app.root,
          ["secret", "list", "--config", configPath, "--json"],
          {
            capture: true,
            quiet: true,
            env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
          },
        );
        const observed = `${secrets.stdout}\n${secrets.stderr}`.includes(
          "DOOR_SESSION_SECRET",
        )
          ? "present"
          : "absent";
        checks.push({
          check: "door",
          expected,
          observed,
          result: expected === observed ? "ok" : "drift",
          reason:
            expected === observed
              ? null
              : expected === "present"
                ? "atrax.lock.json records a Door session secret that the Worker no longer has. Existing invites and sessions will not work."
                : "The Worker has a DOOR_SESSION_SECRET that Atrax did not provision.",
        });
      } catch {
        checks.push({
          check: "door",
          expected,
          observed: null,
          result: "unknown",
          reason: "Cloudflare did not return the Worker secret list.",
        });
      }
    }
  }

  const drifted = checks.some((item) => item.result === "drift");
  const payload = {
    schemaVersion: 1,
    status: drifted ? "drifted" : "clean",
    name: app.contract.name,
    checks,
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    const marks = { ok: "ok   ", drift: "DRIFT", unknown: "?    " };
    const lines = checks.map((item) => {
      const expected = Array.isArray(item.expected)
        ? `${item.expected.length} pending`
        : (item.expected ?? "none");
      const observed = Array.isArray(item.observed)
        ? `${item.observed.length} pending`
        : (item.observed ?? "none");
      return `  ${marks[item.result]} ${item.check.padEnd(11)} expected ${expected}, observed ${observed}\n`;
    });
    process.stdout.write(
      `Drift for ${app.contract.name}\n\n${lines.join("")}\nStatus: ${payload.status}\n`,
    );
  }
  if (drifted) process.exitCode = 2;
}

async function inspectApp() {
  const app = await loadApp();
  rejectInstantLock(app, "inspect");
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run atrax deploy.");
  }
  const quiet = jsonOutput;
  await currentAccount(app, quiet);
  const { configPath } = await compileProviderConfig(
    app,
    app.lock.resources.tables.id,
  );
  const status = await deploymentStatus(app, configPath, quiet);
  const databaseResult = await runWrangler(
    app.root,
    ["d1", "info", app.lock.resources.tables.name, "--json"],
    { capture: true, quiet },
  );
  const database = parseJsonOutput(
    `${databaseResult.stdout}\n${databaseResult.stderr}`,
    "wrangler d1 info",
  );
  const payload = {
    schemaVersion: 1,
    status: "deployed",
    name: app.contract.name,
    url: app.lock.worker.url,
    deployment: status,
    resources: {
      tables: {
        ...app.lock.resources.tables,
        state: database,
      },
    },
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `${app.contract.name}\n${app.lock.worker.url ?? "URL unavailable"}\nTables: ${app.lock.resources.tables.name}\n`,
    );
  }
}

async function logs() {
  const app = await loadApp();
  rejectInstantLock(app, "logs");
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run atrax deploy.");
  }
  await currentAccount(app, jsonOutput);
  const { configPath } = await compileProviderConfig(
    app,
    app.lock.resources.tables.id,
  );
  const args = ["tail", app.contract.name, "--config", configPath];
  if (jsonOutput) args.push("--format", "json");
  await runWrangler(app.root, args);
}

async function doctor() {
  const app = await loadApp();
  const files = await validateAppFiles(app);
  const { configPath } = await compileProviderConfig(app);
  const quiet = jsonOutput;
  const account = await currentAccount(app, quiet);
  await runWrangler(
    app.root,
    ["deploy", "--config", configPath, "--dry-run"],
    {
      capture: true,
      quiet,
      env: { CI: "1", CLOUDFLARE_ACCOUNT_ID: account.id },
    },
  );
  const payload = {
    schemaVersion: 1,
    status: "ready",
    name: app.contract.name,
    node: process.version,
    contract: join(app.root, "atrax.json"),
    providerConfig: configPath,
    account,
    files,
    wrangler: packageJson.devDependencies?.wrangler ?? "installed",
    deployed: Boolean(app.lock),
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Atrax ${packageJson.version}\nApp: ${app.contract.name}\nNode: ${process.version}\nContract: valid\nBundle: valid\nCloudflare: ${account.name}\nDeployed: ${payload.deployed ? "yes" : "no"}\n`,
    );
  }
}

function help() {
  process.stdout.write(`Atrax ${packageJson.version}

Usage:
  atrax new <name> --template chat
  atrax dev [--port 8787]
  atrax deploy [--json] [--dry-run] [--instant]
  atrax claim <token> [--json]
  atrax plan [--json]
  atrax drift [--json]
  atrax inspect [--json]
  atrax logs [--json]
  atrax doctor [--json]

Instant apps only:
  atrax secret set <NAME> [--json]     value is read from stdin, never from argv
  atrax secret remove <NAME> [--json]
  atrax delete --yes [--json]          deletes the live app and its data

Sharing (alpha, needs "visibility": "shared"):
  atrax share add <email>     invite someone to a shared app
  atrax share list [--json]
  atrax share remove <email>

plan previews what deploy would change. drift exits 2 when the provider no longer matches the lockfile.

The deployer uses your Cloudflare account. Visitors to a public chat template do not log in.

Without a Cloudflare account, deploy uses Atrax instant hosting: a real public URL that disappears in 30 days.
Run the atrax claim <token> line that deploy prints once to keep the app forever.
`);
}

try {
  validateCommandArgs();
  if (command === "new") await createApp();
  else if (command === "dev") await develop();
  else if (command === "deploy") await deploy();
  else if (command === "claim") await claim();
  else if (command === "plan") await plan();
  else if (command === "drift") await drift();
  else if (command === "inspect") await inspectApp();
  else if (command === "logs") await logs();
  else if (command === "doctor") await doctor();
  else if (command === "share") await share();
  else if (command === "secret") await secret();
  else if (command === "delete") await destroy();
  else if (command === "help" || command === "--help" || command === "-h") help();
  else if (command === "--version" || command === "-v") {
    process.stdout.write(`${packageJson.version}\n`);
  } else {
    throw new CliError(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error);
}
