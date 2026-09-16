# Marketing refresh and CLI audit

Verified September 16, 2026.

## CLI audit

The CLI supports app creation/local development/build/deploy, verified sign-in and workspace selection, Library files/search, and generic operation calls. Team/access/sharing/session/recovery management is available through operation calls; it is not all surfaced as friendly subcommands. The registry contains 68 operations; MCP exposes 61, excluding browser/email/device sign-in handshakes.

Focused `cli`, `mcp`, `external-sharing`, and `session-api` tests passed: 14/14. Existing hosted launch evidence is in `notes/launch-verification.md`; this marketing turn did not repeat every production operation or send an invitation email.

An owner/admin agent can invite an exact email to one app, then return its stable URL. The guest verifies the invited email and accepts. A guest invitation does not remove existing workspace access; selected company access retains at least one workspace member. Public-web state and selected action grants must be reviewed separately. The developer landing page shows the current multi-operation workflow, including audience, guest, and public-state reads.

Known next work: dedicated sharing commands, invitation cancellation and accepted-grant editing, consistent retry keys in CLI shortcuts, npm release of the new workspace CLI, operation discovery/recipes, and a polished existing-prototype import flow. Approved GitHub tickets are linked in `notes/next-cli-tickets.md`.

## Site changes

- Refreshed all 17 public landing routes, including a new private-sharing use case.
- Added a generated architectural homepage background, delivered as a 47 KiB WebP. Prompt and source are in `notes/marketing-artwork.md`.
- Added concrete sharing, connected-app, and company-knowledge examples, plus real CLI commands and clear installation requirements.
- Replaced repeated product-summary boxes with labeled workflow/default examples.
- Fixed keyboard menu dismissal by using disclosure buttons. Menus reset on navigation, including mobile.
- Updated metadata, footer copy, design documentation, and content assertions to match current behavior.

## Verification

- Production static export: build and TypeScript passed, with the production control-plane URL.
- Scoped ESLint and `git diff --check`: passed.
- Rendered HTML/documentation contract tests: 2/2 passed.
- All 17 landing routes opened directly at 1440px and 390px: HTTP 200, one h1, no horizontal overflow, no broken images, no page JavaScript exceptions.
- Home inspected at 820px and 900px; text remained clear of artwork.
- Final product example changes rechecked at desktop and phone widths.
- Keyboard: Tab reaches disclosure button, Enter opens, Escape closes and returns focus to its trigger.
- Mobile navigation: a menu link navigates to its destination and the menu closes.
- Reveal sections checked through actual scrolling and reduced-motion rendering; command-copy behavior checked in the browser.
- 740 internal landing-page links resolve to exported destinations.
- Browser evidence is stored locally in `.scratch/marketing-qa/`.

## Ticket publication

Issues #13–#18 were approved and published with `ready-for-agent`. Native blocker checks: #13, #14, #15 have none; #16 and #17 depend on #13 and #15; #18 depends on #13. The tickets remain open and are not represented as implemented.

## Production publication

- Source commit: `d8584c0` on `feat/workspace-launch`, pushed to GitHub.
- Cloudflare Pages deployment: https://ff6213dd.tarantula-9l0.pages.dev
- Production: https://atrax.run
- Production browser smoke passed for Home, CLI/MCP, private sharing, and Library product deep links. Keyboard open/Escape-close and phone overflow checks passed with no page exceptions.
- Account, workspace, quickstart, and operation schema paths returned HTTP 200 in the production browser.
- Production background is 48,272 bytes and matches the local SHA-256: `7b8a988d15a6e2ba63fcdc706a733dca1b837afb936177292008cbfeaedbf456`.
- A separate Python urllib probe was rejected with HTTP 403; verification above used the browser and its ordinary same-origin requests.
- Agent documentation access also passed outside the browser: curl fetched `/llms.txt` with HTTP 200; Node fetch received HTTP 200 for both `/llms.txt` and `/operations.json`.
- Final production browser console: zero errors and zero warnings.
