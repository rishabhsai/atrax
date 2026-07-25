import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function readExportedPage(pathname = "/") {
  const relativePath =
    pathname === "/" ? "../out/index.html" : `../out${pathname}/index.html`;
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("exports the Tarantula product site", async () => {
  const html = await readExportedPage();
  assert.match(html, /<title>Tarantula — A cloud for small software/);
  assert.match(html, /Built for five users, not five million\./);
  assert.match(html, /The whole small cloud/);
  assert.match(html, /Run agents for minutes, hours, or every Monday\./);
  assert.match(html, /Small software should share like a Google Doc\./);
  assert.match(html, /\/products\/agent-runtime/);
  assert.match(html, /\/products\/database/);
  assert.match(html, /\/products\/auth/);
  assert.match(html, /\/products\/workers/);
  assert.match(html, /\/products\/secrets/);
  assert.doesNotMatch(html, /\/products\/vault|\/products\/network/);
  assert.match(html, /opengraph-image/);
  assert.doesNotMatch(html, /codex-preview|Building your site|loading skeleton/i);
  await access(new URL("../out/opengraph-image", import.meta.url));
});

test("exports product detail routes", async () => {
  const agentHtml = await readExportedPage("/products/agent-runtime");
  assert.match(agentHtml, /Run agents that keep working after the request ends\./);
  assert.match(agentHtml, /on: schedule/);
  assert.match(agentHtml, /approve: \[&quot;outreach\.send&quot;\]/);

  const secretsHtml = await readExportedPage("/products/secrets");
  assert.match(secretsHtml, /Connect a company tool without giving the app its key\./);
  assert.match(secretsHtml, /raw credential in the company vault/);
  assert.match(secretsHtml, /Typed tool grants/);
});
