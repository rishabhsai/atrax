# Workspace UX and navigation verification

The console now has one mounted session owner and a persistent workspace shell. Apps, Library, Team, and app details load inside that shell. A fresh session is reused during navigation; stale sessions refresh without replacing ready content. Identity replacement discards the previous account before loading. Sign-out, expiry, and unauthorized responses cannot revive an older response.

Apps has search, a maintained-app filter, separate Open and Manage actions, and an inline agent creation guide. Library has a searchable catalog, focused editors, content-first details, and collapsible sources, revisions, and archive controls. Team has progressive invitation controls and member action menus. App management separates Overview, Access, and Sharing while preserving drafts between sections. The main source also preserves the pending Operations and Secrets features in this shell.

## Verification

- Reproduced the previous navigation problem against the local Worker/D1/R2 fixture with a 1.8-second session delay: 4 session requests across initial Apps, Library, and Team in development. Development Strict Mode includes an extra initial request.
- Tested the new committed production build against that same fixture and delay. Exactly 1 session request across Apps → Library → Team. The sidebar and header remain mounted; page content loads inside them.
- Browser checks: saved a Library entry and opened its details; created a disposable workspace and immediately opened it with refreshed navigation; app section links preserve an unsaved access draft; sign-out returns to sign-in and Back cannot reopen the cached workspace.
- Browser responsive checks at 320px: Library detail, Apps, app overview/access/sharing. No horizontal document overflow in measured Apps and Access layouts. Mobile drawer opens, closes with Escape, and returns focus to Menu.
- 14 session/API regressions pass, including request coalescing, background refresh, identity replacement failure, expired authorization, cancellation, and late responses.
- Release build: 49 static routes; 349 output files hashed; 42 homepage asset/route references verified. Production JavaScript contains the production API origin and no fixture API URLs.
- Release checks: TypeScript, full ESLint, diff checks, rendered HTML and agent onboarding tests. 21 selected release tests pass. Main session and app-operations tests: 15 pass.

## Release boundary

Production UI source is commit b1839cb on the 0.2.1-compatible release branch. Its isolated export is /private/tmp/atrax-workspace-export/out. The CLI remains pinned to 0.2.1. No backend or CLI deployment is part of this change. Main's unreleased 0.3 Operations and Secrets UI remains in source and is not included in this production export.

Published to https://atrax.run with Cloudflare Pages production deployment `82199e60-d870-4853-b036-a23c611bec04`, source `b1839cb`, branch `main`. Deployment URL: https://82199e60.tarantula-9l0.pages.dev.

Verified 36 live routes, scripts, styles, and documentation files byte-for-byte against the committed export. Checked the signed-in production workspace in Chrome: workspace switching, Apps → Library → Team → Apps navigation, and the real app Access controls all load successfully. No application JavaScript errors were observed; the existing unrelated auto-PiP browser extension reports its own MediaSession error.

Main integration was also exercised against the local fixture: Operations retains the existing usage, deployment history, and recovery controls; Secrets loads within the persistent shell. No production data or access settings were changed during browser verification.
