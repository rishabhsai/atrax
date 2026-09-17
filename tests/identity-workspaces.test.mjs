import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Miniflare } from "miniflare";

const root = resolve(import.meta.dirname, "..");
const origin = "https://api.atrax.test";
const fixture = `
import { authenticateRequest, handleIdentityOperation } from './control-plane/src/identity.js';
import { handleWorkspaceOperation } from './control-plane/src/workspaces.js';
export default {
  async fetch(request, env) {
    try {
      const name = new URL(request.url).pathname.split('/').pop();
      const input = request.method === 'POST' ? await request.json() : {};
      const actor = await authenticateRequest(request, env);
      const context = { env, request, actor, idempotencyKey:request.headers.get('idempotency-key') };
      const outcome = await handleIdentityOperation(name, input, context)
        ?? await handleWorkspaceOperation(name, input, context);
      if (!outcome) return Response.json({error:{code:'not_found'}}, {status:404});
      return Response.json(outcome.result, {headers:outcome.headers});
    } catch (error) {
      return Response.json({error:{code:error.code ?? 'internal',message:error.message}}, {status:error.status ?? 500});
    }
  }
};`;
const mailbox = `
import { WorkerEntrypoint } from 'cloudflare:workers';
const messages = [];
export class Mail extends WorkerEntrypoint {
  async send(message) { messages.push(message); return {messageId:String(messages.length)}; }
}
export default { fetch() { return Response.json(messages); } };`;

