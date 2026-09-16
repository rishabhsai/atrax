# Run Atrax workflows with an existing agent

Agents act with the signed-in person's current permissions. Hosted agents and independently authorized unattended agents are outside this launch.

Inspect the installed operation contract without a website or sign-in:

```sh
atrax operations list --json
atrax operations inspect library.entry.revise --json
atrax recipes list --json
atrax recipes show library --json
```

Discovery includes all registry operations, their input schemas, effects, authentication, scope, MCP availability, and retry-key expectations. Scope describes the resource identified by the input; the server resolves its current permissions. Identity proof and browser approval operations are listed but excluded from MCP.

Run these examples in order, or supply the identifiers from your existing workspace and app. Replace angle-bracket placeholders with saved result values. CLI commands return the standard envelope; field paths below start at its `result`. MCP calls return those fields in `structuredContent`. An MCP error has `isError: true` and `structuredContent.error.code`.

Connect the saved agent session over stdio after browser approval:

```sh
atrax mcp --workspace <workspace-id>
```

Choose stable keys before writes and keep them with the input. See [Retry a CLI write](cli-writes.md). The CLI's absent-key default creates a fresh key; MCP requires an explicit key for each write. A key never grants permission.

## Connect an agent to your workspace

Use your verified email and approve the device code in the browser. Create a workspace only if your business needs a new one; otherwise list and select your existing workspace.

An agent inherits the person who approves its device code. It cannot approve its own identity through MCP.

Expected denial: `forbidden`. An agent session tries to approve a device authorization. A browser session must approve it.

### Sign in and approve the displayed code

```sh
atrax login --agent 'Operations assistant' --json
```

Expected CLI result fields: `person.id`, `session.id`, `session.kind`.

Open verificationUri, verify your email, and approve the matching userCode. Wait for the final success result. Never give an agent your email proof or session token.

### Create a workspace for this example

```sh
atrax workspace create 'Example Company' --slug example-company --key example-company-create-v1 --json
```

Expected CLI result fields: `workspace.id`, `membership.role`.

Use `workspace.id` as `<workspace-id>`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_workspaces_create",
  "arguments": {
    "input": {
      "name": "Example Company",
      "slug": "example-company"
    },
    "key": "example-company-create-v1"
  }
}
```

Expected MCP structuredContent fields: `workspace.id`, `membership.role`.

### List your workspaces

```sh
atrax workspace list --json
```

Expected CLI result fields: `workspaces`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_workspaces_list",
  "arguments": {}
}
```

Expected MCP structuredContent fields: `workspaces`.

### Select the workspace in this CLI

```sh
atrax workspace use '<workspace-id>' --json
```

Expected CLI result fields: `workspace.id`, `membership.role`.

The CLI saves this selection. The MCP form inspects the workspace; scope the MCP server with --workspace to select it for tools.

Equivalent MCP tool call:

```json
{
  "name": "atrax_workspaces_get",
  "arguments": {
    "workspaceId": "<workspace-id>"
  }
}
```

Expected MCP structuredContent fields: `workspace.id`, `membership.role`.

## Deploy Inventory and share it privately

Create the supplied Inventory app, deploy it into the selected workspace, and invite one exact email address. Run deployment from the generated app directory.

Any current member can create an app and becomes its maintainer. Only a workspace owner or admin can invite external guests. A guest invitation does not grant workspace membership or Library access.

Expected denial: `forbidden`. An ordinary member tries to invite an external guest, even when that member can open the app.

Expected denial: `invitation_email_mismatch`. Someone signed in with another email tries to accept the invitation.

Expected denial: `forbidden`. The accepted guest tries to open a different app that was not shared with them.

### Create the Inventory checkout

```sh
atrax new recipe-inventory --template inventory --json
```

Expected CLI result fields: `directory`, `name`.

Use `directory` as `<app-directory>`.

Local app creation and builds run through the CLI. There is no MCP tool that reads and builds your local source directory.

