import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
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

  const checked = await run(["doctor", "--json"], appRoot);
  const doctorPayload = JSON.parse(checked.stdout);
  assert.equal(doctorPayload.status, "ready");
  assert.equal(doctorPayload.deployed, false);

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

test("rejects an invalid app name without creating a partial app", async () => {
  const root = await mkdtemp(join(tmpdir(), "tarantula-cli-"));
  await assert.rejects(
    run(["new", "Bad Name", "--template", "chat"], root),
    /App names use 2 to 48 lowercase/,
  );
});
