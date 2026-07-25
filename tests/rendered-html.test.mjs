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
  assert.match(html, /<title>Tarantula — The tiny cloud for agent-built software/);
  assert.match(html, /Build it with an agent\. Deploy it in one command\./);
  assert.match(html, /npx tarantula deploy/);
  assert.match(html, /Launchpad/);
  assert.match(html, /Tables/);
  assert.match(html, /Door/);
  assert.match(html, /Library/);
  assert.match(html, /Switchboard/);
  assert.match(html, /Spark/);
  assert.match(html, /Loop/);
  assert.match(html, /Connect once\. Let your apps help each other\./);
  assert.match(html, /Give every app the same trusted company knowledge\./);
  assert.match(html, /images\/tiny-cloud-hero\.jpg/);
  assert.match(html, /images\/company-switchboard\.jpg/);
  assert.match(html, /images\/company-library\.jpg/);
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
  assert.match(agentHtml, /Turn a repeated task into an agent your team can trust\./);
  assert.match(agentHtml, /Loop/);
  assert.match(agentHtml, /on: schedule/);
  assert.match(agentHtml, /approve: \[&quot;outreach\.send&quot;\]/);

  const secretsHtml = await readExportedPage("/products/secrets");
  assert.match(secretsHtml, /Connect company tools once\. Let every app use them safely\./);
  assert.match(secretsHtml, /Switchboard/);
  assert.match(secretsHtml, /raw credentials stay in the company vault/);
  assert.match(secretsHtml, /Typed tool grants/);
});
