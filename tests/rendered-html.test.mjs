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
    /<title>Tarantula \| An agent-native cloud for small software/,
  );
  assert.match(html, /A small cloud your coding agent can operate\./);
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
  assert.match(html, /\/docs/);
  assert.match(html, /\/docs\.json/);
  assert.match(html, /\/llms\.txt/);
  assert.match(html, /tarantula-chat-demo/);
  assert.doesNotMatch(
    html,
    /\/products\/(workers|agent-runtime|hosting|database|auth|storage|secrets)/,
  );
  assert.doesNotMatch(html, /tiny-cloud-hero|company-switchboard|company-library/);
  assert.match(html, /opengraph-image/);
  assert.doesNotMatch(html, /codex-preview|Building your site|loading skeleton/i);
  await access(new URL("../out/opengraph-image", import.meta.url));
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
