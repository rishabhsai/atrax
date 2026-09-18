# Secrets

Share credentials with trusted app backends.

## Store a credential

Workspace owners and admins manage Secrets in the workspace console or through the same CLI and MCP operations. Credentials are separate from Library. Atrax encrypts stored values and returns metadata only; there is no reveal or download operation.

For CLI writes, pipe a protected file or password-manager output through stdin. Stdin is preserved exactly, including trailing newlines. Keep values out of command arguments, source files, Library, client logs, and agent transcripts.

```
atrax secrets create payments --stdin --key payments-create < /secure/payments-key
atrax secrets list --json
```

## Grant an app access

Choose the apps that need a credential and give each a binding name. A grant trusts the app's backend code and its maintainers with the value. Ordinary members use it through actions they can call; they cannot manage credentials. The backend must keep retrieved values out of its own responses and logs.

```
atrax secrets set-apps <secret-id> --revision 1 --apps <app-id>:PAYMENTS_API_KEY --key payments-grant

// Inside an app action:
const key = await ctx.secrets.get('PAYMENTS_API_KEY');
const response = await fetch('https://api.example.com/records', {
  headers: { Authorization: `Bearer ${key}` }
});
```

Use the revision returned by the latest write or secrets list. The example revision is not a fixed value.

## Rotate or revoke

Rotation replaces the value for every granted app. Each retrieval checks current permissions and reads the current value, so customer rotations need no deployment. A stale revision is rejected; read current metadata before changing it.

Revocation erases Atrax's current stored value and removes all app grants. It does not revoke the credential at its provider, erase previously retrieved copies, or remove historical database backups. Revoke it with the provider too when required.

```
atrax secrets rotate <secret-id> --revision <current-revision> --stdin --key payments-rotate < /secure/replacement-key
atrax secrets revoke <secret-id> --revision <current-revision> --key payments-revoke
```

## Development and agents

Live app actions receive request-scoped access. Preview and candidate environments cannot use live credentials. Ordinary atrax dev has no workspace Secrets connection; use non-sensitive test fixtures for local development.

Agents use the same admin permissions. Inspect secrets.* operation schemas before calling them. Generic CLI writes with sensitive input use atrax call <operation> --stdin; the dedicated secrets commands are simpler. HTTP and MCP clients may record request bodies, so configure their logging and input handling accordingly.