### Deploy from the app directory

Run from `<app-directory>`.

```sh
atrax deploy --workspace '<workspace-id>' --json
```

Expected CLI result fields: `appId`, `releaseId`, `deploymentId`, `url`, `state`.

Use `appId` as `<app-id>`, `releaseId` as `<release-id>`, `url` as `<app-url>`.

Deployment saves its artifact and step keys before remote changes. Rerun this command to resume an interrupted attempt.

### Invite a guest to this app and its stock list

```sh
atrax share guest@example.com --app '<app-id>' --actions stock.list --key inventory-guest-v1 --json
```

Expected CLI result fields: `appId`, `url`, `invitation.id`, `audience.publicWeb`, `workspaceAccessRemainsInEffect`.

Use `invitation.id` as `<guest-invitation-id>`.

The recipient opens the invitation email, signs in with guest@example.com, and accepts it in the browser. Another email cannot accept it. Workspace access remains in effect; this command does not make the app public.

Equivalent MCP tool call:

```json
{
  "name": "atrax_apps_guests_invite",
  "arguments": {
    "input": {
      "appId": "<app-id>",
      "email": "guest@example.com",
      "actionNames": [
        "stock.list"
      ]
    },
    "key": "inventory-guest-v1"
  }
}
```

Expected MCP structuredContent fields: `invitation.id`, `invitation.status`.

## Discover and call permitted app actions

Inspect the deployed Inventory actions and their schemas before calling them. The reservation uses orderId as its business key.

App access and the named action permission are checked on every call. An explicitly denied action fails through both CLI and MCP, even if the person can open the app.

Expected denial: `forbidden`. The current person is explicitly denied the named action. CLI and MCP return the same denial.

### Discover current action schemas

```sh
atrax call actions.list --input '{"appId":"<app-id>"}' --json
```

Expected CLI result fields: `appId`, `releaseId`, `actions`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_actions_list",
  "arguments": {
    "appId": "<app-id>"
  }
}
```

Expected MCP structuredContent fields: `appId`, `releaseId`, `actions`.

### Read available stock

```sh
atrax call actions.call --input '{"appId":"<app-id>","actionName":"stock.list","input":{}}' --key inventory-read-v1 --json
```

Expected CLI result fields: `result.items`, `invocationId`.

stock.list is a read. The platform actions.call tool is conservatively classified as a write, so its MCP wrapper still requires a key.

Equivalent MCP tool call:

```json
{
  "name": "atrax_actions_call",
  "arguments": {
    "input": {
      "appId": "<app-id>",
      "actionName": "stock.list",
      "input": {}
    },
    "key": "inventory-read-v1"
  }
}
```

Expected MCP structuredContent fields: `result.items`, `invocationId`.

### Reserve one unit exactly once

```sh
atrax call actions.call --input '{"appId":"<app-id>","actionName":"stock.reserve","input":{"orderId":"recipe-order-1","sku":"paper-a4","quantity":1}}' --key recipe-order-1 --json
```

Expected CLI result fields: `result.orderId`, `result.status`, `invocationId`.

Retry the identical input and key to receive the original reservation. A different order is a new intent and needs its own orderId and key.

Equivalent MCP tool call:

```json
{
  "name": "atrax_actions_call",
  "arguments": {
    "input": {
      "appId": "<app-id>",
      "actionName": "stock.reserve",
      "input": {
        "orderId": "recipe-order-1",
        "sku": "paper-a4",
        "quantity": 1
      }
    },
    "key": "recipe-order-1"
  }
}
```

Expected MCP structuredContent fields: `result.orderId`, `result.status`, `invocationId`.

## Contribute and correct company knowledge

Upload a source document, find it, create guidance, and explicitly correct that guidance from the revision you observed.

Current workspace members and their agents can contribute. Selected item audiences and source permissions still apply. External guests cannot read Library. A removed member or revoked session fails on the next call.

Expected denial: `forbidden`. An external guest tries to search the workspace Library.

Expected denial: `unauthorized`. The saved agent session is revoked. The next CLI or MCP operation fails.

Create `brand.md` with this content:

```text
Brand guidance: use green.
```

### Upload the brand document

```sh
atrax library upload ./brand.md --workspace '<workspace-id>' --key brand-upload-v1 --json
```

Expected CLI result fields: `item.id`, `revision.id`, `revision.file.sha256`.

Use `item.id` as `<file-item-id>`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_library_file_upload",
  "arguments": {
    "input": {
      "workspaceId": "<workspace-id>",
      "filename": "brand.md",
      "contentType": "text/markdown",
      "contentBase64": "QnJhbmQgZ3VpZGFuY2U6IHVzZSBncmVlbi4K"
    },
    "key": "brand-upload-v1"
  }
}
```

