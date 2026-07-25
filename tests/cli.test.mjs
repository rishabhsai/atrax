import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cli = resolve("bin/tarantula.mjs");

async function run(args, cwd) {
  const result = await execFileAsync(process.execPath, [cli, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
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

test("logs requires a deployed lock before contacting Cloudflare", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await run(["new", "local-chat", "--template", "chat"], root);
  await assert.rejects(
    run(["logs"], join(root, "local-chat")),
    /has not been deployed/,
  );
});
