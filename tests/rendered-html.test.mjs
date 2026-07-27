import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function readExportedPage(pathname = "/") {
  const relativePath =
    pathname === "/" ? "../out/index.html" : `../out${pathname}/index.html`;
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("exports the six-product Tarantula site", async () => {
  const html = await readExportedPage();
  assert.match(
    html,
    /<title>Tarantula \| A cloud for everyone/,
  );
  assert.match(html, /A cloud for everyone\./);
  assert.match(html, /Give this to your coding agent/);
  assert.match(html, /curl -fsSL https:\/\/tarantula-9l0\.pages\.dev\/agent/);
  assert.match(html, /tarantula deploy --json/);
  assert.match(html, /Launchpad/);
  assert.match(html, /Tables/);
  assert.match(html, /Door/);
  assert.match(html, /Library/);
  assert.match(html, /Switchboard/);
  assert.match(html, /Loops/);
  assert.doesNotMatch(html, />Spark</);
  assert.match(html, /\/products\/loops/);
  assert.match(html, /\/products\/switchboard/);
  assert.match(html, /Clouds deploy apps\./);
  assert.match(html, /Every app can use every other app\. On your terms\./);
  assert.match(html, /Six products\. One contract\. Nothing to assemble\./);
  assert.match(html, /Share an app the way you share a doc\./);
  assert.match(html, /Deploy an agent\. Let it keep working\./);
  assert.match(html, /Planned interface\. Door is not available yet/);
  assert.match(html, /Planned interface\. Not a recorded run\./);
  assert.doesNotMatch(html, /loops-agents\.png/);
  assert.doesNotMatch(html, /switchboard-apps\.png/);
  assert.doesNotMatch(html, /deploy \/ production/);
  const developersHtml = await readExportedPage("/developers");
  assert.match(developersHtml, /deploy \/ production/);
  assert.doesNotMatch(html, /From an idea to running software\./);
  assert.doesNotMatch(html, /Six products\. Six responsibilities\./);
  assert.match(html, /\/docs/);
  assert.match(html, /\/docs\.json/);
  assert.match(html, /\/llms\.txt/);
  assert.match(html, /Use cases/);
  assert.match(html, /Everything you shipped\. In one quiet place\./);
  assert.match(html, /\/account/);
  assert.match(html, /nav-menu-products/);
  assert.match(html, /nav-menu-use-cases/);
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  assert.doesNotMatch(header, /GitHub|tarantula-chat-demo|Open live chat/);
  assert.doesNotMatch(
    html,
    /\/products\/(workers|agent-runtime|hosting|database|auth|storage|secrets)/,
  );
  assert.doesNotMatch(html, /tiny-cloud-hero|company-switchboard|company-library/);
  assert.match(html, /og\.png/);
  assert.match(html, /icon\.svg/);
  assert.doesNotMatch(html, /codex-preview|Building your site|loading skeleton/i);
  const accountHtml = await readExportedPage("/account");
  assert.match(accountHtml, /Your software, without the provider maze\./);
  assert.match(accountHtml, /Cloudflare Access is not enabled on this account yet/);
  assert.match(accountHtml, /Your first deploy will appear here\./);
  await access(new URL("../out/og.png", import.meta.url));
  await access(new URL("../out/icon.svg", import.meta.url));
  await access(new URL("../out/agent", import.meta.url));
  await access(new URL("../out/loops-agents.png", import.meta.url));
  await access(new URL("../out/switchboard-apps.png", import.meta.url));
});

test("exports canonical product detail routes", async () => {
  const loopsHtml = await readExportedPage("/products/loops");
  assert.match(loopsHtml, /Keep useful work running after the tab closes\./);
  assert.match(loopsHtml, /Planned canonical API/);
  assert.match(loopsHtml, /One trigger model/);
  assert.doesNotMatch(loopsHtml, /Spark and Loop/);

  const switchboardHtml = await readExportedPage("/products/switchboard");
  assert.match(switchboardHtml, /Let apps call tools without handing them keys\./);
  assert.match(switchboardHtml, /Company vault/);
  assert.match(switchboardHtml, /Roadmap architecture/);
});

test("exports human and agent-native docs", async () => {
  const docsHtml = await readExportedPage("/docs");
  assert.match(docsHtml, /Install the local alpha/);
  assert.match(docsHtml, /tarantula new open-chat --template chat/);
  assert.match(docsHtml, /Anyone with the URL can read and post/);

  const cliHtml = await readExportedPage("/docs/cli");
  assert.match(cliHtml, /JSON contract/);
  assert.match(cliHtml, /tarantula inspect/);

  const statusHtml = await readExportedPage("/docs/status");
  assert.match(statusHtml, /Planned for Lakebed-equivalent coverage/);
  assert.match(statusHtml, /Additional Tarantula roadmap/);

  const docsManifest = JSON.parse(
    await readFile(new URL("../out/docs.json", import.meta.url), "utf8"),
  );
  assert.equal(docsManifest.agentEntrypoints.agent, "/agent");
  assert.equal(docsManifest.agentEntrypoints.llms, "/llms.txt");
  assert.equal(docsManifest.pages.length, 13);
  for (const page of docsManifest.pages) {
    await access(new URL(`../out${page.markdownUrl}`, import.meta.url));
  }
  await access(
    new URL("../out/docs/infrastructure-model/index.md", import.meta.url),
  );
  await access(new URL("../out/llms.txt", import.meta.url));
  await access(new URL("../out/llms-full.txt", import.meta.url));
  await access(new URL("../out/docs/loops/index.md", import.meta.url));
  await access(new URL("../out/schema/v0.json", import.meta.url));
});

test("publishes the same-origin health contract enforced by the CLI", async () => {
  const schema = JSON.parse(
    await readFile(new URL("../out/schema/v0.json", import.meta.url), "utf8"),
  );
  const healthPattern = new RegExp(schema.properties.web.properties.health.pattern);
  assert.equal(healthPattern.test("/.well-known/tarantula.json"), true);
  assert.equal(healthPattern.test("//example.com/probe"), false);
  assert.equal(healthPattern.test("/\\example.com/probe"), false);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.web.additionalProperties, false);
  assert.equal(schema.properties.tables.additionalProperties, false);
});
