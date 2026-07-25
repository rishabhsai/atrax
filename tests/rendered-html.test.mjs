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

test("exports product detail routes", async () => {
  const html = await readExportedPage("/products/vault");
  assert.match(html, /Vault/);
  assert.match(html, /The company owns access\. Apps borrow capability\./);
  assert.match(html, /Apps receive short-lived authority/);
  assert.match(html, /Store company connections once/);
});
