# Naming consistency release

September 17, 2026. Implementation commit: `0bc8369`. CLI: `atrax-cloud@0.2.1`.

## Changes

The website, console, documentation, CLI, bundled skill, and generated agent references use Apps, Database, Access, Library, and Actions. Workspaces is the workspace-selection destination; Apps is the directory within a workspace. MCP appears under For agents. Automation and Secrets remain planned.

Product and documentation URLs use the same names. Retired product slugs and `/account` are removed. `/products` still redirects to the homepage catalog. Ownership transfer is consistently `workspaces.transferOwnership`, including its generated MCP name, dispatcher, receipts, and console caller. The retired singular operation is rejected.

`CONTEXT.md` defines the shared vocabulary. Current scope and design documents follow it; older proposals are marked historical. Technical schema fields such as `tables` and the deployed `Door` RPC entrypoint retain their existing meanings and contracts.

## Verification

- The production export, control-plane build, CLI package assembly, full ESLint run, and production Worker dry run passed.
- The integrated pre-publication suite passed **188 tests, zero failures**, using the exact `0.2.1` tarball through `ATRAX_TEST_TARBALL`. The registry-install onboarding case is excluded until this version is published.
- Ownership transfer tests exercise real local Worker/D1 state through HTTP and MCP, including current authorization and rejection of the retired operation.
- The package test installs the tarball outside the checkout and exercises the create, run, deploy, and private-sharing workflow against the local platform. External Cloudflare provisioning is simulated in that test.
- The isolated Pages export contains 47 HTML pages. All 102 internal route and asset targets resolve. A SHA-256 manifest covers all 340 export files.
- A browser followed homepage Products navigation, Database to Database docs, and Workspaces. The catalog settles 83px below the viewport top. The documentation sidebar uses the canonical product names, For agents, and Planned groups. Desktop screenshots were visually inspected.
- At 390px and 320px, browser DOM measurements show no horizontal page overflow, and every catalog label remains within the viewport. Mobile screenshot capture failed in the preview tool, so this run does not claim a visual mobile review.
- The Prompt button switches the desktop setup block to the plain-English agent prompt and changes the copy control to Copy prompt.
- The local Workspaces route renders the correct page and connection-error state: the production API intentionally rejects the localhost origin. This is not an authenticated hosted-console check.

## Publication

The implementation is pushed to `feat/workspace-launch`. [atrax-cloud 0.2.1](https://www.npmjs.com/package/atrax-cloud/v/0.2.1) is published. npm completed its publish-time scan, and the public registry's SHA-512 integrity matches the tested tarball:

`sha512-EnplUy4a124oYCzh1n60FcIApMIpsH8nObn3ypk1tPNbhqZn9CAytzqLAAIqrEQOCwUwi4KFZ2IebJOPJNId6A==`

The complete public-registry onboarding suite then passed all five checks, including installation, repeat installation, matching skill bytes, PATH shadowing, and conflict handling. An initial attempt before npm made the package installable failed with a registry 404; it passed after registry availability was confirmed.

Production Worker version: `9ed054c4-6255-4574-940a-7328048bf209`. No database migrations were required. The API health endpoint returns 200. With valid anonymous input, `workspaces.transferOwnership` returns 401 and the retired singular operation returns 404. No real ownership was changed.

The isolated Pages export was deployed as Production/main at `77b95149-1464-48ee-95b5-9a903887fcd8`, then fully re-uploaded with `--skip-caching` as [4f67901c](https://4f67901c.tarantula-9l0.pages.dev) while investigating stale retired URLs. All 340 export files retain their verified SHA-256 hashes.

The current homepage, Workspaces, seven product pages, seven corresponding docs pages, and agent endpoints return 200. `/products` and `/products/` return 301 to `/#products`. Live `agents.md`, `agents.sh`, `operations.json`, and `docs.json` match the release bytes; the installer pins the published 0.2.1 package.

An existing signed-in browser session successfully opened Workspaces and the Atrax workspace's Apps directory, with Apps, Library, and Team navigation and both existing apps listed. The local-origin connection error described above does not occur on the production origin.

### Remaining provider issue

Some retired URLs still return cached old HTML on `atrax.run`, despite returning 404 on the project and deployment hosts. Hostname, whole-zone, and exact-URL purges plus a full asset re-upload did not reliably clear them. Current routes and the CLI release work; removal of every retired public URL is not fully verified. [Pages cache incident](pages-cache-incident.md) records the evidence and a prepared support report. No support message has been sent.

Existing Claude/Cursor model-login checks remain pending under the user's earlier release decision.
