import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cli = resolve("bin/tarantula.mjs");

async function run(args, cwd, env = {}) {
  const result = await execFileAsync(process.execPath, [cli, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

async function runAllowFailure(args, cwd, env = {}) {
  try {
    const result = await run(args, cwd, env);
    return { ...result, code: 0 };
  } catch (error) {
    return {
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? "").trim(),
      code: error.code ?? 1,
    };
  }
}

const fakeWranglerSource = `#!/usr/bin/env node
const argv = process.argv.slice(2);
const state = JSON.parse(process.env.TARANTULA_FAKE_STATE ?? "{}");
const has = (...parts) => parts.every((part) => argv.includes(part));
const out = (text) => process.stdout.write(text + "\\n");

if (has("whoami")) {
  out(JSON.stringify({
    accounts: [{ id: state.accountId ?? "account-1", name: "Fake Account" }],
  }));
} else if (has("deployments", "list")) {
  if (state.workerExists) {
    out(JSON.stringify([{ id: state.deploymentId ?? "deployment-1" }]));
  } else {
    process.stderr.write("workers.api.error.not_found [code: 10007]\\n");
    process.exit(1);
  }
} else if (has("deployments", "status")) {
  out(JSON.stringify({
    id: state.deploymentId ?? "deployment-1",
    created_on: "2026-07-27T00:00:00.000Z",
    versions: [],
  }));
} else if (has("d1", "list")) {
  out(JSON.stringify(state.databases ?? []));
} else if (has("d1", "migrations", "list")) {
  const pending = state.pending ?? [];
  if (!pending.length) {
    out("\\u2705 No migrations to apply!");
  } else {
    out("Migrations to be applied:");
    out("\\u250c\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2510");
    out("\\u2502 Name \\u2502");
    out("\\u251c\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2524");
    for (const name of pending) out("\\u2502 " + name + " \\u2502");
    out("\\u2514\\u2500\\u2500\\u2500\\u2500\\u2500\\u2500\\u2518");
  }
} else if (has("deploy", "--dry-run")) {
  out("Total Upload: 1.00 KiB / gzip: 0.50 KiB");
  out("--dry-run: exiting now.");
} else {
  out("");
}
`;

async function fakeWrangler(root) {
  const pathname = join(root, "fake-wrangler.mjs");
  await writeFile(pathname, fakeWranglerSource);
  return pathname;
}

function fakeEnv(bin, state) {
  return {
    TARANTULA_WRANGLER_BIN: bin,
    TARANTULA_FAKE_STATE: JSON.stringify(state),
  };
}

test("scaffolds the documented chat app and compiles its contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  const created = await run(
    ["new", "open-chat", "--template", "chat", "--json"],
    root,
  );
  const createPayload = JSON.parse(created.stdout);
  assert.equal(createPayload.status, "created");
  assert.equal(createPayload.name, "open-chat");

  const appRoot = join(root, "open-chat");
  const contract = JSON.parse(
    await readFile(join(appRoot, "tarantula.json"), "utf8"),
  );
  assert.equal(contract.name, "open-chat");
  assert.equal(contract.visibility, "public");

  const checked = await run(["deploy", "--dry-run", "--json"], appRoot);
  const deployPayload = JSON.parse(checked.stdout);
  assert.equal(deployPayload.status, "validated");

  const providerConfig = JSON.parse(
    await readFile(
      join(appRoot, ".tarantula", "wrangler.jsonc"),
      "utf8",
    ),
  );
  assert.equal(providerConfig.name, "open-chat");
  assert.equal(providerConfig.d1_databases[0].binding, "DB");
  assert.equal(providerConfig.assets.binding, "ASSETS");
});

test("doctor rejects a contract whose declared files do not exist", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "broken-chat", "--template", "chat"], root);
  const appRoot = join(root, "broken-chat");
  const contractPath = join(appRoot, "tarantula.json");
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  contract.web.assets = "missing-assets";
  await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
  await assert.rejects(
    run(["doctor"], appRoot),
    /web\.assets does not exist/,
  );
});

test("rejects an invalid app name without creating a partial app", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await assert.rejects(
    run(["new", "Bad Name", "--template", "chat"], root),
    /App names use 2 to 48 lowercase/,
  );
});

test("rejects unknown options before deploy work begins", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "safe-chat", "--template", "chat"], root);
  await assert.rejects(
    run(["deploy", "--dry-rn"], join(root, "safe-chat")),
    /Unknown option for deploy: --dry-rn/,
  );
});

test("rejects unknown contract fields, escaping paths, unsafe health URLs, and lock-name drift", async () => {
  const cases = [
    {
      name: "unknown-field",
      mutate(contract) {
        contract.tabels = contract.tables;
      },
      expected: /unknown property: tabels/,
    },
    {
      name: "escaping-path",
      mutate(contract) {
        contract.web.entry = "../outside.js";
      },
      expected: /web\.entry must point inside/,
    },
    {
      name: "absolute-path",
      mutate(contract) {
        contract.web.assets = "/private/tmp/assets";
      },
      expected: /web\.assets must be a portable relative path/,
    },
    {
      name: "unsafe-health",
      mutate(contract) {
        contract.web.health = "//example.com/probe";
      },
      expected: /same-origin absolute path/,
    },
  ];

  for (const item of cases) {
    const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
    await run(["new", item.name, "--template", "chat"], root);
    const appRoot = join(root, item.name);
    const contractPath = join(appRoot, "tarantula.json");
    const contract = JSON.parse(await readFile(contractPath, "utf8"));
    item.mutate(contract);
    await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
    await assert.rejects(run(["doctor"], appRoot), item.expected);
  }

  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "locked-chat", "--template", "chat"], root);
  const appRoot = join(root, "locked-chat");
  await writeFile(
    join(appRoot, "tarantula.lock.json"),
    `${JSON.stringify({
      version: 1,
      worker: { name: "different-worker" },
    })}\n`,
  );
  await assert.rejects(
    run(["doctor"], appRoot),
    /does not match the Worker recorded/,
  );
});

