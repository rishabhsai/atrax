# Tarantula account control plane

## Decision

The marketing site stays a static Cloudflare Pages project. The authenticated
account console is a separate Worker with D1. This keeps public content simple
and gives account state one explicit security boundary.

## Identity

- Human login: Cloudflare Access.
- CLI login: short-lived device authorization approved from the account console.
- Session identity: a Tarantula user and workspace derived from the verified
  Access identity.
- CLI credential: a revocable, workspace-scoped token stored outside the app
  repository.

Tarantula account identity is platform identity. Door remains the identity and
authorization product for applications built on Tarantula.

## Project truth

The console does not infer ownership by scraping a provider account. An
authenticated deploy registers:

- project and stack identity;
- active release and stable URL;
- owned resources and their non-secret provider IDs;
- desired-state digest and observed-state digest;
- health and last deployment outcome;
- actor, CLI version, and timestamps.

The authoritative infrastructure record remains locked remote Tarantula state.
The console is a query and operation surface over that state.

## Data

The control-plane D1 database owns:

- users and workspaces;
- workspace memberships and roles;
- CLI device grants and token hashes;
- projects and stacks;
- releases and owned resources;
- activity records;
- connection references.

Raw provider credentials, OAuth refresh tokens, and application secrets do not
belong in this database. Switchboard resolves those from the company vault.

## Minimum API

```text
POST /v1/device/authorizations
POST /v1/device/authorizations/:code/approve
POST /v1/device/token
GET  /v1/me
GET  /v1/projects
GET  /v1/projects/:project/stacks/:stack
PUT  /v1/projects/:project/stacks/:stack
POST /v1/projects/:project/stacks/:stack/releases
GET  /v1/activity
DELETE /v1/tokens/:token
```

Every mutation is workspace-scoped, idempotent, and recorded in the activity
ledger. Browser mutations require a verified Access JWT plus CSRF protection.
CLI mutations require a hashed bearer token with explicit scopes.

## Activation gate

Cloudflare Access is not enabled on the current account. Do not deploy a public
control-plane Worker before Access is enabled and its JWT audience is configured
and verified by the Worker.
