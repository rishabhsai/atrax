# Atrax control plane

The public website and browser console are a static Cloudflare Pages export. The control-plane Worker at `api.atrax.run` owns identity, workspace resources, authorization, and deployment coordination.

## Identity and ownership

People sign in by verified email. Browser sessions and named CLI or agent sessions identify the person making a request. CLI sign-in uses a browser device-approval flow; credentials stay outside the app's source directory.

An account can belong to multiple workspaces. A workspace owns its apps and Library, and its Team page manages membership. Apps have maintainers; their creators do not personally own company resources.

## State and boundaries

Control-plane D1 stores people, sessions, workspaces, memberships, invitations, apps, releases, policies, operation records, and Library metadata. Dedicated R2 bindings store release artifacts and Library file versions. A Durable Object coordinates each app's deployment and recovery work.

Each stateful app has its own database and private runtime. Its public gateway checks identity, audience, action permissions, and schemas before invoking app code. App code never receives the control-plane database, provider credentials, or another app's database binding.

The existing internal Worker RPC export and binding identifiers `Door` and `DOOR` identify the deployed access service. They are deployment contracts, not public product names. Public copy calls the capability Access.

Secrets and third-party OAuth connections are planned. Library stores company knowledge, not credentials. Do not infer a company vault from the Actions capability.

## Shared operation contract

HTTP, console, CLI, and MCP use [the same operation registry](shared/operations.js):

```text
POST /v1/operations/{name}
atrax call <name> --input '<json>' --json
```

Examples include `workspaces.create`, `apps.list`, `actions.call`, and `library.search`. `workspaces.transferOwnership` changes a workspace owner. Writes use stable idempotency keys according to their operation schemas.

The MCP server exposes eligible platform operations as tools. An app's business actions are discovered through `actions.list` and invoked through `actions.call`; each app is not a separate hosted MCP server.

The browser's workspace selector is `/workspaces/`. A selected workspace's app directory is `/workspace/?workspace=<id>`, with Library, Team, and app details under `/workspace/`.

## Operating the service

Read [the launch runbook](docs/operations/launch-runbook.md) for configured environments, storage, email, provider permissions, deployments, and recovery. Read [the security model](https://atrax.run/docs/security/) for access guarantees. Provisioned resource names and migration history are independent of public product labels.
