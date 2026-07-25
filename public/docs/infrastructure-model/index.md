# Infrastructure model

Status: mixed

Tarantula products are the user-facing abstraction. Infrastructure-as-code is an internal reconciliation engine.

## Sources

- `tarantula.json`: provider-neutral desired app architecture.
- `stacks/dev.json` and `stacks/prod.json`: environment-specific intent and non-secret references.
- `tarantula.lock.json`: stable resource identities safe to commit.
- Remote locked state: authoritative observed infrastructure, ownership, and drift metadata.

Stacks and remote state are planned. v0 has one implicit stack and a committed lockfile.

## Lifecycles

1. Infrastructure: databases, buckets, queues, domains, and other stateful resources.
2. Releases: immutable Worker versions and static assets.
3. Connections: external secret and OAuth references resolved through Switchboard.

## Planned workflow

```bash
tarantula plan --stack prod --json
tarantula deploy --stack prod --json
tarantula drift --stack prod --json
```

Provider files such as `.tarantula/wrangler.jsonc` are disposable compiled artifacts. Wrangler is the v0 executor. Future engines remain replaceable implementation details behind Tarantula's contract and state semantics.
