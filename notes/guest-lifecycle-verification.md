# Guest lifecycle verification

September 16, 2026. Implementation issue [Guest invitation and access lifecycle](https://github.com/rishabhsai/atrax/issues/14).

Owners and admins can cancel pending invitations, replace an accepted guest's action grants, and revoke app access from the console, CLI, and MCP. Invitation history distinguishes pending, accepted, expired, cancelled, and revoked states.

Grant edits use opaque revision tokens. Revoking and reinviting a person creates a new token, so an old open editor cannot overwrite the new grant. Migration 0015 preserves existing guests, action grants, and invitation records while adding this model.

## Checks

- `node --test tests/external-sharing.test.mjs tests/guest-lifecycle.test.mjs`: 10 tests passed against real local Workers, D1, R2, gateway, app runtime, CLI and MCP transport. Tests cover state transitions, exact retries, changed-input conflicts, permission races, active-session revocation, independent access to a second app, stale drafts after reinvitation, and migration of populated tables.
- Integrated with the packaged skill installer: 21 tests passed across those two files and `tests/setup-cli.test.mjs`.
- Console TypeScript and focused ESLint checks passed.
- Browser exercised the real local control plane through email sign-in. At desktop width, an independently committed CLI edit caused a revision conflict; the console retained the original draft, displayed the observed replacement grants, and saved only after review and another explicit save. Guest invitation and cancellation worked through the form.
- At a 390px viewport, keyboard Space toggled the action checkbox, saving an empty set produced view-only access, and Revoke removed the guest. The layout had no horizontal overflow.

All email remained in the local test mailbox. This note records local verification, not a hosted deployment claim.
