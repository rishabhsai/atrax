import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createCliPlatform, succeeded, failed } from "./helpers/cli-platform.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
async function platform(t) {
  const api = await createCliPlatform(t);
  return {...api,
    run: (person, args) => api.run(person, ["library", ...args]),
    call: (name, input, ...options) => api.call(name, {workspaceId: "company", ...input}, ...options),
  };
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
