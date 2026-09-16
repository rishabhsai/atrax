import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Miniflare } from "miniflare";
import {
  bundlePlatform,
  localMailboxSource,
  localWorker,
  migrateControlPlane,
} from "../cli/local-platform.mjs";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "bin/atrax.mjs");

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function platform(t) {
  const directory = await mkdtemp(join(tmpdir(), "atrax-library-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const mf = new Miniflare({
    host: "127.0.0.1",
    port: 0,
    workers: [
      localWorker(
        "control-plane",
        await bundlePlatform("control-plane/src/index.js"),
        {
          CP_DB: { type: "d1", id: "library-cli-test-db" },
          LIBRARY_FILES: { type: "r2", name: "library-cli-files" },
          CONSOLE_ORIGIN: { type: "json", value: "https://console.atrax.test" },
          EMAIL_FROM: { type: "json", value: "test@atrax.test" },
          EMAIL: { type: "worker", worker: "mailbox", exportName: "Mail" },
        },
      ),
      localWorker("mailbox", localMailboxSource),
    ],
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("CP_DB", "control-plane");
  await migrateControlPlane(db);

  const now = Date.now();
  const tokens = { owner: "a".repeat(64), member: "b".repeat(64) };
  await db.batch([
    ...Object.entries(tokens).flatMap(([person, token]) => [
      db
        .prepare(
          "INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)",
        )
        .bind(person, `${person}@example.com`, now, now),
      db
        .prepare(
          "INSERT INTO sessions(session_id,person_id,secret_hash,kind,created_at,expires_at) VALUES(?,?,?,'cli',?,?)",
        )
        .bind(`${person}-session`, person, digest(token), now, now + 3_600_000),
    ]),
    db
      .prepare(
        "INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)",
      )
      .bind(now),
    db
      .prepare(
        "INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?)",
      )
      .bind(now, now),
  ]);

  const origin = (await mf.ready).origin;
  async function credentials(person) {
    const config = join(directory, `config-${person}`);
    await mkdir(config, { recursive: true, mode: 0o700 });
    await writeFile(
      join(config, "credentials.json"),
      JSON.stringify({
        origin,
        accessToken: tokens[person],
        session: { id: `${person}-session` },
        person: { id: person },
        workspaceId: "company",
      }),
      { mode: 0o600 },
    );
    return config;
  }
  const configs = {
    owner: await credentials("owner"),
    member: await credentials("member"),
  };

  async function call(
    name,
    input,
    person = "owner",
    key = crypto.randomUUID(),
  ) {
    const response = await fetch(`${origin}/v1/operations/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens[person]}`,
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ workspaceId: "company", ...input }),
    });
    return { status: response.status, body: await response.json() };
  }

  async function run(person, args) {
    const child = spawn(process.execPath, [cli, "library", "--json", ...args], {
      cwd: directory,
      env: {
        ...process.env,
        ATRAX_API_ORIGIN: origin,
        ATRAX_CONFIG_DIR: configs[person],
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const { code, signal } = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (exitCode, exitSignal) =>
        resolve({ code: exitCode, signal: exitSignal }),
      );
    });
    assert.equal(signal, null, `CLI was not signalled: ${stderr}`);
    const lines = stdout.trim().split("\n").filter(Boolean);
    assert.equal(
      lines.length,
      1,
      `CLI should emit one JSON envelope: ${stdout}`,
    );
    const envelope = JSON.parse(lines[0]);
    assert.equal(stdout.includes(tokens.owner), false);
    assert.equal(stdout.includes(tokens.member), false);
    return { code, stderr, envelope };
  }

  return { directory, mf, db, call, run };
}

function succeeded(result) {
  assert.equal(result.code, 0, JSON.stringify(result.envelope));
  assert.equal(
    result.envelope.status,
    "succeeded",
    JSON.stringify(result.envelope),
  );
  return result.envelope.result;
}

function failed(result, code) {
  assert.equal(result.code, 1, JSON.stringify(result.envelope));
  assert.equal(
    result.envelope.status,
    "failed",
    JSON.stringify(result.envelope),
  );
  assert.equal(
    result.envelope.error.code,
    code,
    JSON.stringify(result.envelope),
  );
  return result.envelope.error;
}

