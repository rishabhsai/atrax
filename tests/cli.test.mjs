import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
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
import { appendFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const state = JSON.parse(process.env.TARANTULA_FAKE_STATE ?? "{}");
const has = (...parts) => parts.every((part) => argv.includes(part));
const out = (text) => process.stdout.write(text + "\\n");
const sidecar = (name, value) => {
  if (!process.env.TARANTULA_FAKE_DIR) return;
  appendFileSync(join(process.env.TARANTULA_FAKE_DIR, name), JSON.stringify(value) + "\\n");
};
const readStdin = async () => {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
};

if (has("d1", "execute")) {
  const sql = argv[argv.indexOf("--command") + 1] ?? "";
  sidecar("sql.log", { sql });
  const isSelect = /^\\s*select/i.test(sql);
  out(JSON.stringify([
    { success: true, results: isSelect ? (state.rows ?? []) : [], meta: { changes: 1 } },
  ]));
} else if (has("secret", "put")) {
  const value = (await readStdin()).trim();
  sidecar("secrets.log", { name: argv[argv.indexOf("put") + 1] ?? null, value });
  out(JSON.stringify({ success: true }));
} else if (has("secret", "list")) {
  out(JSON.stringify(
    (state.secrets ?? []).map((name) => ({ name, type: "secret_text" })),
  ));
} else if (has("whoami")) {
  if (state.whoamiFails) {
    process.stderr.write("You are not authenticated. Run wrangler login.\\n");
    process.exit(1);
  }
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
} else if (has("deploy")) {
  out("Total Upload: 1.00 KiB / gzip: 0.50 KiB");
  out("Deployed " + (state.workerName ?? "app") + " triggers");
  out("  https://" + (state.workerName ?? "app") + ".fake.workers.dev");
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

async function readSidecar(dir, name) {
  let source;
  try {
    source = await readFile(join(dir, name), "utf8");
  } catch {
    return [];
  }
  return source
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function setVisibility(appRoot, visibility) {
  const contractPath = join(appRoot, "tarantula.json");
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  contract.visibility = visibility;
  await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
}

async function writeLock(appRoot, name, extra = {}) {
  await writeFile(
    join(appRoot, "tarantula.lock.json"),
    `${JSON.stringify(
      {
        version: 1,
        provider: "cloudflare",
        accountId: "account-1",
        worker: {
          name,
          url: `https://${name}.fake.workers.dev`,
          lastDeploymentId: "deployment-1",
        },
        resources: {
          tables: { binding: "DB", name: `${name}-tables`, id: "db-1" },
        },
        ...extra,
      },
      null,
      2,
    )}\n`,
  );
}

async function readinessServer() {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)),
  };
}

// Stands in for the hosted instant-hosting control plane. It records every
// request so the tests can assert on what the CLI actually uploaded.
async function instantServer() {
  const requests = [];
  const appId = "abc1234567";
  const url = `https://i-${appId}.fake.workers.dev`;
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : null;
      requests.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body,
      });
      const send = (status, value) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(value));
      };
      const tables = { tables: { name: `i-${appId}-tables` } };
      if (request.url === "/v1/apps" && request.method === "POST") {
        return send(200, {
          schemaVersion: 1,
          status: "deployed",
          appId,
          name: body.name,
          url,
          claimToken: "claim-token-1",
          manageToken: "manage-token-1",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          resources: tables,
        });
      }
      if (
        request.method === "POST" &&
        new RegExp(`^/v1/apps/${appId}/deploys$`).test(request.url)
      ) {
        return send(200, {
          schemaVersion: 1,
          status: "deployed",
          appId,
          name: "instant-chat",
          url,
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          resources: tables,
        });
      }
      if (request.url === "/v1/claims" && request.method === "POST") {
        if (body?.claimToken !== "claim-token-1") {
          return send(404, {
            schemaVersion: 1,
            status: "error",
            error: "That claim token does not match an instant app.",
            details: null,
          });
        }
        return send(200, {
          schemaVersion: 1,
          status: "claimed",
          appId,
          url,
        });
      }
      send(404, {
        schemaVersion: 1,
        status: "error",
        error: `No such endpoint: ${request.method} ${request.url}`,
        details: null,
      });
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    appId,
    url,
    requests,
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)),
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
    "0003_door_members.sql",
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

