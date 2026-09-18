# App operations console verification

Verified September 17, 2026 against the local Next console at
`http://localhost:3082` and a real local control-plane Worker/D1 fixture at
`http://localhost:8792`.

## Behavior covered

- Opened `/workspace/app/?appId=signer` directly with a maintainer browser
  session. The app page loaded without a client-side navigation first.
- Confirmed the console distinguishes the recorded live release from the latest
  failed deployment. It describes this as deployment state and does not claim
  measured uptime.
- Confirmed the latest failure, three deployment records, creator email,
  timestamps, status, phase, duration, and release identifiers render from the
  control-plane response.
- Confirmed measured usage shows eight named action calls, one failed call, and
  zero interrupted calls for the 24-hour window. The interface explicitly says
  page views and billing usage are not measured.
- Expanded the failed deployment and read its phase and failure detail.
- Reviewed the prior-release rollback. The confirmation states that code changes
  while business data remains in place.
- Reviewed a completed database snapshot. The returned restore plan states that
  restore uses a new database, retains the original database, and preserves the
  separate state of connected apps.
- Followed the app-access anchor to the existing people, maintainer, action, and
  external-access controls.
- Used Tab and Enter through the rollback review and cancel controls. The focused
  control had the console's visible 2px outline.
- Repeated the page inspection at a 320 x 900 viewport. Document width remained
  320px with no horizontal overflow. Every interactive target in the operations
  section was at least 24px high; action buttons were at least 44px high.
- Browser console: zero errors during the successful desktop and narrow runs.

## Automated checks

- `npx tsc --noEmit`
- `npx eslint components/console/AppOverview.tsx components/console/AppOperations.tsx`
- `node --test tests/deployments.test.mjs tests/recovery.test.mjs` (20 passed)
- `git diff --check` on the app-operations slice

## Limits

The local browser fixture has no deployment coordinator, so browser verification
stopped before starting a rollback, snapshot, resume, verification, or restore.
The deployment and recovery suites exercise those operation lifecycles with a
real Durable Object and provider fixture. The frontend reuses an idempotency key
when a write response is lost and refreshes the parent app record from the
authoritative app state returned by `apps.operations.get`.

The optional frontend-design Deno accessibility analyzer could not run because
Deno is not installed. Browser inspection covered focus visibility, target size,
semantic labels, keyboard use, and 320px reflow instead.
