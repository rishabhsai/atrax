import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import test from 'node:test';
import {build} from 'esbuild';

// Bundle the shipped state owner and its error class together so instanceof
// checks follow the same module identity as the console.
const {outputFiles} = await build({
  stdin: {
    contents: 'export {createSessionStore} from "./components/console/session-store"; export {ApiError, onSessionFailure, operation} from "./components/console/api";',
    resolveDir: resolve(import.meta.dirname, '..'),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const {createSessionStore, ApiError, onSessionFailure, operation} = await import(
  `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`
);

function session(workspaces = [{id: 'workspace-1', name: 'Workshop', slug: 'workshop', role: 'owner'}]) {
  return {
    person: {id: 'person-1', email: 'owner@example.test'},
    session: {id: 'session-1', expiresAt: 9_999_999},
    workspaces,
    invitations: [],
  };
}

function fixture() {
  let time = 1_000;
  const requests = [];
  const store = createSessionStore(signal => new Promise((resolve, reject) => {
    // Deliberately do not reject on abort: a response already in flight can
    // still settle, and the store must ignore it.
    requests.push({signal, resolve, reject});
  }), () => time);
  return {store, requests, advance: milliseconds => {time += milliseconds;}};
}

async function signIn(fixture, value = session()) {
  const loading = fixture.store.ensure();
  fixture.requests.at(-1).resolve(value);
  await loading;
  return value;
}

test('concurrent console consumers share one session request', async () => {
  const {store, requests} = fixture();
  const first = store.ensure();
  const second = store.ensure();
  const refresh = store.refresh();
  assert.equal(requests.length, 1);
  assert.strictEqual(first, second);
  assert.strictEqual(first, refresh);
  assert.equal(store.getSnapshot().kind, 'loading');

  const value = session();
  requests[0].resolve(value);
  await Promise.all([first, second, refresh]);
  assert.deepEqual(store.getSnapshot(), {
    kind: 'ready', session: value, refreshing: false, refreshError: null,
  });
});

test('navigation reuses the fresh session without publishing a loading state', async () => {
  const f = fixture();
  const firstPageStates = [];
  const leavePage = f.store.subscribe(() => firstPageStates.push(f.store.getSnapshot()));
  await signIn(f);
  leavePage();
  const ready = f.store.getSnapshot();
  const previousNotifications = firstPageStates.length;
  const nextPageStates = [];
  const leaveNextPage = f.store.subscribe(() => nextPageStates.push(f.store.getSnapshot()));
  f.advance(59_999);

  await f.store.ensure();
  assert.strictEqual(f.store.getSnapshot(), ready);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(nextPageStates, []);
  assert.equal(firstPageStates.length, previousNotifications);
  leaveNextPage();
});

test('stale navigation keeps ready chrome while refreshing workspace membership', async () => {
  const f = fixture();
  const original = await signIn(f);
  const observed = [];
  f.store.subscribe(() => observed.push(f.store.getSnapshot()));
  f.advance(60_000);
  const pending = f.store.ensure();

  assert.equal(f.requests.length, 2);
  assert.deepEqual(f.store.getSnapshot(), {
    kind: 'ready', session: original, refreshing: true, refreshError: null,
  });
  const updated = session([{id: 'workspace-2', name: 'New team', slug: 'new-team', role: 'member'}]);
  f.requests[1].resolve(updated);
  await pending;

  assert.deepEqual(f.store.getSnapshot(), {
    kind: 'ready', session: updated, refreshing: false, refreshError: null,
  });
  assert.ok(observed.every(state => state.kind === 'ready'));
  await f.store.ensure();
  assert.equal(f.requests.length, 2, 'successful refresh starts a new freshness window');
});

test('explicit refresh updates a fresh directory after accepting an invitation', async () => {
  const f = fixture();
  const invited = session([]);
  invited.invitations = [{id: 'invite-1', workspaceId: 'workspace-1', workspaceName: 'Workshop', role: 'member', expiresAt: 9_999_999}];
  await signIn(f, invited);
  const pending = f.store.refresh();
  assert.equal(f.requests.length, 2);
  assert.strictEqual(f.store.getSnapshot().session, invited);

  const accepted = session([{id: 'workspace-1', name: 'Workshop', slug: 'workshop', role: 'member'}]);
  f.requests[1].resolve(accepted);
  await pending;
  assert.deepEqual(f.store.getSnapshot().session, accepted);
  assert.deepEqual(f.store.getSnapshot().session.invitations, []);
});

test('authentication failure removes the cached session', async () => {
  const f = fixture();
  await signIn(f);
  const unauthorized = new ApiError('Sign in again.', 'unauthorized', false);
  const pending = f.store.refresh();
  const rejected = assert.rejects(pending, error => error === unauthorized);
  f.requests[1].reject(unauthorized);
  await rejected;

  assert.deepEqual(f.store.getSnapshot(), {kind: 'error', error: unauthorized});
  const recovery = f.store.ensure();
  assert.equal(f.requests.length, 3, 'an invalid session cannot satisfy navigation');
  assert.equal(f.store.getSnapshot().kind, 'loading');
  f.requests[2].resolve(session());
  await recovery;
  assert.equal(f.store.getSnapshot().kind, 'ready');
});

test('network failure preserves ready chrome with a notice and can retry', async () => {
  const f = fixture();
  const original = await signIn(f);
  f.advance(60_000);
  const failure = new Error('The network is unavailable.');
  const pending = f.store.ensure();
  const rejected = assert.rejects(pending, error => error === failure);
  f.requests[1].reject(failure);
  await rejected;

  assert.deepEqual(f.store.getSnapshot(), {
    kind: 'ready', session: original, refreshing: false, refreshError: failure.message,
  });
  const retry = f.store.ensure();
  assert.equal(f.requests.length, 3, 'failed refresh does not mark stale data fresh');
  assert.deepEqual(f.store.getSnapshot(), {
    kind: 'ready', session: original, refreshing: true, refreshError: null,
  });
  f.requests[2].resolve(original);
  await retry;
  assert.equal(f.store.getSnapshot().refreshError, null);
});

test('initial request failure exposes an error instead of an empty ready session', async () => {
  const {store, requests} = fixture();
  const failure = new Error('Offline');
  const pending = store.ensure();
  const rejected = assert.rejects(pending, error => error === failure);
  requests[0].reject(failure);
  await rejected;
  assert.deepEqual(store.getSnapshot(), {kind: 'error', error: failure});
});

test('invalidation aborts refresh and a late successful response cannot restore the session', async () => {
  const f = fixture();
  await signIn(f);
  const pending = f.store.refresh();
  const unauthorized = new ApiError('Session revoked.', 'unauthorized', false);
  const observed = [];
  f.store.subscribe(() => observed.push(f.store.getSnapshot()));
  f.store.invalidate(unauthorized);
  assert.equal(f.requests[1].signal.aborted, true);
  assert.deepEqual(f.store.getSnapshot(), {kind: 'error', error: unauthorized});
  assert.deepEqual(observed, [{kind: 'error', error: unauthorized}], 'invalidation must not publish the revoked session');

  f.requests[1].resolve(session());
  await pending;
  assert.deepEqual(f.store.getSnapshot(), {kind: 'error', error: unauthorized});
});

test('cancelling a fresh background refresh clears progress and preserves the freshness deadline', async () => {
  const f = fixture();
  const original = await signIn(f);
  f.advance(59_000);
  const pending = f.store.refresh();
  const observed = [];
  f.store.subscribe(() => observed.push(f.store.getSnapshot()));
  f.store.cancel();

  const ready = {kind: 'ready', session: original, refreshing: false, refreshError: null};
  assert.equal(f.requests[1].signal.aborted, true);
  assert.deepEqual(f.store.getSnapshot(), ready);
  assert.deepEqual(observed, [ready], 'subscribers must see that the refresh stopped');
  await f.store.ensure();
  assert.equal(f.requests.length, 2, 'the existing fresh session remains usable');
  assert.deepEqual(f.store.getSnapshot(), ready);

  f.requests[1].resolve(session([]));
  await pending;
  assert.deepEqual(f.store.getSnapshot(), ready, 'cancelled responses cannot replace the directory');
  f.advance(1_000);
  const next = f.store.ensure();
  assert.equal(f.requests.length, 3, 'cancellation must not extend the freshness deadline');
  f.requests[2].resolve(original);
  await next;
});

test('cancelled requests cannot overwrite or clear a replacement request', async () => {
  for (const settlement of ['resolve', 'reject']) {
    const {store, requests} = fixture();
    const old = store.ensure();
    store.cancel();
    assert.equal(requests[0].signal.aborted, true);
    const replacement = store.ensure();
    assert.equal(requests.length, 2);

    requests[0][settlement](settlement === 'resolve' ? session() : new Error('Old request failed'));
    await old;
    assert.equal(store.getSnapshot().kind, 'loading');
    assert.strictEqual(store.ensure(), replacement, 'old cleanup must not clear the current request');
    assert.equal(requests.length, 2);

    const current = session([]);
    requests[1].resolve(current);
    await replacement;
    assert.deepEqual(store.getSnapshot(), {
      kind: 'ready', session: current, refreshing: false, refreshError: null,
    });
  }
});

test('identity replacement discards the previous account even if the new session fails to load', async () => {
  const f = fixture();
  await signIn(f);
  f.store.reset();
  assert.deepEqual(f.store.getSnapshot(), {kind: 'loading'});
  const pending = f.store.refresh();
  const failure = new Error('The new session could not be loaded.');
  const rejected = assert.rejects(pending, error => error === failure);
  f.requests[1].reject(failure);
  await rejected;
  assert.deepEqual(f.store.getSnapshot(), {kind: 'error', error: failure});

  const retry = f.store.ensure();
  assert.equal(f.requests.length, 3, 'the previous account cannot satisfy a fresh navigation');
  const replacement = session([]);
  replacement.person = {id: 'person-2', email: 'new-account@example.test'};
  replacement.session.id = 'session-2';
  f.requests[2].resolve(replacement);
  await retry;
  assert.deepEqual(f.store.getSnapshot().session, replacement);
});

test('reset supersedes a background refresh and ignores the previous identity response', async () => {
  for (const oldCompletesFirst of [true, false]) {
    const f = fixture();
    const original = await signIn(f);
    const old = f.store.refresh();
    const observed = [];
    f.store.subscribe(() => observed.push(f.store.getSnapshot()));
    f.store.reset();
    const replacement = f.store.refresh();
    assert.equal(f.requests[1].signal.aborted, true);
    assert.equal(f.requests.length, 3);
    assert.ok(observed.every(state => state.kind === 'loading'), 'reset never republishes the previous account');

    const current = session([]);
    current.person = {id: 'person-2', email: 'new-account@example.test'};
    current.session.id = 'session-2';
    if (oldCompletesFirst) {
      f.requests[1].resolve(original);
      await old;
      assert.equal(f.store.getSnapshot().kind, 'loading');
      assert.strictEqual(f.store.ensure(), replacement, 'superseded cleanup cannot clear the identity request');
      f.requests[2].resolve(current);
      await replacement;
    } else {
      f.requests[2].resolve(current);
      await replacement;
      f.requests[1].resolve(original);
      await old;
    }
    assert.deepEqual(f.store.getSnapshot(), {
      kind: 'ready', session: current, refreshing: false, refreshError: null,
    });
  }
});

test('unauthorized responses notify session consumers for both session loading operations', async t => {
  let failures = 0;
  const unsubscribe = onSessionFailure(() => {failures++;});
  t.after(unsubscribe);
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    schemaVersion: 1,
    operationId: 'denied-request',
    status: 'failed',
    error: {code: 'unauthorized', message: 'Sign in to continue.', retryable: false},
  }, {status: 401}));
  for (const name of ['auth.session.get', 'workspaces.list', 'apps.list']) {
    await assert.rejects(operation(name, {}, value => value), error => error instanceof ApiError && error.code === 'unauthorized');
  }
  assert.equal(failures, 3);
  unsubscribe();
  await assert.rejects(operation('apps.list', {}, value => value));
  assert.equal(failures, 3, 'unmounted session consumers receive no failures');
});

test('an aborted request cannot notify a replacement identity about its late authorization failure', async t => {
  let failures = 0;
  t.after(onSessionFailure(() => {failures++;}));
  const response = Promise.withResolvers();
  t.mock.method(globalThis, 'fetch', () => response.promise);
  const controller = new AbortController();
  const pending = operation('workspaces.list', {}, value => value, {signal: controller.signal});
  const rejected = assert.rejects(pending, error => error instanceof ApiError && error.code === 'unauthorized');
  controller.abort();
  response.resolve(Response.json({
    schemaVersion: 1,
    operationId: 'old-session',
    status: 'failed',
    error: {code: 'unauthorized', message: 'The old session ended.', retryable: false},
  }, {status: 401}));
  await rejected;
  assert.equal(failures, 0);
});
