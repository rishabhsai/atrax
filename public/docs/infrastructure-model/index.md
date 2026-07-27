# Infrastructure model

Status: mixed

Atrax products are the user-facing abstraction. Infrastructure-as-code is an internal reconciliation engine.

## Sources

- `atrax.json`: provider-neutral desired app architecture.
- `stacks/dev.json` and `stacks/prod.json`: environment-specific intent and non-secret references.
- `atrax.lock.json`: stable resource identities safe to commit.
- Remote locked state: authoritative observed infrastructure, ownership, and drift metadata.

Stacks and remote state are planned. v0 has one implicit stack and a committed lockfile.

## Lifecycles

1. Infrastructure: databases, buckets, queues, domains, and other stateful resources.
2. Releases: immutable Worker versions and static assets.
3. Connections: external secret and OAuth references resolved through Switchboard.

## Planned workflow

```bash
atrax plan --stack prod --json
atrax deploy --stack prod --json
atrax drift --stack prod --json
```

Provider files such as `.atrax/wrangler.jsonc` are disposable compiled artifacts. Wrangler is the v0 executor. Future engines remain replaceable implementation details behind Atrax's contract and state semantics.
