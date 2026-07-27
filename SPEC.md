# Tarantula product spec

## Position

Tarantula is a cloud for everyone, starting with small companies and coding agents. A coding agent can turn a folder into a working, inspectable app and a shareable URL without operating a cloud console.

The Tarantula account is the hosted control plane for projects, stacks, releases,
resources, activity, connections, and team membership. It reads Tarantula state;
it does not infer ownership by scraping a provider dashboard.

## Products

| Product | Owns |
| --- | --- |
| Launchpad | Runtime, releases, deploys, URLs, previews, rollback, inspection |
| Tables | Structured transactional data, migrations, queries, backup, restore |
| Door | Identity, sessions, sharing, teams, roles, app identity |
| Library | Files and permission-aware company knowledge |
| Switchboard | Company vault, OAuth connections, typed tools, scoped app-to-app actions |
| Loops | Declared webhooks, schedules, queues, durable jobs, and operational agents |

No responsibility may have two product owners. Agents are Loops with models and tools, not a separate runtime product.

Ordinary Worker request handlers are part of an app's web runtime. They become Loops only when declared through the durable Loop contract.

Launchpad runs and releases software. Door controls who can enter it. Neither is a mode of the other.

Tarantula account identity is platform identity. Door provides identity and
authorization to applications built on Tarantula; it does not own sign-in to
the Tarantula control plane.

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

`plan` and `drift` ship in v0 against the single implicit environment; the `--stack` selector arrives with named stacks. Both are read-only. Exit codes are `0` success, `1` error including a plan blocked by an unowned name conflict, and `2` reserved for `drift` when the provider no longer matches the lockfile.

## Delivery stages

- **Available v0:** public Worker + Static Assets, one D1 database, migrations, local development, deploy, readiness, stable URL, plan, drift, inspect, logs, committed lockfile, no-login chat.
- **Available v0:** shared visibility with invite-link membership (Door alpha slice).
- **Available v0:** instant anonymous hosting with claim-or-expire (`tarantula deploy --instant`, `tarantula claim`).
- **Next foundation:** named stacks, remote locked state, immutable release history, preview and rollback.
- **Account foundation:** Access-authenticated console, CLI device authorization, project registration, release and resource views, and activity ledger.
- **Platform coverage:** Door, Library, Switchboard, Loops, custom domains, backup and restore, typed data access, hosted control panel.

Roadmap features must be labelled planned until they work end to end.
