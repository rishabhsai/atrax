import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Tarantula product site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Tarantula — Software that keeps working/);
  assert.match(html, /The agent-native application platform/);
  assert.match(html, /Software that/);
  assert.match(html, /keeps working\./);
  assert.match(html, /Connect once\. Compose forever\./);
  assert.match(html, /Credentials remain in the Vault/);
  assert.match(html, /\/products\/vault/);
  assert.match(html, /\/products\/network/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Building your site|loading skeleton/i);

  await access(new URL("../public/og.png", import.meta.url));
});

test("server-renders product detail routes", async () => {
  const response = await render("/products/vault");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Vault/);
  assert.match(html, /The company owns access\. Apps borrow capability\./);
  assert.match(html, /Apps receive short-lived authority/);
  assert.match(html, /Store company connections once/);
});