test(
  "Library CLI uploads, replays, replaces, searches, and downloads immutable R2 versions",
  { timeout: 60_000 },
  async (t) => {
    const api = await platform(t);
    const firstBytes = Buffer.from("Dispatch needs a signed receipt.");
    const revisedBytes = Buffer.from(
      "Dispatch needs a signed receipt from the named buyer.",
    );
    const firstPath = join(api.directory, "dispatch.md");
    const revisedPath = join(api.directory, "dispatch-v2.md");
    const currentDownload = join(api.directory, "current.md");
    const historicalDownload = join(api.directory, "original.md");
    await writeFile(firstPath, firstBytes);
    await writeFile(revisedPath, revisedBytes);

    const uploadArgs = [
      "upload",
      firstPath,
      "--workspace",
      "company",
      "--key",
      "dispatch-upload-v1",
    ];
    const uploaded = succeeded(await api.run("owner", uploadArgs));
    const replayed = succeeded(await api.run("owner", uploadArgs));
    assert.equal(replayed.item.id, uploaded.item.id);
    assert.equal(replayed.revision.id, uploaded.revision.id);
    assert.equal(
      (
        await api.db
          .prepare(
            "SELECT COUNT(*) AS count FROM library_file_versions WHERE item_id=?",
          )
          .bind(uploaded.item.id)
          .first()
      ).count,
      1,
    );

    const objectKey = (
      await api.db
        .prepare(
          "SELECT object_key FROM library_file_versions WHERE revision_id=?",
        )
        .bind(uploaded.revision.id)
        .first()
    ).object_key;
    const bucket = await api.mf.getR2Bucket("LIBRARY_FILES", "control-plane");
    assert.deepEqual(
      Buffer.from(await (await bucket.get(objectKey)).arrayBuffer()),
      firstBytes,
    );
    assert.equal(uploaded.revision.file.sha256, digest(firstBytes));
    assert.equal(uploaded.revision.file.byteSize, firstBytes.byteLength);

    await writeFile(
      firstPath,
      Buffer.from("Changed bytes with the same command key."),
    );
    failed(await api.run("owner", uploadArgs), "idempotency_conflict");

    const replacement = succeeded(
      await api.run("owner", [
        "replace",
        uploaded.item.id,
        revisedPath,
        "--workspace",
        "company",
        "--revision",
        uploaded.revision.id,
        "--reason",
        "Clarify who signs",
        "--key",
        "dispatch-replace-v2",
      ]),
    );
    assert.equal(replacement.revision.number, 2);
    assert.equal(replacement.revision.file.sha256, digest(revisedBytes));
    assert.notEqual(
      replacement.revision.file.sha256,
      uploaded.revision.file.sha256,
    );

    const searched = succeeded(
      await api.run("member", [
        "search",
        "named buyer",
        "--workspace",
        "company",
      ]),
    );
    assert.deepEqual(
      searched.items.map((item) => item.id),
      [uploaded.item.id],
    );

    const downloaded = succeeded(
      await api.run("member", [
        "download",
        uploaded.item.id,
        "--workspace",
        "company",
        "--out",
        currentDownload,
      ]),
    );
    assert.equal(downloaded.path, currentDownload);
    assert.deepEqual(await readFile(currentDownload), revisedBytes);
    failed(
      await api.run("member", [
        "download",
        uploaded.item.id,
        "--workspace",
        "company",
        "--out",
        currentDownload,
      ]),
      "EEXIST",
    );
    assert.deepEqual(await readFile(currentDownload), revisedBytes);
    const old = succeeded(
      await api.run("member", [
        "download",
        uploaded.item.id,
        "--workspace",
        "company",
        "--revision",
        uploaded.revision.id,
        "--out",
        historicalDownload,
      ]),
    );
    assert.equal(old.file.sha256, digest(firstBytes));
    assert.deepEqual(await readFile(historicalDownload), firstBytes);

    const history = await api.call("library.history", {
      itemId: uploaded.item.id,
    });
    assert.equal(history.status, 200, JSON.stringify(history.body));
    assert.deepEqual(
      history.body.result.revisions.map((revision) => revision.id),
      [replacement.revision.id, uploaded.revision.id],
    );
  },
);

test(
  "Library CLI search and download honor selected access and current membership",
  { timeout: 60_000 },
  async (t) => {
    const api = await platform(t);
    const path = join(api.directory, "restricted.txt");
    await writeFile(path, "The launch passphrase is orchid.");
    const uploaded = succeeded(
      await api.run("owner", [
        "upload",
        path,
        "--workspace",
        "company",
        "--key",
        "restricted-v1",
      ]),
    );

    const selected = await api.call(
      "library.setAccess",
      { itemId: uploaded.item.id, audience: "selected", personIds: ["owner"] },
      "owner",
      "restrict-owner-only",
    );
    assert.equal(selected.status, 200, JSON.stringify(selected.body));
    const deniedSearch = succeeded(
      await api.run("member", ["search", "orchid", "--workspace", "company"]),
    );
    assert.deepEqual(deniedSearch.items, []);
    failed(
      await api.run("member", [
        "download",
        uploaded.item.id,
        "--workspace",
        "company",
        "--out",
        join(api.directory, "denied.txt"),
      ]),
      "not_found",
    );

    const accessiblePath = join(api.directory, "team.txt");
    await writeFile(accessiblePath, "Members may read this before removal.");
    const teamFile = succeeded(
      await api.run("owner", [
        "upload",
        accessiblePath,
        "--workspace",
        "company",
        "--key",
        "team-v1",
      ]),
    );
    succeeded(
      await api.run("member", [
        "search",
        "before removal",
        "--workspace",
        "company",
      ]),
    );
    const removed = await api.call(
      "members.remove",
      { personId: "member" },
      "owner",
      "remove-member",
    );
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    failed(
      await api.run("member", [
        "search",
        "before removal",
        "--workspace",
        "company",
      ]),
      "forbidden",
    );
    failed(
      await api.run("member", [
        "download",
        teamFile.item.id,
        "--workspace",
        "company",
        "--out",
        join(api.directory, "revoked.txt"),
      ]),
      "forbidden",
    );
  },
);
