# Retry a CLI write

Choose a stable key before creating a workspace, uploading or replacing a file, changing a credential, or calling a write operation. Keep that key with the request. Reuse it only for the same operation and input, including the same file bytes, metadata, and credential input.

```bash
atrax workspace create "New Company" --slug new-company --key company-create-v1 --json
atrax library upload ./brand.md --workspace <workspace-id> --key brand-upload-v1 --json
atrax library replace <item-id> ./brand-v2.md --workspace <workspace-id> --revision <current-revision-id> --reason "Correct brand guidance" --key brand-replace-v2 --json
atrax call library.entry.create --input '{"workspaceId":"<workspace-id>","title":"Brand","text":"Use green."}' --key brand-entry-v1 --json
atrax secrets create Payments --workspace <workspace-id> --stdin --key payments-create-v1 --json < ./payments.key
atrax secrets update <secret-id> --workspace <workspace-id> --revision <secret-revision> --name Payments --description "Payment service credential" --key payments-metadata-v1 --json
atrax secrets set-apps <secret-id> --workspace <workspace-id> --revision <secret-revision> --apps <app-id>:PAYMENTS_API_KEY --key payments-grant-v1 --json
atrax secrets rotate <secret-id> --workspace <workspace-id> --revision <secret-revision> --stdin --key payments-rotate-v2 --json < ./payments-next.key
atrax secrets revoke <secret-id> --workspace <workspace-id> --revision <secret-revision> --key payments-revoke-v1 --json
```

The Secrets examples use protected local files containing only the credential value. Keep those files readable only by you, such as with mode `600`, or pipe from a password manager. Stdin is preserved exactly, including trailing newlines. Never put credentials in command arguments. Substitute the secret ID returned by create and the current metadata revision before each new change. Revoke permanently removes the stored value and app grants.

If a response is lost, rerun the identical command with the same key. Atrax returns the original workspace, item, revision, or credential metadata instead of creating another. A key reused with different input fails with `idempotency_conflict`. Change the key only when you intend a separate write, after resolving any uncertain earlier outcome.

JSON success results contain the saved workspace and membership or Library item and revision identifiers. Secrets results contain metadata and its revision, never the credential value. Retrying an earlier credential write after rotation or revocation returns its original metadata receipt without restoring the old value or grants. An unreadable or interrupted response reports `operation_outcome_unknown`; `error.details.operation` and `error.details.key` identify the request to reconcile. Other API failures retain the platform error code and include this request context. Every retry uses current credentials and permissions; a stored receipt does not restore revoked access.

Without `--key`, the CLI generates a new key for each invocation. Repeating that command is a new request and cannot safely reconcile a lost response. The generic `atrax call` command currently has the same default; MCP requires an explicit key for writes.

`atrax deploy` saves its artifact and step keys in `.atrax/` before remote changes. Rerun `atrax deploy` to resume an interrupted attempt, including after source edits. Preserve `.atrax/deploy.json`, `.atrax/deploy-artifact.json`, and `atrax.lock.json` so it can reconcile the original app and release.

For complete CLI and MCP examples with their expected results, use `atrax recipes list` or read [Run Atrax workflows with an existing agent](agent-recipes.md). Inspect an operation's current schema with `atrax operations inspect <name> --json`.
