# Cohesive public site and workspace design

The homepage's three-step Actions story is removed. Its closing action now returns
to the hero's installer and prompt. Supporting pages, product deep links,
documentation, sign-in, and the workspace console share the warm paper, copper,
olive, and woven illustration direction.

Two original generated illustrations serve sign-in and workspace onboarding.
Production WebP files are in `public/images/console/`; exact generation prompts
are recorded in `notes/console-artwork-prompts.json`. Illustrations are decorative.
Working screens render actual data and retain their existing permissions and API
calls. No dependencies, backend operations, or migrations were added.

Documentation now covers Secrets storage, grants, rotation and revocation,
deployment inspection, rollback and snapshots, guest sharing, and the connected
Inventory/Orders workflow. The Secrets and operations-summary rollout is still
pending. Those sections and recipient-only sharing explicitly distinguish the
0.3.0 candidate from the hosted 0.2.1 service. Existing apps need a matching CLI
rebuild and ordinary deployment before using the new Secrets runtime.

## Verification before release

- Main and release worktrees passed TypeScript, ESLint, and diff whitespace checks.
- A separate documentation reviewer compared claims against the implementation
  and validated 19 generic CLI examples against operation input schemas.
  Both identified fixes were incorporated: Secrets upgrade prerequisites and
  separate JSON-edit and shell-command blocks for Orders.
- Chrome desktop and 320px mobile checks used a real local control-plane Worker
  and D1 fixture, with a seeded disposable browser session. Production data and
  email delivery were not used.
- Opened app details by link and inspected current release and access controls.
- Used the mobile menu to navigate to Library and Team. The menu focused its
  Close button. App, Library, Team, and entry forms had no horizontal overflow.
- Created and read a disposable Library entry through its actual browser form.
- Created a disposable workspace through its actual browser form and verified
  the illustrated empty-app state.
- Inspected desktop sign-in, documentation, and 390px security page layouts.
- Used the mobile docs directory, opened Inventory/Orders, and followed its
  section anchor. The target remained below the fixed header.
- Browser logs contained only unrelated Chrome extension errors during these
  local checks; no application error was observed.

## Release boundary

The release worktree is based on the currently hosted 0.2.1 source plus visual and
documentation changes. The main workspace keeps the unreleased 0.3.0 functionality
and receives the same styling. Release build and deployment verification are
recorded below after completion. No backend or CLI publication is part of this
visual release.

## Published release

- Main implementation commit: `47cf52d`.
- Production source commit: `3f68808`, built in the isolated release worktree.
- Cloudflare Pages production deployment:
  `https://d2753fb8.tarantula-9l0.pages.dev`, serving `https://atrax.run`.
- `npm run build` completed with 49 exported HTML pages. All seven existing
  rendered-HTML and agent-onboarding tests passed.
- Checked 2,445 local references across every exported HTML page. None were
  missing. The export contains no local test API endpoint, preserves the released
  operation registry and CLI 0.2.1 installer, and excludes the unreleased Secrets
  console route.
- Hashed 349 export files before upload and verified the same hashes afterward.
  Homepage SHA-256 is
  `534ea938753b5a88717f05e12f19a6d2d7f1e380f0392edb4b41d991f97ea05c`.
- Compared 22 live pages/assets with the export. Twenty-one were byte-identical.
  Cloudflare masks the developers page's example email and inserts its decoder
  script. Reversing only that observed transformation produced the exact build.
  Chrome displayed the original command correctly, without application errors.
- Verified the published sign-in page and loaded illustration on the live domain.
- The closing homepage action returned to `#hero`; the hero occupied 924px plus
  its 72px header in a 996px viewport. Prompt copying reported success.
- In the production export at 320px, sign-in kept the form visible without
  horizontal scrolling, focused the required email field on empty submission,
  and showed the recovery message for an incomplete confirmation link. No
  production email was requested.

Backend, CLI, and migration rollout remain separate from this production update.