test("plan describes the first deploy of a never-deployed app", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "plan-chat", "--template", "chat"], root);
  const appRoot = join(root, "plan-chat");
  const bin = await fakeWrangler(root);
  const planned = await run(
    ["plan", "--json"],
    appRoot,
    fakeEnv(bin, { workerExists: false, databases: [] }),
  );
  const payload = JSON.parse(planned.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, "planned");
  assert.equal(payload.name, "plan-chat");
  assert.equal(payload.changes, true);
  assert.deepEqual(payload.conflicts, []);

  const byResource = Object.fromEntries(
    payload.actions.map((item) => [item.resource, item]),
  );
  assert.equal(byResource["worker/plan-chat"].action, "create");
  assert.equal(byResource["worker/plan-chat"].product, "launchpad");
  assert.equal(byResource["d1/plan-chat-tables"].action, "create");
  assert.equal(byResource.migrations.action, "apply");
  assert.deepEqual(payload.migrations.pending, [
    "0001_messages.sql",
    "0002_public_chat_guardrails.sql",
  ]);
});

test("plan blocks on an unowned Worker with the same name", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "taken-chat", "--template", "chat"], root);
  const appRoot = join(root, "taken-chat");
  const bin = await fakeWrangler(root);
  const blocked = await runAllowFailure(
    ["plan", "--json"],
    appRoot,
    fakeEnv(bin, { workerExists: true, databases: [] }),
  );
  assert.equal(blocked.code, 1);
  const payload = JSON.parse(blocked.stdout);
  assert.equal(payload.status, "blocked");
  assert.equal(payload.changes, false);
  assert.equal(payload.conflicts.length, 1);
  assert.equal(payload.conflicts[0].resource, "worker/taken-chat");
  assert.match(payload.conflicts[0].reason, /no lockfile proving ownership/);
});

test("drift reports a clean app when the provider matches the lockfile", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "clean-chat", "--template", "chat"], root);
  const appRoot = join(root, "clean-chat");
  await writeFile(
    join(appRoot, "tarantula.lock.json"),
    `${JSON.stringify(
      {
        version: 1,
        provider: "cloudflare",
        accountId: "account-1",
        worker: {
          name: "clean-chat",
          url: "https://clean-chat.example.workers.dev",
          lastDeploymentId: "deployment-1",
        },
        resources: {
          tables: { binding: "DB", name: "clean-chat-tables", id: "db-1" },
        },
      },
      null,
      2,
    )}\n`,
  );
  const bin = await fakeWrangler(root);
  const checked = await run(
    ["drift", "--json"],
    appRoot,
    fakeEnv(bin, {
      workerExists: true,
      deploymentId: "deployment-1",
      databases: [{ uuid: "db-1", name: "clean-chat-tables" }],
      pending: [],
    }),
  );
  const payload = JSON.parse(checked.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, "clean");
  const byCheck = Object.fromEntries(
    payload.checks.map((item) => [item.check, item]),
  );
  assert.equal(byCheck.account.result, "ok");
  assert.equal(byCheck.worker.result, "ok");
  assert.equal(byCheck.deployment.result, "ok");
  assert.equal(byCheck.tables.result, "ok");
  assert.equal(byCheck.migrations.result, "ok");
});

test("drift exits 2 when something deployed outside Tarantula", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "drift-chat", "--template", "chat"], root);
  const appRoot = join(root, "drift-chat");
  await writeFile(
    join(appRoot, "tarantula.lock.json"),
    `${JSON.stringify(
      {
        version: 1,
        provider: "cloudflare",
        accountId: "account-1",
        worker: {
          name: "drift-chat",
          url: "https://drift-chat.example.workers.dev",
          lastDeploymentId: "deployment-1",
        },
        resources: {
          tables: { binding: "DB", name: "drift-chat-tables", id: "db-1" },
        },
      },
      null,
      2,
    )}\n`,
  );
  const bin = await fakeWrangler(root);
  const checked = await runAllowFailure(
    ["drift", "--json"],
    appRoot,
    fakeEnv(bin, {
      workerExists: true,
      deploymentId: "deployment-9",
      databases: [{ uuid: "db-1", name: "drift-chat-tables" }],
      pending: [],
    }),
  );
  assert.equal(checked.code, 2);
  const payload = JSON.parse(checked.stdout);
  assert.equal(payload.status, "drifted");
  const deployment = payload.checks.find((item) => item.check === "deployment");
  assert.equal(deployment.result, "drift");
  assert.equal(deployment.expected, "deployment-1");
  assert.equal(deployment.observed, "deployment-9");
});

test("drift requires a lockfile before contacting Cloudflare", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "fresh-chat", "--template", "chat"], root);
  await assert.rejects(
    run(["drift"], join(root, "fresh-chat")),
    /has not been deployed/,
  );
});

test("logs requires a deployed lock before contacting Cloudflare", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "local-chat", "--template", "chat"], root);
  await assert.rejects(
    run(["logs"], join(root, "local-chat")),
    /has not been deployed/,
  );
});
