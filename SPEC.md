# Atrax product spec

Atrax is a cloud for internal software at small businesses. A person uses their existing agent to build an app, run it locally, deploy it into a workspace, and share it with their team.

## Product responsibilities

| Capability | Responsibility |
| --- | --- |
| Apps | Local development, hosting, releases, deployment, app URLs, previews, and recovery |
| Database | App-owned SQL records, ordered migrations, backup, and restore |
| Access | Verified sign-in, workspace membership, app audiences, action permissions, and guest sharing |
| Library | Files and permission-aware company knowledge with revision history |
| Actions | Named app operations and authorized app-to-app calls |

A workspace contains apps, Library, and team membership. An account identifies a person who can belong to more than one workspace. The console and CLI operate the same resources. MCP exposes eligible platform operations to an existing agent.

Secrets and Automation are planned capabilities. Credential management is separate from Library. Hosted agents and scheduled execution are not part of the current release.

## App contract

- `atrax.json` declares web assets, actions, optional `tables` migrations, and app dependencies.
- `atrax.lock.json` retains the hosted app identity and observed release across updates.
- `.atrax/deploy.json` retains an interrupted deployment's artifact and step keys so the CLI can resume it.
- Each stateful app owns its database. Other apps access its records through named actions.
- Static frontends can be imported. Other server runtimes need adaptation to the app contract.

Use [the app contract](https://atrax.run/docs/app-contract/) for exact fields and [the infrastructure model](https://atrax.run/docs/infrastructure-model/) for deployment and state ownership.

## Supported workflow

```bash
atrax new team-chat --template chat
cd team-chat
atrax dev
# Stop local development when ready to publish.
atrax deploy --json
```

Local development needs no account. The first hosted deployment starts verified sign-in and workspace selection. Customers do not need their own Cloudflare account. A new app is company-only by default; its maintainer can restrict its audience, and workspace admins manage external sharing.

An ordinary deployment updates the app while preserving its URL and business data. A release is a built version; a deployment records the attempt to make it run. Destructive data changes and public web publication require the documented confirmations.

## Authoritative references

- [Domain glossary](CONTEXT.md): names and boundaries.
- [Approved launch scope](notes/launch-scope.md): product behavior and deferred work.
- [Console guidance](notes/console-design.md): navigation and user interactions.
- [CLI reference](https://atrax.run/docs/cli/) and `atrax help`: current commands.
- `atrax operations inspect <name>`: exact operation inputs.
- [Launch runbook](docs/operations/launch-runbook.md): release and verification procedure.

Earlier proposals for anonymous hosting and claims, named stacks, and Cloudflare Access account login have been superseded by the workspace system.
