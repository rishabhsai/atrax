import { OperationError, inputObject, inputString, requireActor } from "./identity-errors.js";

const cookieName = "__Host-atrax_session";
const challengeLifetime = 15 * 60_000;
const sessionLifetime = 30 * 24 * 60 * 60_000;
const encoder = new TextEncoder();

export function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashSecret(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeEmail(value) {
  const email = inputString(value, "email", 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new OperationError("invalid_input", 400, "Enter a valid email address.");
  }
  return email;
}

function sessionView(row) {
  return { id: row.session_id, kind: row.kind, agentLabel: row.agent_label ?? null, expiresAt: row.expires_at };
}

function actorView(row) {
  return { person: { id: row.person_id, email: row.email }, session: sessionView(row) };
}

export async function listPersonWorkspaces(env, personId) {
  const rows = await env.CP_DB.prepare(
    `SELECT w.workspace_id, w.name, w.slug, m.role FROM workspaces w
     JOIN workspace_members m ON m.workspace_id = w.workspace_id
     WHERE m.person_id = ? AND m.status = 'active' ORDER BY w.created_at, w.workspace_id`,
  ).bind(personId).all();
  return rows.results.map((row) => ({ id: row.workspace_id, name: row.name, slug: row.slug, role: row.role }));
}

export function assertBrowserOrigin(request, env) {
  const origin = request.headers.get("origin");
  const allowed = [env.AUTH_ORIGIN, env.CONSOLE_ORIGIN].filter(Boolean);
  if (!origin || !allowed.includes(origin)) throw new OperationError("forbidden", 403, "This browser origin is not allowed.");
}

export async function authenticateRequest(request, env) {
  const authorization = request.headers.get("authorization");
  let token;
  let viaCookie = false;
  if (authorization) {
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
    if (!match) return null;
    token = match[1];
  } else {
    const cookies = (request.headers.get("cookie") ?? "").split(";").map((value) => value.trim()).filter((value) => value.startsWith(`${cookieName}=`));
    if (cookies.length !== 1) return null;
    token = cookies[0].slice(cookieName.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    viaCookie = true;
  }
  const row = await env.CP_DB.prepare(
    `SELECT s.*, p.email FROM sessions s JOIN people p ON p.person_id = s.person_id
     WHERE s.secret_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
       AND s.kind != 'app'
       AND (s.parent_session_id IS NULL OR EXISTS (
         SELECT 1 FROM sessions parent WHERE parent.session_id = s.parent_session_id
           AND parent.revoked_at IS NULL AND parent.expires_at > ?))`,
  ).bind(await hashSecret(token), Date.now(), Date.now()).first();
  if (!row || (viaCookie && row.kind !== "browser")) return null;
  if (viaCookie && !["GET", "HEAD", "OPTIONS"].includes(request.method)) assertBrowserOrigin(request, env);
  return actorView(row);
}

async function rateLimit(env, request, email) {
  const now = Date.now();
  const windowStart = Math.floor(now / challengeLifetime) * challengeLifetime;
  const keys = [
    { key: `email:${await hashSecret(email)}`, limit: 5 },
    { key: `ip:${await hashSecret(request.headers.get("cf-connecting-ip") ?? "unknown")}`, limit: 30 },
  ];
  const results = await env.CP_DB.batch(keys.map(({ key }) => env.CP_DB.prepare(
    `INSERT INTO identity_rate_limits (rate_key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(rate_key) DO UPDATE SET
       count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
       window_start = excluded.window_start RETURNING count`,
  ).bind(key, windowStart)));
  if (results.some((result, index) => result.results[0].count > keys[index].limit)) {
    throw new OperationError("rate_limited", 429, "Too many sign-in requests. Try again later.");
  }
}

async function startEmail(input, { env, request }) {
  inputObject(input, ["email", "returnTo", "purpose"]);
  const email = normalizeEmail(input.email);
  if (input.purpose !== undefined && input.purpose !== "sign_in") throw new OperationError("invalid_input", 400, "Unsupported verification purpose.");
  const returnTo = input.returnTo === undefined ? "/account" : inputString(input.returnTo, "returnTo", 1024);
  if (!returnTo.startsWith("/") || returnTo.startsWith("//") || /[\\\r\n]/.test(returnTo)) throw new OperationError("invalid_input", 400, "returnTo must be a relative console path.");
  if (!env.EMAIL || !env.EMAIL_FROM || !env.CONSOLE_ORIGIN) {
    throw new OperationError("email_unavailable", 503, "Sign-in email is not configured.");
  }
  await rateLimit(env, request, email);
  const now = Date.now();
  const id = crypto.randomUUID();
  const secret = randomSecret();
  await env.CP_DB.prepare(
    `INSERT INTO email_challenges (challenge_id, secret_hash, email, purpose, return_to, expires_at, created_at)
     VALUES (?, ?, ?, 'sign_in', ?, ?, ?)`,
  ).bind(id, await hashSecret(secret), email, returnTo, now + challengeLifetime, now).run();
  const link = new URL("/auth/confirm", env.CONSOLE_ORIGIN);
  link.hash = new URLSearchParams({ challengeId: id, secret }).toString();
  try {
    await env.EMAIL.send({
      to: email,
      from: { email: env.EMAIL_FROM, name: "Atrax" },
      subject: "Sign in to Atrax",
      text: `Sign in to Atrax using this link:\n${link.href}\n\nThis link expires in 15 minutes. If you did not request it, ignore this email.`,
      html: `<p>Sign in to Atrax:</p><p><a href="${link.href.replaceAll("&", "&amp;")}">Continue to Atrax</a></p><p>This link expires in 15 minutes. If you did not request it, ignore this email.</p>`,
    });
  } catch {
    await env.CP_DB.prepare("DELETE FROM email_challenges WHERE challenge_id = ? AND consumed_at IS NULL").bind(id).run();
    throw new OperationError("email_unavailable", 503, "The sign-in email could not be sent. Try again.");
  }
  return { result: { challengeId: id, expiresAt: now + challengeLifetime, delivery: "sent" } };
}

async function verifyEmail(input, { env, request }) {
  inputObject(input, ["challengeId", "secret"]);
  assertBrowserOrigin(request, env);
  const challengeId = inputString(input.challengeId, "challengeId");
  const secret = inputString(input.secret, "secret", 128);
  const now = Date.now();
  const attempt = await env.CP_DB.prepare(
    `UPDATE email_challenges SET attempts = attempts + 1
     WHERE challenge_id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5
     RETURNING challenge_id`,
  ).bind(challengeId, now).first();
  if (!attempt) throw new OperationError("invalid_challenge", 400, "This sign-in link is invalid or expired. Request another email.");
  const secretHash = await hashSecret(secret);
  const sessionId = crypto.randomUUID();
  const sessionSecret = randomSecret();
  const validChallenge = "challenge_id = ? AND secret_hash = ? AND consumed_at IS NULL AND expires_at > ? AND attempts <= 5";
  const results = await env.CP_DB.batch([
    env.CP_DB.prepare(`INSERT INTO people (person_id, email, verified_at, created_at)
      SELECT ?, email, ?, ? FROM email_challenges WHERE ${validChallenge}
      ON CONFLICT(email) DO NOTHING`).bind(crypto.randomUUID(), now, now, challengeId, secretHash, now),
    env.CP_DB.prepare(`INSERT INTO sessions (session_id, secret_hash, person_id, kind, expires_at, created_at)
      SELECT ?, ?, p.person_id, 'browser', ?, ? FROM email_challenges c JOIN people p ON p.email = c.email
      WHERE c.${validChallenge}`).bind(sessionId, await hashSecret(sessionSecret), now + sessionLifetime, now, challengeId, secretHash, now),
    env.CP_DB.prepare(`UPDATE email_challenges SET consumed_at = ? WHERE ${validChallenge}
      AND EXISTS (SELECT 1 FROM sessions WHERE session_id = ?)`)
      .bind(now, challengeId, secretHash, now, sessionId),
    env.CP_DB.prepare("SELECT s.*, p.email, c.return_to FROM sessions s JOIN people p ON p.person_id = s.person_id JOIN email_challenges c ON c.challenge_id = ? WHERE s.session_id = ?")
      .bind(challengeId, sessionId),
  ]);
  const row = results[3].results[0];
  if (!row) throw new OperationError("invalid_challenge", 400, "This sign-in link is invalid or expired. Request another email.");
  return {
    result: { ...actorView(row), workspaces: await listPersonWorkspaces(env, row.person_id), returnTo: row.return_to },
    headers: { "set-cookie": `${cookieName}=${sessionSecret}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${sessionLifetime / 1000}`, "cache-control": "no-store" },
  };
}

async function startDevice(input, { env, request }) {
  inputObject(input, ["clientName", "agentLabel"]);
  const clientName = inputString(input.clientName, "clientName", 80);
  const agentLabel = input.agentLabel === undefined ? null : inputString(input.agentLabel, "agentLabel", 80);
  if (!env.CONSOLE_ORIGIN) throw new OperationError("auth_unavailable", 503, "Sign-in is not configured.");
  await rateLimit(env, request, `device:${request.headers.get("cf-connecting-ip") ?? "unknown"}`);
  const now = Date.now();
  const deviceCode = randomSecret();
  const userCode = randomSecret().slice(0, 12).toUpperCase().match(/.{4}/g).join("-");
  await env.CP_DB.prepare(
    `INSERT INTO device_authorizations
     (device_id, device_hash, user_code, client_name, agent_label, status, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(crypto.randomUUID(), await hashSecret(deviceCode), userCode, clientName, agentLabel, now + challengeLifetime, now).run();
  const verificationUri = new URL("/auth/device", env.CONSOLE_ORIGIN);
  verificationUri.searchParams.set("code", userCode);
  return { result: { deviceCode, userCode, verificationUri: verificationUri.href, expiresAt: now + challengeLifetime, intervalMs: 2000 }, headers: { "cache-control": "no-store" } };
}

function readUserCode(value) {
  const code = inputString(value, "userCode", 14).toUpperCase();
  if (!/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(code)) throw new OperationError("invalid_input", 400, "Enter the code shown by your CLI.");
  return code;
}

async function deviceDetails(input, { env, actor }) {
  inputObject(input, ["userCode"]);
  requireActor(actor);
  const row = await env.CP_DB.prepare("SELECT client_name, agent_label, expires_at, status FROM device_authorizations WHERE user_code = ?")
    .bind(readUserCode(input.userCode)).first();
  if (!row) throw new OperationError("not_found", 404, "This device code was not found.");
  return { result: { clientName: row.client_name, agentLabel: row.agent_label, expiresAt: row.expires_at, status: row.expires_at <= Date.now() ? "expired" : row.status } };
}

async function approveDevice(input, { env, request, actor }) {
  inputObject(input, ["userCode", "decision"]);
  requireActor(actor);
  if (actor.session.kind !== "browser") throw new OperationError("forbidden", 403, "Approve device access in your browser.");
  assertBrowserOrigin(request, env);
  const userCode = readUserCode(input.userCode);
  const decision = input.decision ?? "approve";
  if (!["approve", "deny"].includes(decision)) throw new OperationError("invalid_input", 400, "decision must be approve or deny.");
  const status = decision === "approve" ? "approved" : "denied";
  const row = await env.CP_DB.prepare(
    `UPDATE device_authorizations SET status = ?, person_id = ?, approving_session_id = ?
     WHERE user_code = ? AND expires_at > ? AND
       (status = 'pending' OR (status = ? AND person_id = ?)) RETURNING status`,
  ).bind(status, actor.person.id, actor.session.id, userCode, Date.now(), status, actor.person.id).first();
  if (!row) throw new OperationError("invalid_device_code", 400, "This device code is expired or already decided.");
  return { result: { status: row.status } };
}

async function pollDevice(input, { env }) {
  inputObject(input, ["deviceCode"]);
  const deviceCode = inputString(input.deviceCode, "deviceCode", 128);
  const deviceHash = await hashSecret(deviceCode);
  const row = await env.CP_DB.prepare("SELECT status, expires_at FROM device_authorizations WHERE device_hash = ?").bind(deviceHash).first();
  if (!row) throw new OperationError("invalid_device_code", 400, "This device request was not found.");
  if (row.expires_at <= Date.now()) return { result: { status: "expired" } };
  if (row.status === "pending" || row.status === "denied") return { result: { status: row.status } };
  if (row.status === "consumed") throw new OperationError("authorization_consumed", 409, "This device authorization was already used. Start sign-in again if the response was lost.");
  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const accessToken = randomSecret();
  const results = await env.CP_DB.batch([
    env.CP_DB.prepare(`INSERT INTO sessions (session_id, secret_hash, person_id, kind, agent_label, expires_at, created_at)
      SELECT ?, ?, d.person_id, CASE WHEN d.agent_label IS NULL THEN 'cli' ELSE 'agent' END, d.agent_label, ?, ?
      FROM device_authorizations d JOIN sessions s ON s.session_id = d.approving_session_id
      WHERE d.device_hash = ? AND d.status = 'approved' AND d.expires_at > ?
        AND s.revoked_at IS NULL AND s.expires_at > ?`)
      .bind(sessionId, await hashSecret(accessToken), now + sessionLifetime, now, deviceHash, now, now),
    env.CP_DB.prepare(`UPDATE device_authorizations SET status = 'consumed', consumed_at = ?
      WHERE device_hash = ? AND status = 'approved' AND EXISTS (SELECT 1 FROM sessions WHERE session_id = ?)`)
      .bind(now, deviceHash, sessionId),
    env.CP_DB.prepare("SELECT s.*, p.email FROM sessions s JOIN people p ON p.person_id = s.person_id WHERE s.session_id = ?").bind(sessionId),
  ]);
  const session = results[2].results[0];
  if (!session) throw new OperationError("authorization_consumed", 409, "This authorization was used or revoked. Start sign-in again.");
  return { result: { status: "authorized", accessToken, ...actorView(session), workspaces: await listPersonWorkspaces(env, session.person_id) }, headers: { "cache-control": "no-store" } };
}

async function listSessions(input, { env, actor }) {
  inputObject(input, []);
  requireActor(actor);
  const rows = await env.CP_DB.prepare("SELECT session_id, kind, agent_label, expires_at, created_at FROM sessions WHERE person_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC")
    .bind(actor.person.id, Date.now()).all();
  return { result: { sessions: rows.results.map((row) => ({ ...sessionView(row), createdAt: row.created_at, current: row.session_id === actor.session.id })) } };
}

async function revokeSession(input, { env, actor }) {
  inputObject(input, ["sessionId"]);
  requireActor(actor);
  const sessionId = inputString(input.sessionId, "sessionId");
  const row = await env.CP_DB.prepare("UPDATE sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE session_id = ? AND person_id = ? RETURNING session_id")
    .bind(Date.now(), sessionId, actor.person.id).first();
  if (!row) throw new OperationError("not_found", 404, "This session was not found.");
  return {
    result: { sessionId, revoked: true },
    ...(sessionId === actor.session.id ? { headers: { "set-cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } } : {}),
  };
}

export async function handleIdentityOperation(name, input, context) {
  if (name === "auth.email.start") return startEmail(input, context);
  if (name === "auth.email.verify") return verifyEmail(input, context);
  if (name === "auth.device.start") return startDevice(input, context);
  if (name === "auth.device.get") return deviceDetails(input, context);
  if (name === "auth.device.approve") return approveDevice(input, context);
  if (name === "auth.device.poll") return pollDevice(input, context);
  if (name === "auth.sessions.list") return listSessions(input, context);
  if (name === "auth.session.revoke") return revokeSession(input, context);
  if (name === "auth.session.get") {
    inputObject(input, []);
    const actor = requireActor(context.actor);
    return { result: { ...actor, workspaces: await listPersonWorkspaces(context.env, actor.person.id) } };
  }
  return null;
}
