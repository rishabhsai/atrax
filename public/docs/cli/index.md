# CLI reference

Status: available

- `tarantula new <name> --template chat`
- `tarantula dev [--port 8787]`
- `tarantula deploy [--json]`
- `tarantula deploy --dry-run`
- `tarantula inspect [--json]`
- `tarantula logs [--json]`: JSON mode is a Wrangler NDJSON event stream.
- `tarantula doctor [--json]`: checks declared files, bundle, account, and lock ownership.

Finite JSON commands emit one versioned object and fail with a non-zero exit code. `logs --json` is the long-running NDJSON exception. Unknown options fail before any mutation. The first deploy records the Cloudflare account in `tarantula.lock.json`; later remote operations fail before mutation when the active account differs.
