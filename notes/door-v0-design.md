# Door v0 design — shared apps via signed invite links

*2026-07-27. Scope decision for the first Door slice, per the YC audit
("solve one RFS hard problem visibly: login + sharing").*

## The slice

`visibility: "shared"` in `tarantula.json` gates the deployed app behind a
member list. The owner shares access the way they share a doc link:

```bash
tarantula share add ana@example.com --json
# → prints an invite URL the owner sends over any channel
tarantula share list --json
tarantula share remove ana@example.com --json
```

Visiting the invite URL sets a session cookie and marks the member joined.
No password, no login form to build, no identity provider to wire in.

## Decisions and reasons

1. **Invite links, not email delivery.** Sending email requires a provider
   dependency (cost, keys, deliverability) that would make v0 heavier and
   flakier. The Google-Doc mental model is "send someone a link"; owners
   already have channels to do that. Email delivery is an additive upgrade
   later (same member table, same tokens).
2. **Membership lives in the app's own D1** (`door_members` table, reserved
   `_door` migration applied by the CLI when visibility is shared). Keeps the
   v0 story "your app, your data"; the control-plane workspace model from
   CONTROL_PLANE.md stays separate and later absorbs this.
3. **Sessions are HMAC-signed cookies** minted by the template worker.
   Signing secret is provisioned by deploy as a Worker secret
   (`DOOR_SESSION_SECRET` via wrangler); only a fingerprint is recorded in
   the lockfile. Invite tokens are single-use, stored hashed in D1 with an
   expiry.
4. **Gate implemented in the template worker** (small `door.js` module), not
   platform middleware — v0 has no platform edge in front of user Workers.
   The contract stays honest: Door v0 is a template capability the CLI
   provisions and manages, labelled **alpha**, and the site must say exactly
   that.
5. **Public stays default.** `visibility: "public"` behavior is unchanged.

## Non-goals for this slice

Roles beyond owner/member, teams, app-to-app identity, email delivery,
central session revocation UI, control-plane console. All remain planned.