test("share add invites a member and stores only the hashed invite token", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "shared-chat", "--template", "chat"], root);
  const appRoot = join(root, "shared-chat");
  await setVisibility(appRoot, "shared");
  await writeLock(appRoot, "shared-chat", { door: { secretProvisioned: true } });
  const bin = await fakeWrangler(root);

  const invited = await run(["share", "add", "Ana@Example.com", "--json"], appRoot, {
    ...fakeEnv(bin, {
      workerExists: true,
      databases: [{ uuid: "db-1", name: "shared-chat-tables" }],
      rows: [],
    }),
    TARANTULA_FAKE_DIR: root,
  });
  const payload = JSON.parse(invited.stdout);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.status, "invited");
  assert.equal(payload.email, "ana@example.com");
  assert.ok(payload.expiresAt > Date.now());
  assert.match(
    payload.inviteUrl,
    /^https:\/\/shared-chat\.fake\.workers\.dev\/\.door\/join\?token=[A-Za-z0-9_-]+$/,
  );

  const token = new URL(payload.inviteUrl).searchParams.get("token");
  const hashed = createHash("sha256").update(token).digest("hex");
  const executed = await readSidecar(root, "sql.log");
  const upsert = executed.find((item) => item.sql.includes("INSERT INTO door_members"));
  assert.ok(upsert, "share add should upsert into door_members");
  assert.match(upsert.sql, /ON CONFLICT\(email\) DO UPDATE/);
  assert.ok(upsert.sql.includes(hashed), "the SQL should store the hashed token");
  assert.ok(!upsert.sql.includes(token), "the SQL must never contain the raw token");
  assert.ok(upsert.sql.includes("'ana@example.com'"));
});

test("share list reports member state from the app database", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "list-chat", "--template", "chat"], root);
  const appRoot = join(root, "list-chat");
  await setVisibility(appRoot, "shared");
  await writeLock(appRoot, "list-chat", { door: { secretProvisioned: true } });
  const bin = await fakeWrangler(root);

  const listed = await run(
    ["share", "list", "--json"],
    appRoot,
    fakeEnv(bin, {
      workerExists: true,
      databases: [{ uuid: "db-1", name: "list-chat-tables" }],
      rows: [
        { email: "joined@example.com", joined_at: 1, invite_expires_at: null },
        {
          email: "pending@example.com",
          joined_at: null,
          invite_expires_at: Date.now() + 86_400_000,
        },
        { email: "stale@example.com", joined_at: null, invite_expires_at: 1 },
      ],
    }),
  );
  const payload = JSON.parse(listed.stdout);
  assert.equal(payload.status, "ok");
  assert.deepEqual(
    payload.members.map((item) => [item.email, item.state]),
    [
      ["joined@example.com", "joined"],
      ["pending@example.com", "invited"],
      ["stale@example.com", "expired"],
    ],
  );
});

test("share refuses to run on a public app and explains the recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "public-chat", "--template", "chat"], root);
  const appRoot = join(root, "public-chat");
  await writeLock(appRoot, "public-chat");
  const bin = await fakeWrangler(root);

  const failed = await runAllowFailure(
    ["share", "add", "ana@example.com", "--json"],
    appRoot,
    fakeEnv(bin, { workerExists: true }),
  );
  assert.equal(failed.code, 1);
  const payload = JSON.parse(failed.stdout);
  assert.equal(payload.status, "error");
  assert.match(payload.error, /needs visibility "shared"/);
  assert.equal(payload.details.visibility, "public");
  assert.match(payload.details.recovery, /Set "visibility": "shared".*tarantula deploy/s);
});

test("deploy provisions the Door session secret exactly once", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "secret-chat", "--template", "chat"], root);
  const appRoot = join(root, "secret-chat");
  await setVisibility(appRoot, "shared");
  await writeLock(appRoot, "secret-chat");
  const bin = await fakeWrangler(root);
  const readiness = await readinessServer();
  const env = {
    ...fakeEnv(bin, {
      workerExists: true,
      workerName: "secret-chat",
      databases: [{ uuid: "db-1", name: "secret-chat-tables" }],
      pending: [],
    }),
    TARANTULA_FAKE_DIR: root,
    TARANTULA_READINESS_ORIGIN: readiness.origin,
  };

  try {
    const first = await run(["deploy", "--json"], appRoot, env);
    assert.equal(JSON.parse(first.stdout).status, "deployed");
    const afterFirst = await readSidecar(root, "secrets.log");
    assert.equal(afterFirst.length, 1);
    assert.equal(afterFirst[0].name, "DOOR_SESSION_SECRET");
    assert.ok(afterFirst[0].value.length >= 40);

    const lock = JSON.parse(
      await readFile(join(appRoot, "tarantula.lock.json"), "utf8"),
    );
    assert.deepEqual(lock.door, { secretProvisioned: true });

    await run(["deploy", "--json"], appRoot, env);
    const afterSecond = await readSidecar(root, "secrets.log");
    assert.equal(afterSecond.length, 1);
  } finally {
    await readiness.close();
  }
});

