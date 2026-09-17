# Atrax naming audit

September 16, 2026. Source inspected at `bfd94f7`.

Status: the user approved this naming system for implementation. This audit records the pre-change evidence and rationale; current definitions live in `CONTEXT.md`.

## Conclusion

The underlying model distinguishes the concepts reasonably well. The public language asks customers to learn a second vocabulary for the same capabilities.

Marketing and product docs use Launchpad, Door, and Switchboard. The README, console, CLI, and operation registry mostly use Apps, Access, and Actions. A customer looking for Switchboard after signing in finds App actions instead. A customer installing the CLI never uses a Launchpad command.

Recommend one visible vocabulary based on Apps, Database, Access, Library, and Actions. Keep Workspace as the shared ownership and membership scope. CLI and MCP describe ways to use those capabilities. They are not additional resources inside an app.

## Findings

### 1. Product brands and task names compete

Evidence:

- `app/lib/content.ts:4`, `:91`, and `:175` name Launchpad, Door, and Switchboard.
- `README.md:36` lists Apps, Access, and Actions for the same capabilities.
- `components/console/AppOverview.tsx:169` says App actions; `components/console/SharingPanel.tsx:446` says Access.
- `cli/main.mjs:10` offers app creation, deployment, workspace, Library, and operation commands, without those product brands.

These are valid distinctions between a product brand and its function, not duplicate backend systems. The cost is unnecessary translation between discovery and use. Use the functional names consistently in marketing, docs, and console headings.

### 2. Launchpad and Workspace are different concepts with overlapping descriptions

`CONTEXT.md:10` defines Launchpad as hosting and deployment. `CONTEXT.md:34` defines Workspace as the business's shared home. But Launchpad's card calls it a stable home for company tools (`app/lib/content.ts:8`). Workspace creation also describes a shared home (`components/console/CreateWorkspace.tsx:28`).

Keep Workspace for ownership, membership, and shared resources. Replace Launchpad with Apps or describe it explicitly as app hosting. Do not rename the workspace to Launchpad. Apps are deployed into a workspace, and a workspace contains more than hosted apps.

The README opening adds another collision: "Atrax is a company workspace" (`README.md:3`). Use the approved platform description from `CONTEXT.md:3`; Atrax can contain multiple workspaces.

### 3. Account opens workspace selection

The public header says Account (`app/components/SiteHeader.tsx:81`). Its route renders `WorkspaceConsole` (`app/account/page.tsx:13`), which shows Your workspaces (`components/console/WorkspaceConsole.tsx:33`). Personal identity and workspace selection are different jobs.

Recommend Workspaces for that destination. Reserve Account for the person's identity and sessions. Use Sign in when the action actually begins sign-in. A company or workspace is not the person's account.

### 4. Home hides the name of the app directory

The workspace rail says Home (`components/console/ConsoleFrame.tsx:42`). The page heading also says Home, then renders `AppDirectory` (`components/console/WorkspaceConsole.tsx:269`).

Recommend Apps as the label and heading of this existing destination. Do not introduce a second Apps page beside Home. Workspace remains the selected company context above the navigation.

### 5. MCP appears at the same level as app resources

The public catalog puts MCP beside Tables and Library (`app/lib/content.ts:214`). The implementation exposes Atrax's operation registry through an MCP server (`cli/mcp.mjs:49`). It is an interface used by an existing agent, not another workspace data store or a hosted agent.

Keep the recognizable term MCP in technical references. Present it under For agents or describe it as connecting an agent. Do not describe each deployed app as a separate MCP server: today an Atrax MCP connection discovers and invokes app actions through `actions.list` and `actions.call` (`docs/mcp.md:48`).

### 6. The glossary does not cover the full public vocabulary

`CONTEXT.md` defines Launchpad, Door, Tables, and Library, but does not define Switchboard, Loops, Account, Platform operation, or MCP tool. It also lacks Deployment, although the infrastructure docs distinguish deployments from releases (`app/lib/docs.ts:167`).

Once the vocabulary is chosen, update the single glossary and current product guidance together. Older design notes describe Members navigation and routes that differ from the implemented Team destination (`notes/console-design.md:7`, `:84`; `components/console/ConsoleFrame.tsx:61`). Mark historical proposals as historical instead of allowing them to redefine the current model.

### 7. There is one concrete operation namespace inconsistency

`shared/operations.js:32` uses `workspaces.create/list/get`, but `:40` defines `workspace.transferOwnership`. The difference is exported to CLI discovery, HTTP, and generated MCP tool names (`shared/operation-discovery.js:11`).

