# Tarantula product spec

## Position

Tarantula is an agent-native cloud for small companies. A coding agent can turn a folder into a working, inspectable app and a shareable URL without operating a cloud console.

## Products

| Product | Owns |
| --- | --- |
| Launchpad | Development, releases, deploys, URLs, previews, rollback, inspection |
| Tables | Structured transactional data, migrations, queries, backup, restore |
| Door | Guest identity, sign-in, sharing, teams, roles, app identity |
| Library | Files and permission-aware company knowledge |
| Switchboard | Company vault, OAuth connections, typed tools, scoped app-to-app actions |
| Loops | Declared webhooks, schedules, queues, durable jobs, and operational agents |

No responsibility may have two product owners. Agents are Loops with models and tools, not a separate runtime product.

Ordinary Worker request handlers are part of an app's web runtime. They become Loops only when declared through the durable Loop contract.

## Contract

- `tarantula.json`: provider-neutral desired app architecture.
- `stacks/<name>.json`: environment-specific intent and external references.
- `tarantula.lock.json`: stable, non-secret resource identities safe to commit.
- Remote locked state: authoritative observed infrastructure, ownership, and drift metadata.
- `.tarantula/*`: disposable provider artifacts and local operational cache.

`wrangler.jsonc`, Alchemy programs, or other provider files are never sources of truth.

## Lifecycles

1. Infrastructure: databases, buckets, queues, domains, and other stateful resources.
2. Releases: immutable Worker versions and assets, promoted and rolled back independently.
3. Connections: secret and OAuth references resolved through Switchboard, never copied into app files or infrastructure state.

## Agent workflow

```bash
tarantula plan --stack prod --json
tarantula deploy --stack prod --json
tarantula drift --stack prod --json
tarantula inspect --stack prod --json
tarantula logs --stack prod --json
```

Finite commands have stable versioned JSON, non-zero failure exits, and equivalent human-readable output. Long-running streams need a stable event contract; v0 `logs --json` exposes Wrangler NDJSON until that Tarantula event envelope ships.

## Reconciliation

Tarantula products are the user-facing abstraction. Infrastructure-as-code is an internal reconciliation engine. The engine may use Wrangler, direct Cloudflare APIs, Alchemy, or another adapter; changing it must not change the app contract or state semantics.

`plan` compares desired architecture with locked remote state. `deploy` applies an approved change and emits an immutable release. `drift` reports provider changes made outside Tarantula.

## Delivery stages

- **Available v0:** public Worker + Static Assets, one D1 database, migrations, local development, deploy, readiness, stable URL, inspect, logs, committed lockfile, no-login chat.
- **Next foundation:** named stacks, remote locked state, plan, drift, immutable release history, preview and rollback.
- **Platform coverage:** Door, Library, Switchboard, Loops, custom domains, backup and restore, typed data access, hosted control panel.

Roadmap features must be labelled planned until they work end to end.