test("plan and drift report the Door session secret for shared apps", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "door-chat", "--template", "chat"], root);
  const appRoot = join(root, "door-chat");
  await setVisibility(appRoot, "shared");
  await writeLock(appRoot, "door-chat");
  const bin = await fakeWrangler(root);
  const state = {
    workerExists: true,
    databases: [{ uuid: "db-1", name: "door-chat-tables" }],
    pending: [],
    secrets: [],
  };

  const planned = await run(["plan", "--json"], appRoot, fakeEnv(bin, state));
  const planPayload = JSON.parse(planned.stdout);
  const secretAction = planPayload.actions.find(
    (item) => item.resource === "session-secret",
  );
  assert.equal(secretAction.product, "door");
  assert.equal(secretAction.action, "provision");
  assert.equal(planPayload.changes, true);

  const clean = await run(
    ["drift", "--json"],
    appRoot,
    fakeEnv(bin, { ...state, secrets: [] }),
  );
  const doorCheck = JSON.parse(clean.stdout).checks.find(
    (item) => item.check === "door",
  );
  assert.equal(doorCheck.expected, "absent");
  assert.equal(doorCheck.observed, "absent");
  assert.equal(doorCheck.result, "ok");

  await writeLock(appRoot, "door-chat", { door: { secretProvisioned: true } });
  const drifted = await runAllowFailure(
    ["drift", "--json"],
    appRoot,
    fakeEnv(bin, { ...state, secrets: [] }),
  );
  assert.equal(drifted.code, 2);
  const driftedCheck = JSON.parse(drifted.stdout).checks.find(
    (item) => item.check === "door",
  );
  assert.equal(driftedCheck.expected, "present");
  assert.equal(driftedCheck.observed, "absent");
  assert.equal(driftedCheck.result, "drift");
});

test("deploy without a Cloudflare account falls back to instant hosting", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "instant-chat", "--template", "chat"], root);
  const appRoot = join(root, "instant-chat");
  const bin = await fakeWrangler(root);
  const control = await instantServer();
  const readiness = await readinessServer();
  const env = {
    ...fakeEnv(bin, { whoamiFails: true }),
    TARANTULA_INSTANT_ORIGIN: control.origin,
    TARANTULA_READINESS_ORIGIN: readiness.origin,
  };

  try {
    const first = await run(["deploy"], appRoot, env);
    assert.match(
      first.stdout,
      /No Cloudflare account detected — deploying to Tarantula instant hosting\./,
    );
    assert.match(first.stdout, new RegExp(control.url.replaceAll(".", "\\.")));
    assert.match(first.stdout, /This app is unclaimed\. It disappears in 30 days/);
    assert.match(first.stdout, /tarantula claim claim-token-1/);

    const created = control.requests.find((item) => item.url === "/v1/apps");
    assert.equal(created.body.name, "instant-chat");
    assert.equal(created.body.contract.visibility, "public");
    assert.ok(created.body.modules["worker.js"].includes("handleDoor"));
    assert.ok(created.body.modules["door.js"].includes("sessionCookieName"));
    assert.ok(created.body.modules["validation.js"]);
    assert.deepEqual(Object.keys(created.body.assets).sort(), [
      "/app.js",
      "/index.html",
      "/styles.css",
    ]);
    assert.equal(
      Buffer.from(created.body.assets["/index.html"], "base64")
        .toString("utf8")
        .includes("<!doctype html>"),
      true,
    );
    assert.deepEqual(Object.keys(created.body.migrations), [
      "0001_messages.sql",
      "0002_public_chat_guardrails.sql",
      "0003_door_members.sql",
    ]);

    const lock = JSON.parse(
      await readFile(join(appRoot, "tarantula.lock.json"), "utf8"),
    );
    assert.deepEqual(lock, {
      version: 1,
      provider: "tarantula-instant",
      mode: "instant",
      appId: control.appId,
      worker: { name: `i-${control.appId}`, url: control.url },
    });

    const statePath = join(appRoot, ".tarantula", "instant.json");
    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.deepEqual(state, {
      appId: control.appId,
      manageToken: "manage-token-1",
      url: control.url,
    });
    assert.equal((await stat(statePath)).mode & 0o777, 0o600);

    // A redeploy reuses the stored credential, never reprints the claim token,
    // and never asks Cloudflare for an account it does not have.
    const second = await run(["deploy", "--json"], appRoot, env);
    const payload = JSON.parse(second.stdout);
    assert.equal(payload.schemaVersion, 1);
    assert.equal(payload.status, "deployed");
    assert.equal(payload.mode, "instant");
    assert.equal(payload.name, "instant-chat");
    assert.equal(payload.appId, control.appId);
    assert.equal(payload.url, control.url);
    assert.equal(payload.claimToken, undefined);
    assert.equal(payload.resources.tables.name, `i-${control.appId}-tables`);
    assert.ok(!second.stdout.includes("claim-token-1"));

    const redeploys = control.requests.filter((item) =>
      item.url.endsWith("/deploys"),
    );
    assert.equal(redeploys.length, 1);
    assert.equal(redeploys[0].url, `/v1/apps/${control.appId}/deploys`);
    assert.equal(redeploys[0].headers.authorization, "Bearer manage-token-1");
    assert.equal(redeploys[0].body.name, undefined);
    assert.ok(redeploys[0].body.modules["worker.js"]);
  } finally {
    await control.close();
    await readiness.close();
  }
});

