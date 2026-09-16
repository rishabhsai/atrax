import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {createCliPlatform, succeeded, failed} from './helpers/cli-platform.mjs';

const tables = ['workspaces', 'workspace_members', 'workspace_operation_receipts', 'library_items', 'library_revisions', 'library_file_versions', 'library_operation_receipts', 'apps', 'app_maintainers', 'operation_receipts', 'activity'];
async function snapshot(api) {
  const rows = {};
  for (const table of tables) rows[table] = (await api.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;
  const bucket = await api.mf.getR2Bucket('LIBRARY_FILES', 'control-plane');
  const listed = await bucket.list();
  assert.equal(listed.truncated, false);
  rows.objects = listed.objects.map(({key, etag, size}) => ({key, etag, size})).sort((a, b) => a.key.localeCompare(b.key));
  return rows;
}

function lastResult(api, operation, key) {
  const call = api.calls.at(-1);
  assert.equal(call.name, operation);
  assert.equal(call.key, key);
  assert.equal(call.status, 200, JSON.stringify(call.body));
  assert.equal(call.body.status, 'succeeded');
  return call.body.result;
}

async function interrupted(api, args, operation, key, person = 'owner') {
  api.loseResponse(operation);
  const error = failed(await api.run(person, args), 'operation_outcome_unknown');
  assert.deepEqual(error.details, {operation, key});
  assert.match(error.message, /may have completed/);
  assert.ok(error.message.includes(`--key ${key}`));
  return lastResult(api, operation, key);
}

test('documented write shortcuts and generic call forward the exact supplied key', {timeout: 60_000}, async t => {
  const api = await createCliPlatform(t);
  await writeFile(join(api.directory, 'brand.md'), 'Use green.');
  await writeFile(join(api.directory, 'brand-v2.md'), 'Use forest green.');
  const docs = await readFile(new URL('../docs/cli-writes.md', import.meta.url), 'utf8');
  const commands = docs.split('\n').filter(line => line.startsWith('atrax '));
  const expected = new Map([
    ['workspace create', 'workspaces.create'],
    ['library upload', 'library.file.upload'],
    ['library replace', 'library.file.replace'],
    ['call library.entry.create', 'library.entry.create'],
  ]);
  assert.equal(commands.length, expected.size, 'each documented write needs a forwarding case');
  const help = await api.run('owner', ['help'], {json: false});
  const helpWrites = help.stdout.split('\n').filter(line => /^\s+atrax .*--key/.test(line));
  assert.equal(helpWrites.length, expected.size, 'every keyed help shortcut is exercised');
  let uploaded;
  for (const command of commands) {
    const substituted = command.replaceAll('<workspace-id>', 'company').replaceAll('<item-id>', uploaded?.item.id ?? '').replaceAll('<current-revision-id>', uploaded?.revision.id ?? '');
    const args = substituted.match(/"[^"]*"|'[^']*'|\S+/g).map(part => /^['"]/.test(part) ? part.slice(1, -1) : part).slice(1);
    const shortcut = args.slice(0, 2).join(' ');
    const operation = expected.get(shortcut);
    assert.ok(operation, `Missing forwarding test for ${shortcut}`);
    const keyIndex = args.indexOf('--key');
    assert.notEqual(keyIndex, -1, `${shortcut} must document a stable key`);
    const result = succeeded(await api.run('owner', args.filter(arg => arg !== '--json')));
    assert.deepEqual(result, lastResult(api, operation, args[keyIndex + 1]));
    if (operation === 'library.file.upload') uploaded = result;
    assert.ok(helpWrites.some(line => line.includes(`atrax ${args[0]} ${args[0] === 'call' ? '<operation>' : args[1]}`)));
    expected.delete(shortcut);
  }
  assert.equal(expected.size, 0);
  assert.match(help.stdout, /Without --key, each invocation generates a new key/);
  assert.match(help.stdout, /Deploy saves its artifact and step keys/);
});

