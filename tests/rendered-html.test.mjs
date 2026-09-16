import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function readExportedPage(pathname = "/") {
  const relativePath =
    pathname === "/" ? "../out/index.html" : `../out${pathname}/index.html`;
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

const publicRoutes = [
  "/",
  "/products",
  "/products/launchpad",
  "/products/door",
  "/products/library",
  "/products/switchboard",
  "/products/mcp",
  "/products/loops",
  "/solutions",
  "/solutions/company-apps",
  "/solutions/private-sharing",
  "/solutions/connected-apps",
  "/solutions/agent-workspace",
  "/developers",
  "/security",
  "/pricing",
  "/company",
];

const staleLaunchClaims = [
  /atrax deploy --instant/i,
  /claim token/i,
  /your Cloudflare account/i,
  /npx atrax-cloud/i,
  /free unlimited/i,
  /public chat/i,
];

test("exports the company-app routes and leaves deferred work explicit", async () => {
  const rendered = await Promise.all(
    publicRoutes.map(async (route) => [route, await readExportedPage(route)]),
  );
  for (const [route, html] of rendered) {
    assert.match(html, /<main/i, `${route} is a rendered public page`);
    for (const staleClaim of staleLaunchClaims)
      assert.doesNotMatch(
        html,
        staleClaim,
        `${route} has no retired launch claim`,
      );
  }

  const home = new Map(rendered).get("/");
  assert.match(home, /company-owned apps/i);
  assert.match(home, /named actions/i);
  assert.match(home, /Company Library/i);
  assert.match(home, /existing agent/i);
  assert.match(home, /Hosted agents, scheduled automation/i);

  const security = new Map(rendered).get("/security");
  assert.match(security, /current workspace membership, app audiences, and action permissions/i);
  assert.match(security, /does not make its actions or company Library public/i);

  const pricing = new Map(rendered).get("/pricing");
  assert.match(pricing, /Install the CLI from source/i);
  assert.match(pricing, /Hosted pricing and usage allowances will be published/i);
  assert.doesNotMatch(pricing, /\$0/);

  const developers = new Map(rendered).get("/developers");
  assert.match(developers, /same operations from the CLI and MCP/i);
  assert.match(developers, /MCP stdio/i);

  await access(new URL("../out/og.png", import.meta.url));
  await access(new URL("../out/icon.svg", import.meta.url));
});

test("exports documentation and operation schemas for the shared interfaces", async () => {
  const docs = JSON.parse(
    await readFile(new URL("../out/docs.json", import.meta.url), "utf8"),
  );
  assert.equal(docs.schemaVersion, 2);
  assert.equal(docs.operationsUrl, "https://atrax.run/operations.json");
  assert.ok(Array.isArray(docs.documents));

  const documentSlugs = new Set(
    docs.documents.map((document) => document.slug),
  );
  for (const slug of [
    "quickstart",
    "door",
    "library",
    "switchboard",
    "mcp",
    "security",
    "status",
  ]) {
    assert.ok(documentSlugs.has(slug), `docs include ${slug}`);
    await access(new URL(`../out/docs/${slug}/index.md`, import.meta.url));
  }

  const status = docs.documents.find((document) => document.slug === "status");
  assert.match(
    JSON.stringify(status),
    /Hosted agents and scheduled automation/i,
  );
  assert.match(JSON.stringify(status), /third-party OAuth connectors/i);

  const operations = JSON.parse(
    await readFile(new URL("../out/operations.json", import.meta.url), "utf8"),
  );
  assert.equal(operations.schemaVersion, 1);
  assert.equal(operations.transport.method, "POST");
  for (const name of [
    "apps.create",
    "actions.list",
    "actions.call",
    "library.entry.create",
    "library.file.upload",
  ]) {
    const operation = operations.operations[name];
    assert.ok(operation, `operations include ${name}`);
    assert.ok(operation.inputSchema, `${name} has an input schema`);
  }
});
