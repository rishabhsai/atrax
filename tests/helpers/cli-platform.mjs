import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Miniflare } from "miniflare";
import { bundlePlatform, localMailboxSource, localWorker, migrateControlPlane } from "../../cli/local-platform.mjs";

const root = resolve(import.meta.dirname, "../..");
const cli = join(root, "bin/atrax.mjs");
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export async function createCliPlatform(t) {
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

  const workerOrigin = (await mf.ready).origin;
  const calls = [];
  let lostResponse;
  let serverError;
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const name = decodeURIComponent(request.url.split("/").at(-1));
      const upstream = await fetch(`${workerOrigin}${request.url}`, {
        method: request.method,
        headers: request.headers,
        body,
      });
      // Read the actual Worker result before dropping the client connection.
      const responseBody = await upstream.text();
      calls.push({name, key: request.headers["idempotency-key"], input: JSON.parse(body), status: upstream.status, body: JSON.parse(responseBody)});
      if (lostResponse?.name === name) {
        const invalidJson = lostResponse.invalidJson;
        lostResponse = undefined;
        if (invalidJson) {
          response.writeHead(502, {"Content-Type": "text/plain"});
          response.end("Upstream response unavailable");
        } else request.socket.destroy();
        return;
      }
      response.writeHead(upstream.status, {"Content-Type": "application/json"});
      response.end(responseBody);
    } catch (error) {
      serverError = error;
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
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
      body: JSON.stringify(input),
    });
    return { status: response.status, body: await response.json() };
  }

  async function run(person, args, {json = true} = {}) {
    const child = spawn(process.execPath, [cli, ...args, ...(json ? ["--json"] : [])], {
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
    assert.ifError(serverError);
    if (!json) return {code, stdout, stderr};
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

  return { directory, mf, db, call, run, calls, loseResponse(name, {invalidJson = false} = {}) { lostResponse = {name, invalidJson}; } };
}

export function succeeded(result) {
  assert.equal(result.code, 0, JSON.stringify(result.envelope));
  assert.equal(
    result.envelope.status,
    "succeeded",
    JSON.stringify(result.envelope),
  );
  return result.envelope.result;
}

export function failed(result, code) {
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
