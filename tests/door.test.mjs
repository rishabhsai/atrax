import assert from "node:assert/strict";
import test from "node:test";
import {
  handleDoor,
  readCookie,
  sessionCookie,
  sessionCookieName,
  sha256Hex,
  signSession,
  verifySession,
} from "../templates/chat/src/door.js";

const secret = "test-door-session-secret";

test("signs and verifies a session cookie value", async () => {
  const expiresAt = Date.now() + 60_000;
  const value = await signSession(secret, 7, expiresAt);
  assert.equal(value.split(".").length, 3);
  assert.equal(value.startsWith(`7.${expiresAt}.`), true);

  const session = await verifySession(secret, value);
  assert.deepEqual(session, { memberId: 7, expiresAt });
});

test("rejects tampered, foreign, and malformed cookie values", async () => {
  const expiresAt = Date.now() + 60_000;
  const value = await signSession(secret, 7, expiresAt);
  const [, , signature] = value.split(".");

  assert.equal(await verifySession(secret, `9.${expiresAt}.${signature}`), null);
  assert.equal(
    await verifySession(secret, `7.${expiresAt + 1}.${signature}`),
    null,
  );
  assert.equal(
    await verifySession(secret, `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`),
    null,
  );
  assert.equal(await verifySession("another-secret", value), null);
  assert.equal(await verifySession(secret, "7.not-a-number.sig"), null);
  assert.equal(await verifySession(secret, "nonsense"), null);
  assert.equal(await verifySession("", value), null);
});

test("rejects a correctly signed but expired session", async () => {
  const expiresAt = Date.now() - 1;
  const value = await signSession(secret, 3, expiresAt);
  assert.equal(await verifySession(secret, value), null);
  assert.deepEqual(await verifySession(secret, value, expiresAt - 1000), {
    memberId: 3,
    expiresAt,
  });
});

test("builds and reads the session cookie", async () => {
  const now = Date.now();
  const header = sessionCookie("abc", now + 60_000, now);
  assert.match(header, /^__door_session=abc; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=60$/);
  assert.equal(
    readCookie(`other=1; ${sessionCookieName}=abc; last=2`, sessionCookieName),
    "abc",
  );
  assert.equal(readCookie("other=1", sessionCookieName), null);
  assert.equal(readCookie(null, sessionCookieName), null);
});

class FakeDatabase {
  constructor(members) {
    this.members = members;
    this.updates = [];
  }

  prepare(sql) {
    return {
      sql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      first: async () => {
        if (this.lastSql.includes("invite_hash = ?")) {
          const [hash, now] = this.lastValues;
          return (
            this.members.find(
              (item) =>
                item.invite_hash === hash && (item.invite_expires_at ?? 0) > now,
            ) ?? null
          );
        }
        const [id] = this.lastValues;
        return this.members.find((item) => item.id === id) ?? null;
      },
      run: async () => {
        this.updates.push(this.lastValues);
        const [joinedAt, id] = this.lastValues;
        const member = this.members.find((item) => item.id === id);
        if (member) {
          member.joined_at = member.joined_at ?? joinedAt;
          member.invite_hash = null;
          member.invite_expires_at = null;
        }
        return { success: true };
      },
    };
  }
}

// The fake statement records the last prepare/bind pair so the assertions above
// can stay small. Wrap prepare to capture it.
function database(members) {
  const fake = new FakeDatabase(members);
  const prepare = fake.prepare.bind(fake);
  fake.prepare = (sql) => {
    fake.lastSql = sql;
    const statement = prepare(sql);
    const bind = statement.bind.bind(statement);
    statement.bind = (...values) => {
      fake.lastValues = values;
      return bind(...values);
    };
    return statement;
  };
  return fake;
}

test("passes every request through when the app is public", async () => {
  const env = { ATRAX_VISIBILITY: "public", DB: database([]) };
  assert.equal(
    await handleDoor(new Request("https://app.example/"), env),
    null,
  );
  assert.equal(
    await handleDoor(new Request("https://app.example/.door/whoami"), env),
    null,
  );
});

