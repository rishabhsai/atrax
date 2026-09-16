# CLI reference

One CLI for app creation, deployment, company knowledge, and agent operations.

## App commands

- atrax new <name> --template chat|static|inventory|orders
- atrax init <name> --assets <directory> [--actions <entry>] [--migrations <directory>]
- atrax build or atrax doctor: validate and build the actual artifact.
- atrax dev --port 8787: run the app with persistent local data.
- atrax deploy --dry-run: build without changing hosted resources.
- atrax deploy --access access.json: choose initial audiences for new actions. Existing policies remain unchanged.
- atrax link <app-id>: refresh this checkout’s observed release after reviewing a teammate’s changes. Refuses unfinished deployments or a different linked app.
- atrax deploy --workspace <id> --json: deploy or resume a saved attempt.

## Identity and workspaces

Login uses a one-time browser approval. Credentials are stored outside the app in the user configuration directory with owner-only file permissions. Logout revokes the session before removing the saved credential.

```
atrax login --agent "Operations agent"
atrax workspace list --json
atrax workspace create "Acme" --slug acme --key create-acme-v1
atrax workspace use <workspace-id>
atrax logout
```

## Library commands

To replace a file, use library replace <item-id> <file> --revision <current-revision-id> --reason <correction>. Downloads refuse to overwrite an existing local file.

```
atrax library upload ./brand.md --workspace <id> --key brand-v1
atrax library search "brand" --workspace <id> --json
atrax library get <item-id> --workspace <id> --json
atrax library download <item-id> --workspace <id> --out ./brand-copy.md
```

## Every platform operation

The operation schemas at /operations.json describe the exact inputs for the HTTP, CLI, and MCP interfaces. For a write, choose a stable --key and reuse it only when retrying the same intent.

```
atrax call apps.list --input '{"workspaceId":"<id>"}' --json
atrax call actions.list --input '{"appId":"<id>"}' --json
```

## Structured results

--json writes schemaVersion 1 envelopes. Success contains result; failure contains a stable error code, message, and optional recovery details. Device sign-in can emit an authorization-required progress result before the final result. MCP owns stdout for JSON-RPC and does not use CLI result envelopes.
