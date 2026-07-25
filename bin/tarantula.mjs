#!/usr/bin/env node

import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const wranglerBin = join(packageRoot, "node_modules", "wrangler", "bin", "wrangler.js");
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
    if (value === "--json" || value === "--dry-run" || value === "--no-git") {
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

function validateContract(contract) {
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
  if (!contract.tables?.migrations) {
    throw new CliError("tarantula.json needs tables.migrations");
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
  return { root, contract, lock, lockPath };
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

async function waitForLive(url) {
  if (!url) {
    throw new CliError("Wrangler did not return the deployment URL.");
  }
  const healthUrl = new URL("/api/messages?after=0", url);
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
  const database = await resolveDatabase(app, quiet);
  app.lock = {
    version: 1,
    provider: "cloudflare",
    accountId: account.id,
    worker: {
      name: app.contract.name,
      url: app.lock?.worker?.url ?? null,
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
  await waitForLive(url);
  const status = await deploymentStatus(app, configPath, quiet);
  const deploymentId = findFirstValue(status, [
    "deployment_id",
    "deploymentId",
    "id",
  ]);
  app.lock.worker.url = url;
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
  const { configPath } = await compileProviderConfig(
    app,
    app.lock?.resources?.tables?.id,
  );
  const args = ["tail", app.contract.name, "--config", configPath];
  if (jsonOutput) args.push("--format", "json");
  await runWrangler(app.root, args);
}

async function doctor() {
  const app = await loadApp();
  const { configPath } = await compileProviderConfig(app);
  const payload = {
    schemaVersion: 1,
    status: "ready",
    name: app.contract.name,
    node: process.version,
    contract: join(app.root, "tarantula.json"),
    providerConfig: configPath,
    wrangler: packageJson.devDependencies?.wrangler ?? "installed",
    deployed: Boolean(app.lock),
  };
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(
      `Tarantula ${packageJson.version}\nApp: ${app.contract.name}\nNode: ${process.version}\nContract: valid\nWrangler: ready\nDeployed: ${payload.deployed ? "yes" : "no"}\n`,
    );
  }
}

function help() {
  process.stdout.write(`Tarantula ${packageJson.version}

Usage:
  tarantula new <name> --template chat
  tarantula dev [--port 8787]
  tarantula deploy [--json] [--dry-run]
  tarantula inspect [--json]
  tarantula logs [--json]
  tarantula doctor [--json]

The deployer uses your Cloudflare account. Visitors to the chat template do not log in.
`);
}

try {
  if (command === "new") await createApp();
  else if (command === "dev") await develop();
  else if (command === "deploy") await deploy();
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
