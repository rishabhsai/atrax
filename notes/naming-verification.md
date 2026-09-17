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

## Publication status

The implementation is pushed to `feat/workspace-launch`. The exact tested package and Pages export are ready. npm publication is waiting for the user's security-key authentication after the previous publishing session expired. The production site has not been switched to an installer referencing the unpublished version.

Release order: publish and verify the tested npm tarball; repeat the public-registry installer check; deploy the control plane and isolated Pages export; verify production routes and agent references. Existing Claude/Cursor model-login checks remain pending under the user's earlier release decision.