test("gates a shared app and lets the health contract through", async () => {
  const env = {
    ATRAX_VISIBILITY: "shared",
    DOOR_SESSION_SECRET: secret,
    DB: database([{ id: 1, email: "owner@example.com", joined_at: 1 }]),
  };
  assert.equal(
    await handleDoor(
      new Request("https://app.example/.well-known/atrax.json"),
      env,
    ),
    null,
  );

  const blocked = await handleDoor(new Request("https://app.example/"), env);
  assert.equal(blocked.status, 401);
  const body = await blocked.text();
  assert.match(body, /Invitation required/);
  assert.match(body, /by invitation/);
  assert.doesNotMatch(body, /<input|<form/);

  const expiresAt = Date.now() + 60_000;
  const value = await signSession(secret, 1, expiresAt);
  assert.equal(
    await handleDoor(
      new Request("https://app.example/", {
        headers: { cookie: `${sessionCookieName}=${value}` },
      }),
      env,
    ),
    null,
  );
});

test("stands down during local development", async () => {
  const env = {
    ATRAX_VISIBILITY: "shared",
    ATRAX_LOCAL: "1",
    DB: database([]),
  };
  assert.equal(await handleDoor(new Request("https://app.example/"), env), null);
});

test("redeems an invite once and then reports the member", async () => {
  const token = "invite-token";
  const members = [
    {
      id: 4,
      email: "ana@example.com",
      invite_hash: await sha256Hex(token),
      invite_expires_at: Date.now() + 60_000,
      joined_at: null,
    },
  ];
  const env = {
    ATRAX_VISIBILITY: "shared",
    DOOR_SESSION_SECRET: secret,
    DB: database(members),
  };

  const redeemed = await handleDoor(
    new Request(`https://app.example/.door/join?token=${token}`),
    env,
  );
  assert.equal(redeemed.status, 302);
  assert.equal(redeemed.headers.get("location"), "/");
  const cookie = redeemed.headers.get("set-cookie");
  assert.match(cookie, /^__door_session=/);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(members[0].invite_hash, null);
  assert.ok(members[0].joined_at);

  const value = cookie.slice(cookie.indexOf("=") + 1, cookie.indexOf(";"));
  assert.equal((await verifySession(secret, value)).memberId, 4);

  const replayed = await handleDoor(
    new Request(`https://app.example/.door/join?token=${token}`),
    env,
  );
  assert.equal(replayed.status, 401);

  const whoami = await handleDoor(
    new Request("https://app.example/.door/whoami", {
      headers: { cookie: `${sessionCookieName}=${value}` },
    }),
    env,
  );
  assert.equal(whoami.status, 200);
  assert.deepEqual(await whoami.json(), { member: "ana@example.com" });

  const anonymous = await handleDoor(
    new Request("https://app.example/.door/whoami"),
    env,
  );
  assert.equal(anonymous.status, 401);
});

test("refuses invites before the session secret is provisioned", async () => {
  const env = { ATRAX_VISIBILITY: "shared", DB: database([]) };
  const response = await handleDoor(
    new Request("https://app.example/.door/join?token=anything"),
    env,
  );
  assert.equal(response.status, 401);
  assert.match(await response.text(), /not ready to accept invitations/);
});

test("a removed member's live cookie no longer passes the gate", async () => {
  const members = [{ id: 4, email: "ana@example.com", joined_at: 1 }];
  const env = {
    ATRAX_VISIBILITY: "shared",
    DOOR_SESSION_SECRET: secret,
    DB: database(members),
  };
  const expiresAt = Date.now() + 60_000;
  const value = await signSession(secret, 4, expiresAt);
  const request = () =>
    new Request("https://app.example/dashboard", {
      headers: { cookie: `${sessionCookieName}=${value}` },
    });

  assert.equal(await handleDoor(request(), env), null);

  members.length = 0;
  const denied = await handleDoor(request(), env);
  assert.equal(denied.status, 401);
});
