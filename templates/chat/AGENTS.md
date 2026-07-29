# Agent instructions

This is an Atrax v0 app.

- Read `atrax.json` before changing infrastructure.
- Keep browser code in `public/` and server code in `src/`.
- Add ordered SQL files to `migrations/`; never edit an applied migration.
- Run `atrax dev` for the local app and persistent local Tables state.
- Run `atrax doctor --json` before deployment.
- Run `atrax deploy --json` to deploy. Treat its JSON as the authoritative result.
- Run `atrax plan --json` to preview a deploy without changing anything.
- Run `atrax inspect --json` to inspect the live deployment.
- Run `atrax drift --json` to check the provider against the lockfile; it exits 2 when they no longer match.
- Run `atrax tables export [--out <file>]` to dump every table as JSON.
- Do not edit `.atrax/wrangler.jsonc`; Atrax generates it from `atrax.json` and `atrax.lock.json`.

The app is public by default. Anyone with the URL can read and post messages.

## Instant deploys

With no Cloudflare account available, `atrax deploy` publishes through
Atrax instant hosting instead and prints a real public URL plus a one-time
claim token. The app is anonymous and disappears after 30 days unless you run
the `atrax claim <token>` line the deploy prints; the token is never written
to disk, so capture it from that output. `--instant` forces the path.
`logs`, `plan`, and `drift` are not available for instant apps; `inspect` and
`atrax tables export` are, and read the app through Atrax instant hosting.

Every instant deploy names who can open the URL in one line under it, and the
JSON carries `"access": "public"` or `"access": "shared"`. Both visibilities
work: a shared instant app gets its Door session secret from instant hosting,
and `atrax share` manages its members through Atrax instead of a Cloudflare
account.

Two commands work only on instant apps:

- `atrax secret set <NAME> [--json]` stores a Worker secret on the live app.
  The value is read from stdin, never from a command-line argument:
  `printf %s "$KEY" | atrax secret set OPENAI_API_KEY`. Names are uppercase
  letters, numbers, and underscores. `atrax secret remove <NAME> [--json]`
  deletes one. On a Cloudflare-account app use
  `npx wrangler secret put <NAME> --config .atrax/wrangler.jsonc`.
- `atrax delete --yes [--json]` permanently deletes the live app, its Tables
  database, `.atrax/instant.json`, and `atrax.lock.json`. Without `--yes` it
  refuses and explains what would be lost.

## Shared visibility (Door alpha)

Set `"visibility": "shared"` in `atrax.json` and run `atrax deploy` to
put the app behind an invite-only gate.

- Deploy generates the `DOOR_SESSION_SECRET` Worker secret once and records
  `door.secretProvisioned` in `atrax.lock.json`. The secret itself is never
  written to disk. On instant hosting the control plane generates and records
  it instead; either way it happens once and never rotates on a redeploy.
- `atrax share add <email> [--json]` returns a single-use invite URL. Send it
  to the person yourself; Atrax does not send email.
- `atrax share list [--json]` reports each member as joined, invited, or expired.
- `atrax share remove <email> [--json]` deletes the member row.
- `src/door.js` is the gate. It signs a `__door_session` cookie with HMAC-SHA256
  and serves a 401 page to everyone else. `/.well-known/*` stays open so
  readiness checks work.
- Members live in the app's own `door_members` table (`migrations/0003_door_members.sql`).
- `atrax dev` runs a shared app without the gate. Membership is a remote concept in v0.

This is an alpha slice of Door, not the full product. There are no roles, no
teams, no email delivery, and no central session revocation.
