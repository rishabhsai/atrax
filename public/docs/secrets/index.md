# Secrets

Credential storage and app bindings prepared for the next release.

## Release availability

Secrets is implemented in the 0.3.0 source candidate and is not yet available on the hosted service. The public CLI remains 0.2.2. The commands and backend API on this page describe the upcoming release.

Use these instructions after the matching CLI and hosted rollout are published. Workspace credentials belong in Secrets, separately from company files and guidance in Library.

## Choose who can manage and use a credential

- Workspace owners and admins create, rename, rotate, grant, and revoke credentials. Listing metadata also requires an owner or admin.
- An app grant trusts the app backend and its maintainers with the credential. People call that backend through their permitted app actions.
- An agent acts with the current permissions of the person who connected it. An agent session does not grant extra credential access.
- Management returns metadata only. There is no operation to reveal or download a stored value.

## Store a credential

Sign in and select the workspace. Pipe a protected file or password-manager output through stdin. Keep the value out of command arguments, source control, Library, and agent transcripts.

The CLI preserves stdin exactly, including a trailing newline. Check the input format expected by the credential provider. A value must contain 1 to 16,384 characters.

The create result includes the credential ID, revision, and an empty app-grant list. Save the ID. Creation does not grant any app access.

```
atrax login
atrax workspace use WORKSPACE_ID
atrax secrets create payments --stdin --key payments-create-v1 < /secure/payments-key
atrax secrets list --json
```

## Grant named bindings to apps

Read the current metadata and choose a binding name for each trusted app. Apps must belong to the same workspace. Binding names start with an uppercase letter and contain only uppercase letters, digits, and underscores, up to 64 characters.

set-apps replaces the complete grant list. Include every app that should retain access. Each app can have one binding for this credential, and a binding name cannot identify two credentials in the same app.

Replace SECRET_ID, APP_ID, and CURRENT_REVISION with observed values. Every successful change returns a new revision.

```
atrax secrets list --json
atrax secrets set-apps SECRET_ID --revision CURRENT_REVISION --apps APP_ID:PAYMENTS_API_KEY --key payments-grant-v1
```

Removing one app means submitting the remaining grants. Use --apps none to remove all grants while retaining the stored credential.

## Read the binding in a live action

After the Secrets release is available, rebuild existing apps with the matching CLI and deploy them normally once. Preserve their lockfiles. Older deployed runtimes do not provide ctx.secrets.get or the required gateway binding.

The action handler retrieves the binding through its request context. Each retrieval checks the live invocation and current app grant, then returns the current credential value.

Keep the value inside the trusted backend. Do not return it to the browser, include it in an action result, or write it to logs. An app grant cannot prevent trusted application code from copying a retrieved value.

```
async handler(input, ctx) {
	const key = await ctx.secrets.get('PAYMENTS_API_KEY');
	const response = await fetch('https://api.example.com/records', {
		headers: { Authorization: `Bearer ${key}` }
	});
	return { ok: response.ok };
}
```

## Rotate a value or revoke access

For rotation, read the latest revision and supply the replacement value through stdin. Future retrievals use the replacement without an app redeployment. A value already retrieved by an in-flight action is not recalled.

To stop app access temporarily, remove the grants with set-apps. To revoke the credential permanently, use revoke. Revocation erases the current stored value, removes every grant, and leaves the metadata marked revoked.

Revocation does not invalidate the credential at its provider, erase copies already retrieved, or remove historical database backups. Revoke or rotate it with its provider when necessary. A revoked Atrax credential cannot be reactivated.

```
atrax secrets rotate SECRET_ID --revision CURRENT_REVISION --stdin --key payments-rotate-v2 < /secure/replacement-key

# Read the new revision before a separate change.
atrax secrets list --json
atrax secrets revoke SECRET_ID --revision CURRENT_REVISION --key payments-revoke-v1
```

## Handle conflicts and retries

- revision_conflict: read current metadata, review the other change, and submit your revised intent with that revision and a new key.
- idempotency_conflict: the key was already used with different input. Reuse a key only to retry the exact same request.
- secret_changed: inspect the app workspace and existing binding names, then refresh the metadata before resubmitting.
- secret_not_available: the live action cannot retrieve that binding. Check its spelling and the app grant.
- secret_revoked: create a new credential if the app needs access again.

If a response is lost, retry the original input and key first. A saved receipt can confirm the completed write without repeating it.

## Local development, previews, and agents

Ordinary atrax dev has no workspace Secrets connection. Preview and deployment-candidate environments cannot retrieve live credentials. Use non-sensitive fixtures for those checks.

After the release, inspect secrets.* operation schemas before using the generic CLI or MCP interface. Dedicated secrets commands keep values on stdin. HTTP and MCP clients can record request bodies, so choose input and logging settings that keep credentials out of transcripts.

```
atrax operations inspect secrets.create --json
atrax operations inspect secrets.setApps --json
```
