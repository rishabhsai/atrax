# Agent instructions

This is a Tarantula v0 app.

- Read `tarantula.json` before changing infrastructure.
- Keep browser code in `public/` and server code in `src/`.
- Add ordered SQL files to `migrations/`; never edit an applied migration.
- Run `tarantula dev` for the local app and persistent local Tables state.
- Run `tarantula doctor --json` before deployment.
- Run `tarantula deploy --json` to deploy. Treat its JSON as the authoritative result.
- Run `tarantula plan --json` to preview a deploy without changing anything.
- Run `tarantula inspect --json` to inspect the live deployment.
- Run `tarantula drift --json` to check the provider against the lockfile; it exits 2 when they no longer match.
- Do not edit `.tarantula/wrangler.jsonc`; Tarantula generates it from `tarantula.json` and `tarantula.lock.json`.

The app is public by default. Anyone with the URL can read and post messages.

## Instant deploys

With no Cloudflare account available, `tarantula deploy` publishes through
Tarantula instant hosting instead and prints a real public URL plus a one-time
claim token. The app is anonymous and disappears after 30 days unless you run
the `tarantula claim <token>` line the deploy prints; the token is never written
to disk, so capture it from that output. `--instant` forces the path. Instant
apps must be `"visibility": "public"` (no Worker secrets yet), and `inspect`,
`logs`, `plan`, `drift`, and `share` are not available for them.

## Shared visibility (Door alpha)

Set `"visibility": "shared"` in `tarantula.json` and run `tarantula deploy` to
put the app behind an invite-only gate.

- Deploy generates the `DOOR_SESSION_SECRET` Worker secret once and records
  `door.secretProvisioned` in `tarantula.lock.json`. The secret itself is never
  written to disk.
- `tarantula share add <email> [--json]` returns a single-use invite URL. Send it
  to the person yourself; Tarantula does not send email.
- `tarantula share list [--json]` reports each member as joined, invited, or expired.
- `tarantula share remove <email> [--json]` deletes the member row.
- `src/door.js` is the gate. It signs a `__door_session` cookie with HMAC-SHA256
  and serves a 401 page to everyone else. `/.well-known/*` stays open so
  readiness checks work.
- Members live in the app's own `door_members` table (`migrations/0003_door_members.sql`).
- `tarantula dev` runs a shared app without the gate. Membership is a remote concept in v0.

This is an alpha slice of Door, not the full product. There are no roles, no
teams, no email delivery, and no central session revocation.