Recommend `workspaces.transferOwnership`, migrated across registry, dispatcher, implementation, callers, recipes, generated docs, and tests in one change. Do not add a permanent alias. This is separate from the legitimate singular CLI group `atrax workspace`.

### 8. Two smaller labels need more precision

- Workspace address actually edits a slug (`components/console/CreateWorkspace.tsx:72`), while console navigation uses an ID-based query (`components/console/api.ts:484`). Prefer Workspace handle, or explain and display the actual address if an address becomes a supported feature.
- Company in the site footer means information about Atrax (`app/components/SiteFooter.tsx:36`), while company elsewhere means the customer's business. Rename that link About Atrax.

## Recommended public vocabulary

| Current wording | Recommendation | Meaning |
| --- | --- | --- |
| Atrax / company workspace | Atrax | The platform |
| Workspace / company workspace | Workspace | Shared ownership, membership, apps, and Library |
| Launchpad | Apps | Build, run, host, and update an app |
| Home | Apps | The existing directory inside a workspace |
| Tables | Database | An app's SQL database, when declared; not a separately provisioned shared database product |
| Door | Access | Sign-in, app audiences, action permissions, and sharing |
| Switchboard | Actions | Named app capabilities that authorized people, agents, and other apps can invoke |
| Library / company knowledge / shared context | Library | The collection; company knowledge describes its contents, and shared context describes how they are used |
| MCP | MCP, under For agents | A connection protocol for existing agents |
| Loops | Automation, planned | Scheduled and background execution; not ordinary request-driven actions |
| Shared secrets / credentials / vault | Secrets, planned | API keys and credentials, separate from Library |
| Account, on the workspace-entry link | Workspaces | Choose or create a workspace |
| Company, in the footer | About Atrax | Information about the platform and its company |

Database is a capability label. Do not imply a database browser or standalone database provisioning already exists. Likewise, Secrets and Automation remain planned, regardless of their names.

## Distinctions to preserve

- Account: one person's identity, which can access multiple workspaces.
- Workspace: the shared scope that owns apps and membership.
- Team: the workspace's people-management destination. Member is a relationship or role within it; Guest is access to particular apps without workspace membership.
- App: software with a stable identity and URL. A project is its local source directory, not another cloud ownership container.
- Action: business behavior supplied by an app, such as `inventory.reserve`.
- Platform operation: an Atrax request, such as `apps.create` or `actions.call`.
- MCP tool: a protocol-exposed platform operation, such as `atrax_actions_call`. Its `actionName` can identify a particular app action.
- Release: a built version of an app. Deployment: the attempt or process that makes a release run. Retrying a deployment need not create a new app or release.
- Library: the collection of files and knowledge entries. The runtime `knowledge` capability is scoped to company-knowledge work; it need not be renamed simply because the collection is called Library.
- Access: permission. Sharing: the act of granting or adjusting permission. Use App access and Action access when their distinction matters.
- Public web: public static assets. It does not mean anonymous access to app actions or company knowledge (`components/console/ExternalSharingPanel.tsx:176`).

Use Everyone in the workspace as the operational audience label and company-only as its short explanation when no external access has been granted. Keep guest access and public web visible separately; the workspace audience alone does not describe the complete effective audience.

## Proposed navigation and explanation

Workspace selector, followed by Apps, Library, and Team. Inside an app, keep the existing overview, access, and action content under those same terms. This naming proposal does not require extra pages or new management features.

One explanation should work everywhere:

"Your workspace holds your team's apps and company knowledge. Each app keeps its own data and exposes actions. People use the apps; authorized agents and other apps can call those actions."

## Implementation scope after the naming decision

1. Update `CONTEXT.md`, `PRODUCT.md`, and current console guidance with the same meanings.
2. Apply the labels to `app/lib/content.ts`, header/footer, console headings, and README.
3. Update product/docs route identifiers, related links, metadata, artwork keys, and `app/lib/docs.ts` together. Regenerate Markdown, docs JSON, and agent indexes with `scripts/generate-docs.mjs`; remove obsolete generated documents rather than hand-editing exports.
4. Preserve valid domain and protocol distinctions. A display-name change does not require renaming database columns, app IDs, or the `tables` manifest field. Correct the singular ownership-transfer operation as its own coordinated contract change.
5. Verify that a person can follow a product page to docs and into the console or CLI using the same terms. Check all renamed links and the generated agent operation references.

Verification for this audit: source inspection of the marketing catalog, navigation, console callers, README, public and source docs, CLI help/dispatch, operation registry, and MCP tool registration. No runtime behavior was changed or retested.
