# Landscape and woven homepage

September 17, 2026. The user approved the rendered second study and requested a
viewport-height hero, motion, main-checkout implementation, and live publication.

The homepage contains the complete capability overview with anchor navigation.
Existing product deep links remain available. The real agent setup command,
client choices, prompt, copy behavior, and agent guide remain the primary action.
Artwork is optimized WebP, with smaller images for phones. Generation prompts
are recorded in `homepage-artwork-prompts.json`.

Motion includes a brief hero entrance, bounded fine-pointer depth, one-time
artwork reveals, and a sliding workflow indicator. Copy and navigation are never
blocked. Content remains visible without JavaScript. CSS and media-query listeners
handle reduced motion, including preference changes. The workflow is explicitly
an illustration and does not perform a business operation.

## Browser and source checks

Inspected the implementation at 1665px, 834px, 390px, and 320px widths. Checked the
landscape, all woven illustrations, narrow-screen captions, and section anchors.
There was no horizontal overflow. The header plus hero measured exactly the
viewport height at desktop and phone sizes. Short screens may grow naturally.
The prompt copied successfully with its live announcement. The mobile menu closed
on navigation. Keyboard Space selected a workflow step and updated its announced
description. Fixed a paragraph-margin specificity conflict and moved the Apps
caption below its illustration at tablet widths.

Targeted ESLint, TypeScript, and whitespace checks passed before committing.
Reduced-motion branches were reviewed in source; browser emulation was not
available in the UI-control capability used for the visual checks.

## Release boundary

The existing production Pages source is `0bc8369`. The main checkout also contains
`7f017e0`, the other agent's 0.3.0 source candidate. Its release notes explicitly
require a remote Secrets migration/key, control-plane rollout, and npm release
before publishing the new onboarding files. Those operations are outside this
visual release.

Publish the design commit on the verified production base in a separate committed
release worktree outside Desktop. This keeps the live installer pinned to the
released CLI and preserves the existing console/API contract. The main checkout
retains both the 0.3.0 candidate and the design, ready for the separate product
rollout. Build and hash the isolated release before upload; record final build
and live verification after deployment.

## Published verification

Published to Cloudflare Pages production on branch `main` from release commit
`75de475`, which contains the design commit `cdc32e7` applied to `0bc8369`.
Deployment: https://e803dd6c.tarantula-9l0.pages.dev
Live domain: https://atrax.run/

- Isolated `npm ci`, production build, full ESLint, and the rendered-HTML and
  agent-onboarding tests passed. Seven tests passed, zero failed or skipped.
- Verified 40 local homepage references and hashed all 332 export files before
  upload. The hashes were unchanged after upload. `/products/` redirects to
  `/#products` in the local Pages runtime.
- The queryless live homepage and installer matched the exported files byte for
  byte. All nine live artwork files also matched. Quickstart, Actions docs,
  Workspaces, and the existing Apps detail URL returned HTTP 200.
- Opened the actual custom domain in Chrome. Desktop and mobile render the new
  art. The header plus hero measured 996px on a 996px desktop viewport and 844px
  on an 844px phone viewport. The mobile document had no horizontal overflow.
- The live Actions controls changed the active step and explanation. All five
  full-size artwork images loaded. Fine-pointer interaction changed the hero's
  bounded offset in the release build. Confirmed the tablet caption fix in that
  build, after an old dev tab had retained its prior stylesheet.
- Python urllib received HTTP 403 during one automated fetch attempt. Curl and
  Chrome served the expected public files; byte comparisons used curl.

The new backend candidate remains unshipped. No production migration, encryption
key, backend deployment, npm publication, or console feature rollout was performed.
