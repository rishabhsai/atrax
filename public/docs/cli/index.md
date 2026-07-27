# CLI reference

Status: available

- `tarantula new <name> --template chat`
- `tarantula dev [--port 8787]`
- `tarantula deploy [--json]`
- `tarantula deploy --dry-run`
- `tarantula plan [--json]`: read-only preview of what deploy would create, update, keep, or apply.
- `tarantula drift [--json]`: read-only comparison of the provider against `tarantula.lock.json`.
- `tarantula inspect [--json]`
- `tarantula logs [--json]`: JSON mode is a Wrangler NDJSON event stream.
- `tarantula doctor [--json]`: checks declared files, bundle, account, and lock ownership.

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