Expected MCP structuredContent fields: `item.id`, `revision.id`, `revision.file.sha256`.

### Find accessible brand guidance

```sh
atrax library search brand --workspace '<workspace-id>' --json
```

Expected CLI result fields: `items`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_library_search",
  "arguments": {
    "workspaceId": "<workspace-id>",
    "query": "brand"
  }
}
```

Expected MCP structuredContent fields: `items`.

### Read the saved source and its revision

```sh
atrax library get '<file-item-id>' --workspace '<workspace-id>' --json
```

Expected CLI result fields: `item.id`, `revision.id`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_library_get",
  "arguments": {
    "workspaceId": "<workspace-id>",
    "itemId": "<file-item-id>"
  }
}
```

Expected MCP structuredContent fields: `item.id`, `revision.id`.

### Save explicit company guidance

```sh
atrax call library.entry.create --input '{"workspaceId":"<workspace-id>","title":"Brand preference","text":"Use green for the company brand."}' --key brand-entry-v1 --json
```

Expected CLI result fields: `item.id`, `revision.id`, `revision.author.personId`.

Use `item.id` as `<knowledge-item-id>`, `revision.id` as `<knowledge-revision-id>`.

Equivalent MCP tool call:

```json
{
  "name": "atrax_library_entry_create",
  "arguments": {
    "input": {
      "workspaceId": "<workspace-id>",
      "title": "Brand preference",
      "text": "Use green for the company brand."
    },
    "key": "brand-entry-v1"
  }
}
```

Expected MCP structuredContent fields: `item.id`, `revision.id`, `revision.author.personId`.

### Correct the observed revision

```sh
atrax call library.entry.revise --input '{"workspaceId":"<workspace-id>","itemId":"<knowledge-item-id>","baseRevisionId":"<knowledge-revision-id>","text":"Use forest green for the company brand.","reason":"The team specified the shade."}' --key brand-entry-v2 --json
```

Expected CLI result fields: `item.id`, `revision.id`, `revision.number`.

If another correction wins first, revision_conflict includes currentRevisionId. Read the current guidance before making a new correction; do not reuse the old key with changed input.

Equivalent MCP tool call:

```json
{
  "name": "atrax_library_entry_revise",
  "arguments": {
    "input": {
      "workspaceId": "<workspace-id>",
      "itemId": "<knowledge-item-id>",
      "baseRevisionId": "<knowledge-revision-id>",
      "text": "Use forest green for the company brand.",
      "reason": "The team specified the shade."
    },
    "key": "brand-entry-v2"
  }
}
```

Expected MCP structuredContent fields: `item.id`, `revision.id`, `revision.number`.

## Verify locally

```sh
node scripts/generate-agent-recipes.mjs --check
node --test tests/agent-recipes.test.mjs
```

The tests execute these examples against the local control-plane Worker, D1, R2, gateway, app runtime, and MCP stdio transport. Email goes only to the local mailbox using example.com addresses. The external Cloudflare provisioning API is simulated; these checks do not claim a live deployment.
