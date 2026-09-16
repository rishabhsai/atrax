import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { Miniflare } from "miniflare";
import { bundlePlatform, localMailboxSource, localWorker, migrateControlPlane } from "../cli/local-platform.mjs";

const base64 = (value) => Buffer.from(value).toString("base64");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function platform(t) {
  const mf = new Miniflare({ workers: [
    localWorker("control-plane", await bundlePlatform("control-plane/src/index.js"), {
      CP_DB: { type: "d1", id: "library-files-test-db" },
      LIBRARY_FILES: { type: "r2", name: "library-files-test" },
      CONSOLE_ORIGIN: { type: "json", value: "https://console.atrax.test" },
      EMAIL_FROM: { type: "json", value: "test@atrax.test" },
      EMAIL: { type: "worker", worker: "mailbox", exportName: "Mail" },
    }),
    localWorker("mailbox", localMailboxSource),
  ] });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("CP_DB", "control-plane");
  await migrateControlPlane(db);
  const now = Date.now();
  const tokens = {};
  for (const person of ["owner", "member", "outsider"]) {
    const token = crypto.randomUUID().replaceAll("-", "").repeat(2);
    tokens[person] = token;
    await db.batch([
      db.prepare("INSERT INTO people(person_id,email,verified_at,created_at) VALUES(?,?,?,?)").bind(person, `${person}@example.com`, now, now),
      db.prepare("INSERT INTO sessions(session_id,person_id,secret_hash,kind,created_at,expires_at) VALUES(?,?,?,'cli',?,?)").bind(`${person}-session`, person, createHash("sha256").update(token).digest("hex"), now, now + 3_600_000),
    ]);
  }
  await db.batch([
    db.prepare("INSERT INTO workspaces(workspace_id,name,slug,created_by,created_at) VALUES('company','Company','company','owner',?)").bind(now),
    db.prepare("INSERT INTO workspace_members(workspace_id,person_id,role,status,joined_at) VALUES('company','owner','owner','active',?),('company','member','member','active',?)").bind(now, now),
  ]);
  async function call(operation, input = {}, person = "owner", key = crypto.randomUUID()) {
    const response = await mf.dispatchFetch(`https://api.atrax.test/v1/operations/${operation}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[person]}`, "Idempotency-Key": key },
      body: JSON.stringify({ workspaceId: "company", ...input }),
    });
    const body = await response.json();
    return { status: response.status, body, result: body.result };
  }
  async function okay(operation, input = {}, person = "owner", key) {
    const response = await call(operation, input, person, key);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.result;
  }
  return { mf, db, call, okay, tokens };
}

test("Library files store immutable R2 versions, extract only supported text, and retain versioned downloads", { timeout: 45_000 }, async (t) => {
  const api = await platform(t);
  const capabilities = await api.okay("library.files.capabilities");
  assert.equal(capabilities.maxBytes, 10 * 1024 * 1024);
  assert.deepEqual(capabilities.acceptedContentTypes, ["text/plain", "text/markdown", "text/csv", "application/json", "application/pdf"]);

  const original = "All deliveries need a signed receipt.";
  const uploaded = await api.okay("library.file.upload", {
    filename: "delivery-policy.txt",
    contentType: "text/plain",
    contentBase64: base64(original),
  }, "member", "upload-delivery-policy");
  assert.equal(uploaded.item.kind, "file");
  assert.equal(uploaded.revision.title, "delivery-policy.txt");
  assert.equal(uploaded.revision.indexingStatus, "ready");
  assert.deepEqual(uploaded.revision.file, {
    filename: "delivery-policy.txt",
    contentType: "text/plain",
    byteSize: Buffer.byteLength(original),
    sha256: sha256(original),
    uploadedAt: uploaded.revision.createdAt,
  });

  const objectKey = (await api.db.prepare("SELECT object_key FROM library_file_versions WHERE revision_id=?").bind(uploaded.revision.id).first()).object_key;
  const bucket = await api.mf.getR2Bucket("LIBRARY_FILES", "control-plane");
  assert.equal(await (await bucket.get(objectKey)).text(), original);
  assert.equal((await api.okay("library.search", { query: "signed receipt" }, "member")).items[0].id, uploaded.item.id);

  const replacementText = "All deliveries need a signed receipt from the named buyer.";
  const replacement = await api.okay("library.file.replace", {
    itemId: uploaded.item.id,
    baseRevisionId: uploaded.revision.id,
    filename: "delivery-policy-v2.txt",
    contentType: "text/plain",
    contentBase64: base64(replacementText),
    reason: "Clarified who signs",
  }, "owner", "replace-delivery-policy");
  assert.equal(replacement.revision.number, 2);
  assert.equal(replacement.revision.file.uploadedAt, replacement.revision.createdAt);
  assert.notEqual(replacement.revision.file.sha256, uploaded.revision.file.sha256);
  assert.equal((await api.okay("library.file.download", { itemId: uploaded.item.id }, "member")).contentBase64, base64(replacementText));
  assert.equal((await api.okay("library.file.download", { itemId: uploaded.item.id, revisionId: uploaded.revision.id }, "member")).contentBase64, base64(original));
  const history = await api.okay("library.history", { itemId: uploaded.item.id }, "member");
  assert.deepEqual(history.revisions.map((revision) => revision.reason), ["Clarified who signs", "Uploaded"]);
  assert.deepEqual(history.revisions.map((revision) => revision.file.filename), ["delivery-policy-v2.txt", "delivery-policy.txt"]);

  const pdf = await api.okay("library.file.upload", {
    filename: "handbook.pdf",
    contentType: "application/pdf",
    contentBase64: base64("%PDF-not-extracted"),
  });
  assert.equal(pdf.revision.indexingStatus, "stored_without_text");
  assert.equal((await api.okay("library.search", { query: "not-extracted" })).items.length, 0);
});

