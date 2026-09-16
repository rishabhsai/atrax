# Retry a CLI write

Choose a stable key before creating a workspace, uploading a file, replacing a file, or calling a write operation. Keep that key with the request. Reuse it only for the same operation and input, including the same file bytes and metadata.

```bash
atrax workspace create "New Company" --slug new-company --key company-create-v1 --json
atrax library upload ./brand.md --workspace <workspace-id> --key brand-upload-v1 --json
atrax library replace <item-id> ./brand-v2.md --workspace <workspace-id> --revision <current-revision-id> --reason "Correct brand guidance" --key brand-replace-v2 --json
atrax call library.entry.create --input '{"workspaceId":"<workspace-id>","title":"Brand","text":"Use green."}' --key brand-entry-v1 --json
```

If a response is lost, rerun the identical command with the same key. Atrax returns the original workspace, item, or revision instead of creating another. A key reused with different input fails with `idempotency_conflict`. Change the key only when you intend a separate write, after resolving any uncertain earlier outcome.

JSON success results contain the saved workspace and membership or Library item and revision identifiers. An unreadable or interrupted response reports `operation_outcome_unknown`; `error.details.operation` and `error.details.key` identify the request to reconcile. Other API failures retain the platform error code and include this request context. Every retry uses current credentials and permissions; a stored receipt does not restore revoked access.

Without `--key`, the CLI generates a new key for each invocation. Repeating that command is a new request and cannot safely reconcile a lost response. The generic `atrax call` command currently has the same default; MCP requires an explicit key for writes.

`atrax deploy` saves its artifact and step keys in `.atrax/` before remote changes. Rerun `atrax deploy` to resume an interrupted attempt, including after source edits. Preserve `.atrax/deploy.json`, `.atrax/deploy-artifact.json`, and `atrax.lock.json` so it can reconcile the original app and release.
