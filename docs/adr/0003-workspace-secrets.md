# Shared workspace credentials

## Decision

Workspace admins store credentials separately from Library and grant selected apps permission to use them. Agents acting for those admins use the same management operations. Management returns metadata only. There is no platform operation for reading a credential value.

An app action uses `await ctx.secrets.get('PAYMENTS_API_KEY')`. The gateway passes its request-scoped capability to the trusted Secrets entrypoint. Secrets rechecks the originating invocation, person, session, action access, app grant, and active release before decrypting the current value. The invocation must belong to the live environment. Previews and candidate deployments cannot receive live credentials.

An app grant trusts the app's backend code and its maintainers with the plaintext credential. App code can send, log, or return values it receives. The platform cannot prevent a deliberately granted app from disclosing its own credentials. Credential management responses, activity, operation receipts, and platform error messages contain no values. Backend authors must keep values out of their own logs and responses.

## Storage and changes

The control plane owns encrypted values in D1. AES-256-GCM uses a fresh random nonce and authenticates the workspace and secret IDs. `SECRETS_ENCRYPTION_KEY` is a base64-encoded random 32-byte Worker secret on the control plane. HKDF derives separate encryption and receipt authentication keys. Request receipts use an HMAC rather than an unkeyed hash that could reveal low-entropy passwords through guessing.

The master key must be backed up using the operator's credential process. Replacing it without re-encrypting existing values makes them unreadable. Customer rotation replaces an individual credential value; master-key rollover is a separate operator procedure and is not implemented here.

All writes require a retry key. Revisions prevent stale changes from overwriting newer metadata, grants, rotations, or revocations. D1 commits the receipt, state change, and value-free activity together after rechecking current administrator/session authority. Retried successful writes return their original metadata receipt. They never restore an old value or grant.

Each app binding name selects at most one credential. Grants and values are resolved on each backend request, so rotation and revocation need no per-app deployment. A request that already received a value may finish using it; revocation cannot erase plaintext already held by app code or revoke the credential at its external issuer. Future resolutions use the new value or fail after revocation. Revocation erases current ciphertext and grants. It does not erase old database backups.

## Alternatives

Copying a credential into each app's Worker bindings would make runtime reads local, but partial fleet deployment could leave old values or revoked grants active. Central resolution keeps one state owner.

An outbound HTTP proxy could inject credentials without giving plaintext to app code. That would restrict credentials to selected HTTP authentication patterns and would still need to trust upstream responses not to echo credentials. The backend access model matches the existing app runtime and supports credentials needed by ordinary application libraries.

## Interfaces

- `secrets.list` returns metadata, revision, status, and app bindings for active and revoked credentials.
- `secrets.create` stores a value with a name and optional description.
- `secrets.update`, `secrets.rotate`, `secrets.setApps`, and `secrets.revoke` require the current `baseRevision`.
- All management operations require current workspace owner/admin authority. Ordinary members use credentials only through actions they may invoke on granted apps.

CLI create and rotate accept values only through `--stdin`, preserving input exactly. Read a protected file or pipe from a password manager; never put the value in a command argument. For example:

```sh
atrax secrets create payments --stdin --key payments-create < /secure/payments-key
atrax secrets list
atrax secrets set-apps SECRET_ID --revision 1 --apps APP_ID:PAYMENTS_API_KEY --key payments-grant
atrax secrets rotate SECRET_ID --revision 2 --stdin --key payments-rotate < /secure/replacement-key
atrax secrets revoke SECRET_ID --revision 3 --key payments-revoke
```

The references above contain IDs and labels, not credential values. Generic HTTP/MCP clients must keep write request bodies out of their own logs and conversation transcripts.

## Local development

`atrax dev` provides app data and local actions without a workspace sign-in. It does not contain workspace credentials or an implicit environment-variable fallback for `ctx.secrets`. Credential calls fail when no Secrets service is connected. Use non-sensitive app test fixtures for ordinary local work. `tests/secrets.test.mjs` runs the complete control plane, app gateway, runtime, and D1 locally with a disposable encryption key and verifies the real credential path. Hosted deployment connects the live gateway to Secrets; grants and customer rotations then take effect without redeployment.