test("Library file access follows current item, source, membership, and byte-limit checks", { timeout: 60_000 }, async (t) => {
  const api = await platform(t);
  const source = await api.okay("library.file.upload", {
    filename: "confidential.txt",
    contentType: "text/plain",
    contentBase64: base64("The confidential supplier rate is twenty."),
  });
  const derived = await api.okay("library.file.upload", {
    filename: "summary.txt",
    contentType: "text/plain",
    contentBase64: base64("Use the confidential supplier rate in the summary."),
    sourceRevisions: [{ itemId: source.item.id, revisionId: source.revision.id }],
  }, "member");
  await api.okay("library.setAccess", { itemId: source.item.id, audience: "selected", personIds: ["owner"] });
  assert.equal((await api.call("library.file.download", { itemId: derived.item.id }, "member")).status, 404);
  assert.equal((await api.okay("library.file.download", { itemId: derived.item.id })).contentBase64, base64("Use the confidential supplier rate in the summary."));

  const workspaceFile = await api.okay("library.file.upload", {
    filename: "team.txt",
    contentType: "text/plain",
    contentBase64: base64("Available to the team before removal."),
  });
  assert.equal((await api.okay("library.file.download", { itemId: workspaceFile.item.id }, "member")).contentBase64, base64("Available to the team before removal."));
  await api.okay("members.remove", { personId: "member" });
  assert.equal((await api.call("library.file.download", { itemId: workspaceFile.item.id }, "member")).status, 403);
  assert.equal((await api.call("library.file.upload", {
    filename: "too-large.txt",
    contentType: "text/plain",
    contentBase64: Buffer.alloc(10 * 1024 * 1024 + 1, 97).toString("base64"),
  })).status, 413);
});

test("concurrent file retries retain only the R2 version committed to Library history", { timeout: 45_000 }, async (t) => {
  const api = await platform(t);
  const bucket = await api.mf.getR2Bucket("LIBRARY_FILES", "control-plane");
  const uploadInput = {
    filename: "concurrent.txt",
    contentType: "text/plain",
    contentBase64: base64("The committed upload has one immutable object."),
  };
  const uploads = await Promise.all(Array.from({ length: 6 }, () =>
    api.call("library.file.upload", uploadInput, "owner", "concurrent-upload"),
  ));
  for (const upload of uploads) assert.equal(upload.status, 200, JSON.stringify(upload.body));
  assert.deepEqual(uploads[0].result, uploads[1].result);

  const itemId = uploads[0].result.item.id;
  const currentRevisionId = uploads[0].result.revision.id;
  const replaceInput = {
    itemId,
    baseRevisionId: currentRevisionId,
    filename: "concurrent-v2.txt",
    contentType: "text/plain",
    contentBase64: base64("The committed replacement has one immutable object."),
    reason: "Concurrent retry regression coverage",
  };
  const replacements = await Promise.all(Array.from({ length: 6 }, () =>
    api.call("library.file.replace", replaceInput, "owner", "concurrent-replace"),
  ));
  for (const replacement of replacements) assert.equal(replacement.status, 200, JSON.stringify(replacement.body));
  assert.deepEqual(replacements[0].result, replacements[1].result);

  const versions = await api.db.prepare("SELECT object_key FROM library_file_versions WHERE item_id=? ORDER BY revision_id").bind(itemId).all();
  const stored = await bucket.list({ prefix: "library/company/" });
  assert.deepEqual(
    stored.objects.map((object) => object.key).sort(),
    versions.results.map((version) => version.object_key).sort(),
    "every R2 object belongs to a committed immutable file version",
  );
});