async function start(t) {
  const source = await readFile(resolve(root, "control-plane/src/identity.js"), "utf8");
  const errors = await readFile(resolve(root, "control-plane/src/identity-errors.js"), "utf8");
  const workspaces = await readFile(resolve(root, "control-plane/src/workspaces.js"), "utf8");
  const mf = new Miniflare({
    workers: [
      { config: {
        type: "worker",
        name: "identity-test",
        compatibilityDate: "2026-07-29",
        manifest: { mainModule: "fixture.js", modulesRoot: root, modules: {
          "fixture.js": { type: "esm", contents: fixture },
          "control-plane/src/identity.js": { type: "esm", contents: source },
          "control-plane/src/identity-errors.js": { type: "esm", contents: errors },
          "control-plane/src/workspaces.js": { type: "esm", contents: workspaces },
        } },
        env: {
          CP_DB: { type: "d1", id: "identity-test-db" },
          AUTH_ORIGIN: { type: "json", value: origin },
          CONSOLE_ORIGIN: { type: "json", value: "https://atrax.test" },
          EMAIL_FROM: { type: "json", value: "sign-in@atrax.test" },
          EMAIL: { type: "worker", worker: "mailbox", exportName: "Mail" },
        },
      } },
      { config: { type: "worker", name: "mailbox", compatibilityDate: "2026-07-29",
        manifest: { mainModule: "mailbox.js", modules: { "mailbox.js": { type: "esm", contents: mailbox } } },
      } },
    ],
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("CP_DB", "identity-test");
  // This schema contains only standalone DDL, without triggers or semicolons in literals.
  const migration = await readFile(resolve(root, "control-plane/migrations/0004_identity_workspaces.sql"), "utf8");
  await db.batch(migration.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
  async function call(name, input = {}, credential, extraHeaders = {}) {
    const response = await mf.dispatchFetch(`${origin}/v1/operations/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://atrax.test", "idempotency-key": crypto.randomUUID(), ...(credential ? credential.startsWith("Bearer ") ? { authorization: credential } : { cookie: credential } : {}), ...extraHeaders },
      body: JSON.stringify(input),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
  }
  async function inbox() { return (await (await mf.getWorker("mailbox")).fetch("https://mailbox.test")).json(); }
  async function signIn(email) {
    const sent = await call("auth.email.start", { email });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const messages = await inbox();
    const link = new URL(messages.at(-1).text.match(/https:\/\/\S+/)[0]);
    const payload = new URLSearchParams(link.hash.slice(1));
    return call("auth.email.verify", { challengeId: payload.get("challengeId"), secret: payload.get("secret") });
  }
  return { call, inbox, signIn, mf, db };
}

test("verified email signs in and recovers the same person on another device", async (t) => {
  const api = await start(t);
  const first = await api.signIn("Owner@Example.com");
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.person.email, "owner@example.com");
  assert.match(first.cookie, /^__Host-atrax_session=/);
  assert.match(first.cookie, /HttpOnly/);
  assert.match(first.cookie, /Secure/);
  assert.match(first.cookie, /SameSite=Lax/);
  assert.doesNotMatch(first.cookie, /Domain=/);
  const current = await api.call("auth.session.get", {}, first.cookie.split(";")[0]);
  assert.equal(current.body.person.id, first.body.person.id);
  const recovered = await api.signIn("owner@example.com");
  assert.equal(recovered.body.person.id, first.body.person.id);
  assert.notEqual(recovered.body.session.id, first.body.session.id);
});

test("a workspace belongs to its verified team and survives login recovery and member removal", async (t) => {
  const api = await start(t);
  const owner = await api.signIn("owner@example.com");
  const ownerCookie = owner.cookie.split(";")[0];
  const createInput = { name: "Paper Company", slug: "paper-company" };
  const created = await api.call("workspaces.create", createInput, ownerCookie, { "idempotency-key": "company-start" });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.membership.role, "owner");
  const workspaceId = created.body.workspace.id;
  const repeated = await api.call("workspaces.create", createInput, ownerCookie, { "idempotency-key": "company-start" });
  assert.equal(repeated.body.workspace.id, workspaceId);
  assert.equal((await api.call("workspaces.create", { ...createInput, name: "Changed" }, ownerCookie, { "idempotency-key": "company-start" })).body.error.code, "idempotency_conflict");
  const member = await api.signIn("employee@example.com");
  const memberCookie = member.cookie.split(";")[0];
  assert.equal((await api.call("workspaces.get", { workspaceId }, memberCookie)).status, 403);
  const inviteInput = { workspaceId, email: "employee@example.com", role: "member" };
  const invite = await api.call("members.invite", inviteInput, ownerCookie, { "idempotency-key": "invite-employee" });
  assert.equal(invite.status, 200, JSON.stringify(invite.body));
  const repeatedInvite = await api.call("members.invite", inviteInput, ownerCookie, { "idempotency-key": "invite-employee" });
  assert.equal(repeatedInvite.body.invitation.id, invite.body.invitation.id);
  assert.equal((await api.call("members.accept", { invitationId: invite.body.invitation.id }, ownerCookie)).body.error.code, "invitation_email_mismatch");
  const accepted = await api.call("members.accept", { invitationId: invite.body.invitation.id }, memberCookie);
  assert.equal(accepted.body.membership.role, "member", JSON.stringify(accepted.body));
  assert.equal((await api.call("members.list", { workspaceId }, memberCookie)).body.members.length, 2);
  assert.equal((await api.call("members.invite", { workspaceId, email: "outsider@example.com", role: "admin" }, memberCookie)).status, 403);
  const recovered = await api.signIn("employee@example.com");
  assert.equal(recovered.body.workspaces[0].id, workspaceId);
  assert.equal((await api.call("workspaces.list", {}, recovered.cookie.split(";")[0])).body.workspaces[0].id, workspaceId);
  const removed = await api.call("members.remove", { workspaceId, personId: member.body.person.id }, ownerCookie);
  assert.equal(removed.status, 200, JSON.stringify(removed.body));
  assert.equal((await api.call("workspaces.get", { workspaceId }, memberCookie)).status, 403);
  assert.equal((await api.call("workspaces.get", { workspaceId }, recovered.cookie.split(";")[0])).status, 403);
  assert.equal((await api.call("members.accept", { invitationId: invite.body.invitation.id }, memberCookie)).status, 403);
  assert.equal((await api.call("workspaces.get", { workspaceId }, ownerCookie)).status, 200);
});

test("device login waits for browser approval and creates a revocable named agent session", async (t) => {
  const api = await start(t);
  const person = await api.signIn("owner@example.com");
  const cookie = person.cookie.split(";")[0];
  const device = await api.call("auth.device.start", { clientName: "Atrax CLI", agentLabel: "Office assistant" });
  assert.equal(device.status, 200, JSON.stringify(device.body));
  assert.equal((await api.call("auth.device.poll", { deviceCode: device.body.deviceCode })).body.status, "pending");
  assert.equal((await api.call("auth.device.approve", { userCode: device.body.userCode })).status, 401);
  const details = await api.call("auth.device.get", { userCode: device.body.userCode }, cookie);
  assert.equal(details.body.clientName, "Atrax CLI");
  assert.equal(details.body.agentLabel, "Office assistant");
  assert.equal((await api.call("auth.device.approve", { userCode: device.body.userCode }, cookie)).body.status, "approved");
  const authorized = await api.call("auth.device.poll", { deviceCode: device.body.deviceCode });
  assert.equal(authorized.body.status, "authorized", JSON.stringify(authorized.body));
  const bearer = `Bearer ${authorized.body.accessToken}`;
  const current = await api.call("auth.session.get", {}, bearer);
  assert.equal(current.body.person.id, person.body.person.id);
  assert.equal(current.body.session.kind, "agent");
  assert.equal(current.body.session.agentLabel, "Office assistant");
  const listed = await api.call("auth.sessions.list", {}, cookie);
  assert.equal(listed.body.sessions.length, 2);
  assert.ok(listed.body.sessions.every((session) => !session.accessToken && !session.secretHash));
  await api.call("auth.session.revoke", { sessionId: authorized.body.session.id }, cookie);
  assert.equal((await api.call("auth.session.get", {}, bearer)).status, 401);
  const repeated = await api.call("auth.device.poll", { deviceCode: device.body.deviceCode });
  assert.equal(repeated.body.error.code, "authorization_consumed");
});

test("only the owner can transfer ownership and the workspace always retains an owner", async (t) => {
  const api = await start(t);
  const owner = await api.signIn("owner@example.com");
  const ownerCookie = owner.cookie.split(";")[0];
  const created = await api.call("workspaces.create", { name: "Paper", slug: "paper-team" }, ownerCookie);
  const workspaceId = created.body.workspace.id;
  const teammate = await api.signIn("teammate@example.com");
  const teammateCookie = teammate.cookie.split(";")[0];
  const invitation = await api.call("members.invite", { workspaceId, email: "teammate@example.com", role: "member" }, ownerCookie);
  await api.call("members.accept", { invitationId: invitation.body.invitation.id }, teammateCookie);
  const promoted = await api.call("members.setRole", { workspaceId, personId: teammate.body.person.id, role: "admin" }, ownerCookie);
  assert.equal(promoted.status, 200, JSON.stringify(promoted.body));
  assert.equal((await api.call("workspaces.transferOwnership", { workspaceId, personId: owner.body.person.id }, teammateCookie)).status, 403);
  assert.equal((await api.call("members.setRole", { workspaceId, personId: owner.body.person.id, role: "member" }, teammateCookie)).body.error.code, "last_owner");
  assert.equal((await api.call("members.remove", { workspaceId, personId: owner.body.person.id }, ownerCookie)).body.error.code, "last_owner");
  const transferInput = { workspaceId, personId: teammate.body.person.id };
  assert.equal((await api.call("workspace.transferOwnership", transferInput, ownerCookie)).body.error.code, "not_found");
  const transfer = await api.call("workspaces.transferOwnership", transferInput, ownerCookie, { "idempotency-key": "transfer-owner" });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.body));
  const members = (await api.call("members.list", { workspaceId }, teammateCookie)).body.members;
  assert.deepEqual(members.filter((member) => member.role === "owner").map((member) => member.personId), [teammate.body.person.id]);
  assert.equal(members.find((member) => member.personId === owner.body.person.id).role, "admin");
});

test("one email proof creates at most one session under concurrent verification", async (t) => {
  const api = await start(t);
  const started = await api.call("auth.email.start", { email: "owner@example.com" });
  assert.equal(started.status, 200);
  assert.equal(started.body.secret, undefined);
  const message = (await api.inbox())[0];
  const link = new URL(message.text.match(/https:\/\/\S+/)[0]);
  assert.equal(link.pathname, "/auth/confirm");
  assert.equal(link.search, "");
  const params = new URLSearchParams(link.hash.slice(1));
  const input = { challengeId: params.get("challengeId"), secret: params.get("secret") };
  const outcomes = await Promise.all([api.call("auth.email.verify", input), api.call("auth.email.verify", input)]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [200, 400]);
  const winner = outcomes.find((outcome) => outcome.status === 200);
  assert.equal((await api.call("auth.sessions.list", {}, winner.cookie.split(";")[0])).body.sessions.length, 1);
});

test("sign-in proofs enforce attempts and expiry, and return destinations stay on the console", async (t) => {
  const api = await start(t);
  assert.equal((await api.call("auth.email.start", { email: "owner@example.com", returnTo: "//attacker.example" })).status, 400);
  const started = await api.call("auth.email.start", { email: "owner@example.com" });
  const link = new URL((await api.inbox())[0].text.match(/https:\/\/\S+/)[0]);
  const params = new URLSearchParams(link.hash.slice(1));
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal((await api.call("auth.email.verify", { challengeId: started.body.challengeId, secret: "incorrect" })).body.error.code, "invalid_challenge");
  }
  assert.equal((await api.call("auth.email.verify", { challengeId: started.body.challengeId, secret: params.get("secret") })).status, 400);
  const signedIn = await api.signIn("different@example.com");
  // Set an expired-session fixture; all behavior assertions still use the public HTTP operation.
  await api.db.prepare("UPDATE sessions SET expires_at = 1 WHERE session_id = ?").bind(signedIn.body.session.id).run();
  assert.equal((await api.call("auth.session.get", {}, signedIn.cookie.split(";")[0])).status, 401);
});

test("cookie mutations reject foreign origins and people cannot revoke another person's session", async (t) => {
  const api = await start(t);
  const owner = await api.signIn("owner@example.com");
  const outsider = await api.signIn("outsider@example.com");
  const cookie = owner.cookie.split(";")[0];
  assert.equal((await api.call("workspaces.create", { name: "Paper", slug: "paper" }, cookie, { origin: "https://attacker.example" })).status, 403);
  assert.equal((await api.call("auth.session.revoke", { sessionId: outsider.body.session.id }, cookie)).status, 404);
  assert.equal((await api.call("auth.session.get", {}, outsider.cookie.split(";")[0])).status, 200);
  const revoked = await api.call("auth.session.revoke", { sessionId: owner.body.session.id }, cookie);
  assert.match(revoked.cookie, /Max-Age=0/);
  assert.equal((await api.call("auth.session.get", {}, cookie)).status, 401);
});

test("concurrent device polls issue one session and denial never issues a token", async (t) => {
  const api = await start(t);
  const signedIn = await api.signIn("owner@example.com");
  const cookie = signedIn.cookie.split(";")[0];
  const device = (await api.call("auth.device.start", { clientName: "Atrax CLI" })).body;
  await api.call("auth.device.approve", { userCode: device.userCode }, cookie);
  const outcomes = await Promise.all([api.call("auth.device.poll", { deviceCode: device.deviceCode }), api.call("auth.device.poll", { deviceCode: device.deviceCode })]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [200, 409]);
  assert.equal((await api.call("auth.sessions.list", {}, cookie)).body.sessions.length, 2);
  const denied = (await api.call("auth.device.start", { clientName: "Unrecognized agent" })).body;
  await api.call("auth.device.approve", { userCode: denied.userCode, decision: "deny" }, cookie);
  const polled = await api.call("auth.device.poll", { deviceCode: denied.deviceCode });
  assert.equal(polled.body.status, "denied");
  assert.equal(polled.body.accessToken, undefined);
});

test("concurrent workspace retries create one company and a removed employee needs a new invitation", async (t) => {
  const api = await start(t);
  const owner = await api.signIn("owner@example.com");
  const cookie = owner.cookie.split(";")[0];
  const input = { name: "Paper", slug: "paper" };
  const outcomes = await Promise.all([
    api.call("workspaces.create", input, cookie, { "idempotency-key": "same-company" }),
    api.call("workspaces.create", input, cookie, { "idempotency-key": "same-company" }),
  ]);
  assert.ok(outcomes.every((outcome) => outcome.status === 200), JSON.stringify(outcomes));
  assert.equal(outcomes[0].body.workspace.id, outcomes[1].body.workspace.id);
  assert.equal((await api.call("workspaces.list", {}, cookie)).body.workspaces.length, 1);
  const workspaceId = outcomes[0].body.workspace.id;
  const employee = await api.signIn("employee@example.com");
  const employeeCookie = employee.cookie.split(";")[0];
  const invite = (await api.call("members.invite", { workspaceId, email: "employee@example.com" }, cookie)).body.invitation;
  await api.call("members.accept", { invitationId: invite.id }, employeeCookie);
  await api.call("members.remove", { workspaceId, personId: employee.body.person.id }, cookie);
  const recovered = await api.signIn("employee@example.com");
  assert.deepEqual(recovered.body.workspaces, []);
  const newInvite = (await api.call("members.invite", { workspaceId, email: "employee@example.com" }, cookie)).body.invitation;
  assert.notEqual(newInvite.id, invite.id);
  const rejoined = await api.call("members.accept", { invitationId: newInvite.id }, recovered.cookie.split(";")[0]);
  assert.equal(rejoined.body.workspace.id, workspaceId);
});