test("claim marks an instant app claimed from anywhere", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  const control = await instantServer();
  try {
    const claimed = await run(["claim", "claim-token-1", "--json"], root, {
      TARANTULA_INSTANT_ORIGIN: control.origin,
    });
    assert.deepEqual(JSON.parse(claimed.stdout), {
      schemaVersion: 1,
      status: "claimed",
      appId: control.appId,
      url: control.url,
    });
    const request = control.requests.find((item) => item.url === "/v1/claims");
    assert.deepEqual(request.body, { claimToken: "claim-token-1" });

    const failed = await runAllowFailure(["claim", "wrong", "--json"], root, {
      TARANTULA_INSTANT_ORIGIN: control.origin,
    });
    assert.equal(failed.code, 1);
    assert.match(
      JSON.parse(failed.stdout).error,
      /does not match an instant app/,
    );
  } finally {
    await control.close();
  }
});

test("instant hosting refuses a shared app and names the recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "shared-instant", "--template", "chat"], root);
  const appRoot = join(root, "shared-instant");
  await setVisibility(appRoot, "shared");
  const bin = await fakeWrangler(root);
  const control = await instantServer();

  try {
    const failed = await runAllowFailure(["deploy", "--instant", "--json"], appRoot, {
      ...fakeEnv(bin, { whoamiFails: true }),
      TARANTULA_INSTANT_ORIGIN: control.origin,
    });
    assert.equal(failed.code, 1);
    const payload = JSON.parse(failed.stdout);
    assert.equal(payload.status, "error");
    assert.match(payload.error, /supports public apps only/);
    assert.equal(payload.details.visibility, "shared");
    assert.match(payload.details.recovery, /Cloudflare account/);
    assert.equal(control.requests.length, 0);
  } finally {
    await control.close();
  }
});

test("commands that need a Cloudflare account refuse instant apps", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "locked-instant", "--template", "chat"], root);
  const appRoot = join(root, "locked-instant");
  await writeFile(
    join(appRoot, "tarantula.lock.json"),
    `${JSON.stringify(
      {
        version: 1,
        provider: "tarantula-instant",
        mode: "instant",
        appId: "abc1234567",
        worker: {
          name: "i-abc1234567",
          url: "https://i-abc1234567.fake.workers.dev",
        },
      },
      null,
      2,
    )}\n`,
  );
  const bin = await fakeWrangler(root);

  for (const command of ["inspect", "logs", "plan", "drift"]) {
    const failed = await runAllowFailure(
      [command, "--json"],
      appRoot,
      fakeEnv(bin, { workerExists: true }),
    );
    assert.equal(failed.code, 1, `${command} should exit 1`);
    const payload = JSON.parse(failed.stdout);
    assert.match(
      payload.error,
      new RegExp(`tarantula ${command} is not available for instant apps yet`),
    );
    assert.match(payload.details.recovery, /tarantula claim/);
  }

  await setVisibility(appRoot, "shared");
  const share = await runAllowFailure(
    ["share", "list", "--json"],
    appRoot,
    fakeEnv(bin, { workerExists: true }),
  );
  assert.equal(share.code, 1);
  assert.match(
    JSON.parse(share.stdout).error,
    /tarantula share is not available for instant apps yet/,
  );
});

test("the contract accepts shared visibility and still rejects anything else", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "visibility-chat", "--template", "chat"], root);
  const appRoot = join(root, "visibility-chat");
  const bin = await fakeWrangler(root);

  await setVisibility(appRoot, "shared");
  const checked = await run(
    ["doctor", "--json"],
    appRoot,
    fakeEnv(bin, { workerExists: false, databases: [] }),
  );
  assert.equal(JSON.parse(checked.stdout).status, "ready");

  const providerConfig = JSON.parse(
    await readFile(join(appRoot, ".tarantula", "wrangler.jsonc"), "utf8"),
  );
  assert.equal(providerConfig.vars.TARANTULA_VISIBILITY, "shared");
  assert.equal(providerConfig.assets.run_worker_first, true);

  for (const visibility of ["private", "unlisted", "Public"]) {
    await setVisibility(appRoot, visibility);
    await assert.rejects(
      run(["doctor"], appRoot, fakeEnv(bin, { workerExists: false })),
      /supports visibility "public" and "shared"/,
    );
  }
});
