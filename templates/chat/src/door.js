// Door v0 (alpha slice): shared visibility gate.
//
// This module is dependency-free and uses only WebCrypto plus the D1 binding.
// It is inert unless the app contract sets "visibility": "shared", which
// Tarantula compiles into the TARANTULA_VISIBILITY var. Public apps behave
// exactly as they did before this file existed.

export const sessionCookieName = "__door_session";
export const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;

const textEncoder = new TextEncoder();
const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalStrings(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
}

export async function signSession(secret, memberId, expiresAt) {
  if (!secret) throw new Error("Door session secret is missing.");
  const payload = `${memberId}.${expiresAt}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${base64Url(new Uint8Array(signature))}`;
}

export async function verifySession(secret, value, now = Date.now()) {
  if (!secret || typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [memberId, expiresAt] = parts;
  if (!/^\d{1,15}$/.test(memberId) || !/^\d{1,15}$/.test(expiresAt)) return null;
  const expected = await signSession(secret, memberId, expiresAt);
  if (!equalStrings(expected, value)) return null;
  if (Number(expiresAt) <= now) return null;
  return { memberId: Number(memberId), expiresAt: Number(expiresAt) };
}

export function readCookie(header, name) {
  if (typeof header !== "string" || !header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return null;
}

export function sessionCookie(value, expiresAt, now = Date.now()) {
  const maxAge = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return `${sessionCookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers ?? {}) },
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function signInPage(detail = "Access to this app is by invitation.") {
  const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#12100e" />
    <title>Invitation required</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: oklch(0.145 0.012 48);
        --ink: oklch(0.94 0.012 76);
        --muted: oklch(0.69 0.018 65);
        --line: oklch(0.35 0.024 50);
        --orange: oklch(0.72 0.19 47);
        font-family: "Lucida Console", Monaco, monospace;
      }
      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        background:
          linear-gradient(var(--line) 1px, transparent 1px),
          linear-gradient(90deg, var(--line) 1px, transparent 1px),
          var(--bg);
        background-size: 48px 48px;
        color: var(--ink);
      }
      main {
        width: min(440px, calc(100% - 32px));
        padding: 32px;
        border: 1px solid var(--line);
        background: color-mix(in oklch, var(--bg) 92%, transparent);
      }
      span {
        color: var(--muted);
        font-size: 12px;
      }
      h1 {
        margin: 8px 0 20px;
        font-family: "Arial Black", Arial, sans-serif;
        font-size: 34px;
        letter-spacing: -0.05em;
        line-height: 1;
      }
      p {
        margin: 0 0 12px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }
      p:last-child {
        margin-bottom: 0;
      }
      i {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 7px;
        border-radius: 50%;
        background: var(--orange);
      }
    </style>
  </head>
  <body>
    <main>
      <span><i></i> Shared app</span>
      <h1>Invitation required</h1>
      <p>${escapeHtml(detail)}</p>
      <p>The owner of this app can send you a link that lets you in.</p>
    </main>
  </body>
</html>
`;
  return new Response(body, {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function currentSession(request, secret) {
  const value = readCookie(request.headers.get("cookie"), sessionCookieName);
  if (!value) return null;
  return verifySession(secret, value);
}

async function redeemInvite(request, env, url, secret) {
  const token = url.searchParams.get("token") ?? "";
  if (!token) return signInPage("This invite link is missing its token.");
  const now = Date.now();
  const member = await env.DB.prepare(
    `SELECT id FROM door_members
     WHERE invite_hash = ? AND invite_expires_at > ?`,
  )
    .bind(await sha256Hex(token), now)
    .first();
  if (!member) {
    return signInPage("This invite link has already been used or has expired.");
  }
  await env.DB.prepare(
    `UPDATE door_members
     SET joined_at = COALESCE(joined_at, ?), invite_hash = NULL, invite_expires_at = NULL
     WHERE id = ?`,
  )
    .bind(now, member.id)
    .run();
  const expiresAt = now + sessionTtlMs;
  return new Response(null, {
    status: 302,
    headers: {
      location: "/",
      "cache-control": "no-store",
      "set-cookie": sessionCookie(
        await signSession(secret, member.id, expiresAt),
        expiresAt,
        now,
      ),
    },
  });
}

async function whoami(request, env, secret) {
  const session = await currentSession(request, secret);
  if (!session) return json({ error: "Not signed in." }, { status: 401 });
  const member = await env.DB.prepare(
    `SELECT email FROM door_members WHERE id = ?`,
  )
    .bind(session.memberId)
    .first();
  if (!member) return json({ error: "Not signed in." }, { status: 401 });
  return json({ member: member.email });
}

// Returns a Response when Door handles the request, or null to let the app run.
export async function handleDoor(request, env) {
  if (env?.TARANTULA_VISIBILITY !== "shared") return null;
  // tarantula dev sets TARANTULA_LOCAL. A local run has no member table worth
  // gating and no session secret, so the gate stands down. Deploy never sets it.
  if (env.TARANTULA_LOCAL === "1") return null;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/.well-known/")) return null;
  const secret = env.DOOR_SESSION_SECRET ?? "";

  if (url.pathname === "/.door/join") {
    if (!secret) {
      return signInPage("This app is not ready to accept invitations yet.");
    }
    return redeemInvite(request, env, url, secret);
  }
  if (url.pathname === "/.door/whoami") return whoami(request, env, secret);
  if (url.pathname.startsWith("/.door/")) {
    return json({ error: "Not found." }, { status: 404 });
  }

  const session = await currentSession(request, secret);
  if (session) {
    // A signed cookie alone is not membership: someone removed with
    // `tarantula share remove` must lose access before the cookie expires.
    const member = await env.DB.prepare(
      `SELECT id FROM door_members WHERE id = ?`,
    )
      .bind(session.memberId)
      .first();
    if (member) return null;
  }
  return signInPage();
}
