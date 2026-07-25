import assert from "node:assert/strict";
import test from "node:test";
import worker from "../templates/chat/src/worker.js";

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes("INSERT INTO message_rate_limits")) {
      const [key, windowStart] = this.values;
      const current = this.database.rates.get(key) ?? 0;
      const count = current + 1;
      this.database.rates.set(key, count);
      this.database.windows.set(key, windowStart);
      return { count };
    }
    if (this.sql.includes("INSERT INTO messages")) {
      const [nickname, body, createdAt] = this.values;
      const id = ++this.database.lastId;
      this.database.messages.push({ id, nickname, body, createdAt });
      return { id };
    }
    throw new Error(`Unsupported first(): ${this.sql}`);
  }
}

class FakeDatabase {
  constructor() {
    this.lastId = 0;
    this.messages = [];
    this.rates = new Map();
    this.windows = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async batch(statements) {
    for (const statement of statements) {
      if (statement.sql.includes("DELETE FROM messages")) {
        const [limit] = statement.values;
        this.messages = this.messages.slice(-limit);
      }
      if (statement.sql.includes("DELETE FROM message_rate_limits")) {
        const [cutoff] = statement.values;
        for (const [key, windowStart] of this.windows) {
          if (windowStart < cutoff) {
            this.windows.delete(key);
            this.rates.delete(key);
          }
        }
      }
    }
  }
}

function post(body, headers = {}) {
  return new Request("https://chat.example/api/messages", {
    method: "POST",
    headers,
    body,
  });
}

test("public chat rejects unsupported and oversized request bodies", async () => {
  const env = { DB: new FakeDatabase() };
  const unsupported = await worker.fetch(post("hello"), env);
  assert.equal(unsupported.status, 415);

  const oversized = await worker.fetch(
    post(JSON.stringify({ nickname: "Ada", body: "x".repeat(5000) }), {
      "content-type": "application/json",
    }),
    env,
  );
  assert.equal(oversized.status, 413);
  assert.equal(env.DB.messages.length, 0);
});

test("public chat rate limits clients and retains only 500 messages", async () => {
  const database = new FakeDatabase();
  const env = { DB: database };
  for (let index = 0; index < 12; index += 1) {
    const response = await worker.fetch(
      post(JSON.stringify({ nickname: "Ada", body: `message ${index}` }), {
        "content-type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      }),
      env,
    );
    assert.equal(response.status, 201);
  }

  const limited = await worker.fetch(
    post(JSON.stringify({ nickname: "Ada", body: "one too many" }), {
      "content-type": "application/json",
      "CF-Connecting-IP": "203.0.113.10",
    }),
    env,
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");

  database.messages = Array.from({ length: 500 }, (_, index) => ({
    id: index + 100,
  }));
  database.lastId = 599;
  const retained = await worker.fetch(
    post(JSON.stringify({ nickname: "Lin", body: "newest" }), {
      "content-type": "application/json",
      "CF-Connecting-IP": "203.0.113.11",
    }),
    env,
  );
  assert.equal(retained.status, 201);
  assert.equal(database.messages.length, 500);
  assert.equal(database.messages.at(-1).body, "newest");
});
