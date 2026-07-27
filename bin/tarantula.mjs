#!/usr/bin/env node

import {
  access,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const wranglerBin =
  process.env.TARANTULA_WRANGLER_BIN ??
  join(packageRoot, "node_modules", "wrangler", "bin", "wrangler.js");
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
    process.stderr.write(`tarantula: ${message}\n`);
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
    if (!value.startsWith("-")) values.push(value);
  }
  return values;
}

function validateCommandArgs() {
  const specs = {
    new: { flags: ["--json"], values: ["--template"], positionals: 1 },
    dev: { flags: [], values: ["--port"], positionals: 0 },
    deploy: { flags: ["--json", "--dry-run"], values: [], positionals: 0 },
    plan: { flags: ["--json"], values: [], positionals: 0 },
    drift: { flags: ["--json"], values: [], positionals: 0 },
    inspect: { flags: ["--json"], values: [], positionals: 0 },
    logs: { flags: ["--json"], values: [], positionals: 0 },
    doctor: { flags: ["--json"], values: [], positionals: 0 },
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
    if (value.startsWith("-")) {
      throw new CliError(`Unknown option for ${command}: ${value}`);
    }
    positionalCount += 1;
  }
  if (positionalCount !== spec.positionals) {
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
    if (await pathExists(join(current, "tarantula.json"))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new CliError(
        "No tarantula.json found. Run this inside a Tarantula app.",
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
  assertObject(contract, "tarantula.json");
  rejectUnknownKeys(
    contract,
    ["$schema", "version", "name", "visibility", "web", "tables"],
    "tarantula.json",
  );
  if (contract.version !== 1) {
    throw new CliError("tarantula.json version must be 1");
  }
  validateName(contract.name);
  if (contract.visibility !== "public") {
    throw new CliError(
      'Tarantula v0 supports visibility "public". Private apps are not available yet.',
    );
  }
  if (!contract.web?.entry || !contract.web?.assets) {
    throw new CliError("tarantula.json needs web.entry and web.assets");
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
    throw new CliError("tarantula.json needs tables.migrations");
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
  const contract = await readJson(join(root, "tarantula.json"), "tarantula.json");
  validateContract(contract);
  const lockPath = join(root, "tarantula.lock.json");
  const lock = (await pathExists(lockPath))
    ? await readJson(lockPath, "tarantula.lock.json")
    : null;
  if (lock && lock.worker?.name !== contract.name) {
    throw new CliError(
      "tarantula.json name does not match the Worker recorded in tarantula.lock.json.",
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

async function compileProviderConfig(app, databaseId = null) {
  const configDir = join(app.root, ".tarantula");
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
      run_worker_first: ["/api/*", "/.well-known/*"],
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
      TARANTULA_APP_NAME: app.contract.name,
      TARANTULA_VISIBILITY: app.contract.visibility,
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
      "Wrangler is missing from the Tarantula installation. Reinstall Tarantula.",
    );
  }

  const capture = options.capture ?? false;
  const quiet = options.quiet ?? false;
  const env = {
    ...process.env,
    ...(options.env ?? {}),
    WRANGLER_LOG_PATH: join(appRoot, ".tarantula", "wrangler.log"),
  };

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [wranglerBin, ...args], {
      cwd: appRoot,
      env,
      stdio: capture ? ["inherit", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";

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
      "The D1 database in tarantula.lock.json was not found in this account.",
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
  let lastStatus = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(healthUrl, { cache: "no-store" });
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
  if (!name) throw new CliError("Usage: tarantula new <name> --template chat");
  validateName(name);
  const template = optionValue("--template") ?? "chat";
  if (template !== "chat") {
    throw new CliError('Tarantula v0 includes one template: "chat"');
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

  const payload = {
    schemaVersion: 1,
    status: "created",
    name,
    template,
    directory: target,
    next: [`cd ${name}`, "tarantula dev", "tarantula deploy"],
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Created ${name}\n\n  cd ${name}\n  tarantula dev\n\nDeploy when it is ready:\n\n  tarantula deploy\n`,
    );
  }
}

async function develop() {
  const app = await loadApp();
  await validateAppFiles(app);
  const { configPath } = await compileProviderConfig(app);
  const persistPath = join(app.root, ".tarantula", "state");
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

  const account = await currentAccount(app, quiet);
  await assertWorkerNameAvailable(app, account);
  const database = await resolveDatabase(app, quiet);
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

  const output = `${result.stdout}\n${result.stderr}`;
  const url =
    output.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/)?.[0] ??
    app.lock.worker.url;
  await waitForLive(
    url,
    app.contract.web.health ?? "/.well-known/tarantula.json",
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
  keep: "=",
  none: "=",
};

async function plan() {
  const app = await loadApp();
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
        "tarantula.lock.json records this Worker, but it is missing from the account. Deploy would create it again.",
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
        "tarantula.lock.json records this D1 database, but it is missing from the account.",
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
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run tarantula deploy.");
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
        "The active Cloudflare account is not the account recorded in tarantula.lock.json.",
    });
    for (const check of ["worker", "deployment", "url", "tables", "migrations"]) {
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
            "tarantula.lock.json does not record a deployment id yet. Deploy once with this version of Tarantula to record it.",
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
              : "The live deployment was not created by this lockfile. Something deployed outside Tarantula.",
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
              : "The live URL is not the URL recorded in tarantula.lock.json.",
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
            : "The locked D1 database was renamed outside Tarantula.",
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
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run tarantula deploy.");
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
  if (!app.lock) {
    throw new CliError("This app has not been deployed. Run tarantula deploy.");
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
    contract: join(app.root, "tarantula.json"),
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
      `Tarantula ${packageJson.version}\nApp: ${app.contract.name}\nNode: ${process.version}\nContract: valid\nBundle: valid\nCloudflare: ${account.name}\nDeployed: ${payload.deployed ? "yes" : "no"}\n`,
    );
  }
}

function help() {
  process.stdout.write(`Tarantula ${packageJson.version}

Usage:
  tarantula new <name> --template chat
  tarantula dev [--port 8787]
  tarantula deploy [--json] [--dry-run]
  tarantula plan [--json]
  tarantula drift [--json]
  tarantula inspect [--json]
  tarantula logs [--json]
  tarantula doctor [--json]

plan previews what deploy would change. drift exits 2 when the provider no longer matches the lockfile.

The deployer uses your Cloudflare account. Visitors to the chat template do not log in.
`);
}

try {
  validateCommandArgs();
  if (command === "new") await createApp();
  else if (command === "dev") await develop();
  else if (command === "deploy") await deploy();
  else if (command === "plan") await plan();
  else if (command === "drift") await drift();
  else if (command === "inspect") await inspectApp();
  else if (command === "logs") await logs();
  else if (command === "doctor") await doctor();
  else if (command === "help" || command === "--help" || command === "-h") help();
  else if (command === "--version" || command === "-v") {
    process.stdout.write(`${packageJson.version}\n`);
  } else {
    throw new CliError(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(error);
}
