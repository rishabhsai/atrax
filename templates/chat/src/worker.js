import { validateMessage } from "./validation.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

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
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Expected a JSON request body." }, { status: 400 });
  }
  const checked = validateMessage(input);
  if (!checked.ok) {
    return json({ error: checked.error }, { status: 400 });
  }
  const createdAt = Date.now();
  const result = await env.DB.prepare(
    `INSERT INTO messages (nickname, body, created_at)
     VALUES (?, ?, ?)
     RETURNING id`,
  )
    .bind(checked.value.nickname, checked.value.body, createdAt)
    .first();
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
    const url = new URL(request.url);
    if (url.pathname === "/.well-known/tarantula.json") {
      return json({
        schemaVersion: 1,
        name: env.TARANTULA_APP_NAME,
        visibility: env.TARANTULA_VISIBILITY,
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
