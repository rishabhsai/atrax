import { handleDoor } from "./door.js";
import { validateMessage } from "./validation.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const maxBodyBytes = 4096;
const messagesPerMinute = 12;
const retainedMessages = 500;

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { ...jsonHeaders, ...(init.headers ?? {}) },
  });
}

async function listMessages(request, env) {
  const url = new URL(request.url);
  const afterValue = Number(url.searchParams.get("after") ?? "0");
  const after = Number.isSafeInteger(afterValue) && afterValue >= 0 ? afterValue : 0;
  const result = await env.DB.prepare(
    `SELECT id, nickname, body, created_at AS createdAt
     FROM messages
     WHERE id > ?
     ORDER BY id ASC
     LIMIT 100`,
  )
    .bind(after)
    .all();
  return json({ messages: result.results ?? [] });
}

async function postMessage(request, env) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json(
      { error: "Expected content-type application/json." },
      { status: 415 },
    );
  }

  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredSize) && declaredSize > maxBodyBytes) {
    return json({ error: "Request body is too large." }, { status: 413 });
  }

  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > maxBodyBytes) {
    return json({ error: "Request body is too large." }, { status: 413 });
  }

  let input;
  try {
    input = JSON.parse(source);
  } catch {
    return json({ error: "Expected a JSON request body." }, { status: 400 });
  }
  const checked = validateMessage(input);
  if (!checked.ok) {
    return json({ error: checked.error }, { status: 400 });
  }

  const now = Date.now();
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const address = request.headers.get("CF-Connecting-IP") ?? "local";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(address),
  );
  const key = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const rate = await env.DB.prepare(
    `INSERT INTO message_rate_limits (key, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(`${windowStart}:${key}`, windowStart)
    .first();
  if (Number(rate.count) > messagesPerMinute) {
    return json(
      { error: "Too many messages. Try again in a minute." },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  const createdAt = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO messages (nickname, body, created_at)
     VALUES (?, ?, ?)
     RETURNING id`,
  )
    .bind(checked.value.nickname, checked.value.body, createdAt)
    .first();
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM messages
       WHERE id NOT IN (
         SELECT id FROM messages ORDER BY id DESC LIMIT ?
       )`,
    ).bind(retainedMessages),
    env.DB.prepare(
      `DELETE FROM message_rate_limits
       WHERE window_start < ?`,
    ).bind(now - 10 * 60_000),
  ]);
  return json(
    {
      message: {
        id: result.id,
        ...checked.value,
        createdAt,
      },
    },
    { status: 201 },
  );
}

const worker = {
  async fetch(request, env) {
    const gate = await handleDoor(request, env);
    if (gate) return gate;
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/atrax.json") {
      return json({
        schemaVersion: 1,
        name: env.ATRAX_APP_NAME,
        visibility: env.ATRAX_VISIBILITY,
        products: {
          launchpad: "available",
          tables: "available",
          door: "planned",
          library: "planned",
          switchboard: "planned",
          loops: "planned",
        },
      });
    }
    if (url.pathname === "/api/messages") {
      if (request.method === "GET") return listMessages(request, env);
      if (request.method === "POST") return postMessage(request, env);
      return json({ error: "Method not allowed." }, { status: 405 });
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found." }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