test('workspace create reconciles a lost response using normalized input and rejects changed intent', {timeout: 60_000}, async t => {
  const api = await createCliPlatform(t);
  const key = 'retry-workspace-v1';
  const args = ['workspace', 'create', ' Retry Company ', '--slug', 'RETRY-COMPANY', '--key', key];
  const committed = await interrupted(api, args, 'workspaces.create', key);
  assert.equal(committed.workspace.name, 'Retry Company');
  assert.equal(committed.workspace.slug, 'retry-company');
  assert.deepEqual(committed.membership, {personId: 'owner', role: 'owner'});
  const beforeRetry = await snapshot(api);
  assert.equal(beforeRetry.workspaces.length, 2);
  assert.equal(beforeRetry.workspace_members.length, 3);
  assert.equal(beforeRetry.workspace_operation_receipts.length, 1);
  assert.equal(beforeRetry.workspace_operation_receipts[0].key_hash, createHash('sha256').update(key).digest('hex'));
  assert.deepEqual(succeeded(await api.run('owner', ['workspace', 'create', 'Retry Company', '--slug', 'retry-company', '--key', key])), committed);
  assert.deepEqual(await snapshot(api), beforeRetry);
  const conflict = failed(await api.run('owner', ['workspace', 'create', 'Different Company', '--slug', 'different-company', '--key', key]), 'idempotency_conflict');
  assert.deepEqual(conflict.details, {operation: 'workspaces.create', key});
  assert.deepEqual(await snapshot(api), beforeRetry);
  await api.db.prepare("UPDATE sessions SET revoked_at=? WHERE session_id='owner-session'").bind(Date.now()).run();
  failed(await api.run('owner', args), 'unauthorized');
  assert.deepEqual(await snapshot(api), beforeRetry);
});

test('Library upload and replacement lost responses replay original versions without duplicate D1 or R2 state', {timeout: 60_000}, async t => {
  const api = await createCliPlatform(t);
  const path = join(api.directory, 'policy.md');
  await writeFile(path, 'Initial policy.');
  const upload = ['library', 'upload', path, '--workspace', 'company', '--title', 'Policy', '--key', 'policy-upload-v1'];
  const first = await interrupted(api, upload, 'library.file.upload', 'policy-upload-v1');
  const afterUpload = await snapshot(api);
  assert.equal(afterUpload.library_items.length, 1);
  assert.equal(afterUpload.library_revisions.length, 1);
  assert.equal(afterUpload.library_file_versions.length, 1);
  assert.equal(afterUpload.library_operation_receipts.length, 1);
  assert.equal(afterUpload.objects.length, 1);
  assert.deepEqual(succeeded(await api.run('owner', upload)), first);
  assert.deepEqual(await snapshot(api), afterUpload);
  failed(await api.run('owner', [...upload, '--title', 'Different title']), 'idempotency_conflict');
  await writeFile(path, 'Revised policy.');
  failed(await api.run('owner', upload), 'idempotency_conflict');
  assert.deepEqual(await snapshot(api), afterUpload);

  const replace = ['library', 'replace', first.item.id, path, '--workspace', 'company', '--revision', first.revision.id, '--reason', 'Correct policy', '--key', 'policy-replace-v2'];
  const second = await interrupted(api, replace, 'library.file.replace', 'policy-replace-v2');
  assert.equal(second.item.id, first.item.id);
  assert.equal(second.revision.number, 2);
  assert.notEqual(second.revision.id, first.revision.id);
  const afterReplacement = await snapshot(api);
  assert.equal(afterReplacement.library_items.length, 1);
  assert.equal(afterReplacement.library_revisions.length, 2);
  assert.equal(afterReplacement.library_file_versions.length, 2);
  assert.equal(afterReplacement.library_operation_receipts.length, 2);
  assert.equal(afterReplacement.objects.length, 2);
  assert.deepEqual(succeeded(await api.run('owner', replace)), second);
  failed(await api.run('owner', [...replace, '--reason', 'Different reason']), 'idempotency_conflict');
  await writeFile(path, 'Third policy.');
  failed(await api.run('owner', replace), 'idempotency_conflict');
  assert.deepEqual(await snapshot(api), afterReplacement);

  // The original upload receipt remains exact after a later revision became current.
  await writeFile(path, 'Initial policy.');
  assert.deepEqual(succeeded(await api.run('owner', upload)), first);
  assert.deepEqual(await snapshot(api), afterReplacement);
});

