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
