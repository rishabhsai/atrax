# CLI reference

Status: available

- `tarantula new <name> --template chat`
- `tarantula dev [--port 8787]`
- `tarantula deploy [--json]`
- `tarantula deploy --dry-run`
- `tarantula deploy --instant`: deploy to Tarantula instant hosting instead of a Cloudflare account. Deploy picks this path by itself when no Cloudflare account is detected.
- `tarantula claim <token> [--json]`: claim an instant app so it stops expiring.
- `tarantula plan [--json]`: read-only preview of what deploy would create, update, keep, or apply.
- `tarantula drift [--json]`: read-only comparison of the provider against `tarantula.lock.json`.
- `tarantula inspect [--json]`
- `tarantula logs [--json]`: JSON mode is a Wrangler NDJSON event stream.
- `tarantula doctor [--json]`: checks declared files, bundle, account, and lock ownership.
- `tarantula share add <email> [--json]`: invite someone to a shared app and return a single-use invite URL.
- `tarantula share list [--json]`: list members as joined, invited, or expired.
- `tarantula share remove <email> [--json]`: remove a member.

The share commands need `"visibility": "shared"` in `tarantula.json` and a deployed app. Visibility `public` is the default and is unchanged: anyone with the URL can use the app. Visibility `shared` is a Door alpha slice: deploy provisions a Worker session secret, and only people who opened an invite link can reach the app. Tarantula prints the invite URL; sending it is up to you.

```json
{ "schemaVersion": 1, "status": "invited", "email": "ana@example.com",
  "inviteUrl": "https://open-chat...workers.dev/.door/join?token=...", "expiresAt": 1790000000000 }
```

Instant hosting needs no Cloudflare account. `claimToken` and `expiresAt` appear only on the deploy that creates the app; redeploys reuse `.tarantula/instant.json` and omit them.

```json
{ "schemaVersion": 1, "status": "deployed", "mode": "instant", "name": "open-chat",
  "url": "https://i-3f9a2c81be.<subdomain>.workers.dev", "appId": "3f9a2c81be",
  "claimToken": "...", "expiresAt": 1790000000000,
  "resources": { "tables": { "name": "i-3f9a2c81be-tables" } } }
```

```json
{ "schemaVersion": 1, "status": "claimed", "appId": "3f9a2c81be",
  "url": "https://i-3f9a2c81be.<subdomain>.workers.dev" }
```

Finite JSON commands emit one versioned object and fail with a non-zero exit code. `logs --json` is the long-running NDJSON exception. Unknown options fail before any mutation. The first deploy records the Cloudflare account in `tarantula.lock.json`; later remote operations fail before mutation when the active account differs.

Exit codes: `0` success, `1` error (including a `plan` blocked by an unowned name conflict), `2` reserved for `drift` when the provider no longer matches the lockfile.

```json
{ "schemaVersion": 1, "status": "planned", "name": "open-chat", "changes": true,
  "actions": [{ "product": "launchpad", "resource": "worker/open-chat", "action": "create", "reason": "..." }],
  "migrations": { "pending": ["0001_messages.sql"] }, "conflicts": [] }
```

```json
{ "schemaVersion": 1, "status": "drifted", "name": "open-chat",
  "checks": [{ "check": "deployment", "expected": "...", "observed": "...", "result": "drift", "reason": "..." }] }
```