test('Library retries recheck item access, membership, and session validity after a lost response', {timeout: 60_000}, async t => {
  const api = await createCliPlatform(t);
  const path = join(api.directory, 'team.md');
  await writeFile(path, 'Team policy.');
  const upload = ['library', 'upload', path, '--key', 'member-upload-v1'];
  const first = await interrupted(api, upload, 'library.file.upload', 'member-upload-v1', 'member');
  await writeFile(path, 'Corrected team policy.');
  const replace = ['library', 'replace', first.item.id, path, '--revision', first.revision.id, '--reason', 'Correct guidance', '--key', 'member-replace-v2'];
  await interrupted(api, replace, 'library.file.replace', 'member-replace-v2', 'member');
  const changedAccess = await api.call('library.setAccess', {workspaceId: 'company', itemId: first.item.id, audience: 'selected', personIds: ['owner']});
  assert.equal(changedAccess.status, 200, JSON.stringify(changedAccess.body));
  const restricted = await snapshot(api);
  failed(await api.run('member', replace), 'not_found');
  await writeFile(path, 'Team policy.');
  failed(await api.run('member', upload), 'not_found');
  assert.deepEqual(await snapshot(api), restricted);

  const accessible = await api.call('library.setAccess', {workspaceId: 'company', itemId: first.item.id, audience: 'workspace'});
  assert.equal(accessible.status, 200, JSON.stringify(accessible.body));
  const removed = await api.call('members.remove', {workspaceId: 'company', personId: 'member'});
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  const afterRemoval = await snapshot(api);
  failed(await api.run('member', upload), 'forbidden');
  await writeFile(path, 'Corrected team policy.');
  failed(await api.run('member', replace), 'forbidden');
  assert.deepEqual(await snapshot(api), afterRemoval);

  await api.db.prepare("UPDATE sessions SET revoked_at=? WHERE session_id='member-session'").bind(Date.now()).run();
  failed(await api.run('member', replace), 'unauthorized');
  assert.deepEqual(await snapshot(api), afterRemoval);
});

test('interrupted human output preserves the key and an omitted key can be reconciled from JSON failure details', {timeout: 60_000}, async t => {
  const api = await createCliPlatform(t);
  const args = ['workspace', 'create', 'Human retry', '--slug', 'human-retry', '--key', 'human-retry-v1'];
  api.loseResponse('workspaces.create');
  const result = await api.run('owner', args, {json: false});
  assert.equal(result.code, 1);
  assert.match(result.stderr, /may have completed/);
  assert.match(result.stderr, /Retry the same input with --key human-retry-v1/);
  const committed = lastResult(api, 'workspaces.create', 'human-retry-v1');
  assert.deepEqual(succeeded(await api.run('owner', args)), committed);

  const unkeyed = ['workspace', 'create', 'Generated key', '--slug', 'generated-key'];
  api.loseResponse('workspaces.create', {invalidJson: true});
  const error = failed(await api.run('owner', unkeyed), 'operation_outcome_unknown');
  assert.equal(error.details.operation, 'workspaces.create');
  assert.ok(error.details.key);
  const generated = lastResult(api, 'workspaces.create', error.details.key);
  assert.deepEqual(succeeded(await api.run('owner', [...unkeyed, '--key', error.details.key])), generated);
});

test('generic call replays a completed app write only while the caller remains a maintainer', {timeout: 60_000}, async t => {
  const api = await createCliPlatform(t);
  const created = succeeded(await api.run('member', ['call', 'apps.create', '--input', JSON.stringify({workspaceId: 'company', name: 'Team app', slug: 'team-app'}), '--key', 'team-app-create']));
  const args = ['call', 'apps.access.set', '--input', JSON.stringify({appId: created.app.id, audience: 'selected', personIds: ['member'], expectedRevision: 1}), '--key', 'team-app-access'];
  const committed = await interrupted(api, args, 'apps.access.set', 'team-app-access', 'member');
  const afterWrite = await snapshot(api);
  assert.deepEqual(succeeded(await api.run('member', args)), committed);
  assert.deepEqual(await snapshot(api), afterWrite);

  const reassigned = await api.call('apps.maintainers.set', {appId: created.app.id, personIds: ['owner'], expectedRevision: 2});
  assert.equal(reassigned.status, 200, JSON.stringify(reassigned.body));
  const afterRevocation = await snapshot(api);
  failed(await api.run('member', args), 'forbidden');
  assert.deepEqual(await snapshot(api), afterRevocation);
});
