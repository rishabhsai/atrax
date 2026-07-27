# Door

Status: planned

Door will own guest identity, optional sign-in, private sharing, invitations, teams, roles, and app identity.

Door is not available in v0. The current chat is public by default.

## Available alpha slice

Setting `"visibility": "shared"` in `atrax.json` puts the deployed app behind an invite-only gate implemented in the template Worker. Deploy provisions a `DOOR_SESSION_SECRET` Worker secret once; the secret never touches disk.

- `atrax share add <email> [--json]` returns a single-use, 14-day invite URL. Atrax prints it; you send it.
- `atrax share list [--json]` reports members as joined, invited, or expired.
- `atrax share remove <email> [--json]` deletes the member.

Opening the invite URL sets a 30-day HMAC-signed `__door_session` cookie. Members live in the app's own `door_members` table. `/.well-known/*` stays reachable for readiness checks.

Shared apps also run on Atrax instant hosting, with no Cloudflare account. The invite flow is identical; only the plumbing differs. Instant hosting generates the `DOOR_SESSION_SECRET` itself, once per app, and the same `atrax share` commands manage members through Atrax instead of through your Cloudflare account. The deploy prints `Shared app: only invited members can open it.` and its JSON carries `"access": "shared"`.

This slice is a template capability the CLI provisions and manages. It is not the Door product: there are no roles, teams, email delivery, or central session revocation, and the platform has no edge in front of user Workers yet.
