# Atrax platform map

Source inspection on September 14, 2026. This map covers the product model, website and console, agent documentation, CLI, hosting control plane, app template, packaging, and existing tests. It is not a live deployment audit. No tests or production operations were run for this exploration.

The agreed requirements live in [launch-scope.md](./launch-scope.md), vocabulary in [CONTEXT.md](../CONTEXT.md), and competitor findings in [lakebed-agent-first-research.md](./lakebed-agent-first-research.md). The recommendations below remain proposals where the interview has not settled them.

## Product understanding

Atrax hosts the software a small business uses. People and their agents share access to apps, business operations, and company knowledge through a workspace. Apps belong to the business, keep their own operational data, and expose named actions other authorized callers can use.

The user selected Inventory + Orders as the main launch example. An order reserves stock through Inventory, using the same business operation whether started by a person in an interface or by their agent. Shared context should make this workflow understand the business's policies and decisions. Background execution is a further scope decision.

Latest interview update: hosted agents and background automations are deferred. The user brings their agent; Atrax hosts the business apps and exposes operations and company knowledge. App actions default to workspace-wide access, with maintainers selecting an audience and per-person action restrictions at deployment. GitHub retains source hosting and code collaboration; Atrax provides the simpler cloud-platform experience. Optional isolated previews remain hosting behavior.

## What the six products mean

| Product | Responsibility in the existing design | Source-inspected implementation |
| --- | --- | --- |
| Launchpad | Run apps, deploy releases, maintain URLs, inspect, preview, recover releases | Local runtime and both hosting paths exist. Preview, controlled promotion, and rollback do not. |
| Tables | Transactional business data, migrations, queries, backup and restore | One D1 per app, persistent local data, ordered migrations, export. No restore operation or shared typed business-action layer. |
| Door | Identity, app access, team membership, sessions, app identity | Template-owned invite gate and per-app members. No workspace membership, verified returning email sign-in, or platform-enforced company boundary. |
| Library | Files and company knowledge, sources, permissions, search, freshness | Planned documentation and illustrative product UI. No storage, retrieval, or knowledge API. |
| Switchboard | Connections, credentials, named actions, grants, operation records | Planned. Existing per-app secret commands write directly to a Worker; they do not implement a company vault or action broker. |
| Loops | Work started by schedules or events that can resume after interruption | Planned and explicitly deferred from launch. Platform cleanup cron is implemented, but it is unrelated to customer automations. |

These boundaries come from [SPEC.md](../SPEC.md), [product definitions](../app/lib/content.ts), and the [Library](../public/docs/library/index.md), [Switchboard](../public/docs/switchboard/index.md), and [Loops](../public/docs/loops/index.md) docs. The CLI validator and dispatcher, plus the control-plane router, establish which parts are actually implemented.

## How the current implementation works

### From an app folder to a hosted app

`atrax new` copies the single chat template. An existing folder cannot simply be imported through this command. The contract requires a Worker entry, assets directory, and numbered SQL migrations, even if the app only needs static files.

`atrax dev` compiles Wrangler configuration, applies local migrations, and runs the Worker and assets with database state in `.atrax/state`. The app's contract and source remain in the app folder. Generated provider configuration is disposable.

There are two deployment implementations in [bin/atrax.mjs](../bin/atrax.mjs):

- The customer's Cloudflare account path uses Wrangler to bundle and deploy. Nonsecret provider identities go in `atrax.lock.json`.
- The Atrax-hosted path sends code, assets, and migrations to the [control plane](../control-plane/src/index.js). It stores an administrative bearer token locally in `.atrax/instant.json` and references an app record in the control-plane database.

The control plane creates one Worker and one D1 database per app, uploads code and assets, attaches a domain where possible, and returns the URL. Redeployment addresses those same resources. Claiming clears expiration; it does not establish a human identity or workspace owner. The new agreed sign-in-at-first-deploy journey therefore needs a different ownership model.

Current hosting compiles an [asset-serving shim](../control-plane/src/shim.js) around the supplied Worker. That shim does not independently enforce company access. The [chat Worker](../templates/chat/src/worker.js) invokes its own [Door module](../templates/chat/src/door.js). Importing a different Worker can omit that gate.

### Where data lives

| Information | Current owner |
| --- | --- |
| App source, desired contract, migration files | Customer's app folder |
| Local business data | `.atrax/state` |
| Hosted business data | App's own D1 database |
| Door membership | The same app database |
| Resource IDs, token hashes, migration names, expiry, domain metadata | Control-plane D1 |
| Hosted app management token | Local `.atrax/instant.json` |
| Workspace members, company knowledge, action grants, automation runs | No implemented model |

This per-app runtime and database foundation is useful. It does not imply that business data should be merged into the control-plane database as the platform expands.

### What people and agents can operate

The public website is a static Next.js export hosted on Cloudflare Pages. Product and solution pages render definitions from `app/lib/content.ts`. The [account page](../app/account/page.tsx) has a disabled sign-in button. Its project list, the sharing sheet, app connections, and automation trace in [Visuals.tsx](../app/components/Visuals.tsx) are illustrations, not connected controls.

The CLI supplies versioned JSON for administration. `/agent`, `/llms.txt`, `/docs.json`, and Markdown docs teach an external agent how to use it. Business action discovery, MCP, workspace knowledge, employee delegation, and connection grants are absent from the runtime.

The [packaging script](../scripts/package-cli.mjs) assembles `atrax-cloud` from the CLI and templates, excluding the site and control plane. The root [package scripts](../package.json) build the site, run tests, lint, and deploy the static site to Pages.

## Shared context needs a precise meaning

Interview update: the user defined shared context as company knowledge and explicitly requested an agent-accessible contribution tool. Their example is an agent saving "we don't use the color blue in this company" after the user says it. Knowledge must then be available to other authorized agents and apps. Automatic conversation capture was not selected. Revision, conflict, and attribution details below remain recommendations until settled.

Knowledge inputs are now settled: manual file uploads, agent uploads through the CLI, and agent-created entries. Automatic synchronization with external document services is deferred. These are launch requirements; the source-inspected implementation still has no Library service.

Correction policy is also settled: ordinary authorized members and their agents may edit company guidance, preserving attribution and revision history. Explicit corrections replace the existing active guidance; agents clarify ambiguous contradictions. This supersedes the earlier open questions about correction and authorship in this map.

The homepage currently labels the `/agent` documentation handoff "Shared context, instantly." That is platform documentation, not shared business memory. See [app/page.tsx](../app/page.tsx), the final call to action. The new feature should have a distinct, concrete explanation.

There are several kinds of context an agent needs:

| Need | Proposed authoritative source | Example |
| --- | --- | --- |
| How to operate Atrax | Platform documentation | How to deploy and inspect an app |
| What software exists and what it can do | Workspace app/action discovery | Inventory offers `check_stock` and `reserve_stock` |
| How this business works | Library | Supplier instructions, terminology, order policies |
| What is true right now | The app that owns the records | Units available, current orders, reservation status |
| What happened before | Activity and deliberately saved knowledge | Who changed a policy; a decision explicitly saved for future work |

These sources can be available through one workspace agent connection without becoming one undifferentiated store.

Two possible designs have different consequences:

1. Copy documents, app records, and conversations into a central memory store. This makes initial retrieval simple, but copied stock counts can go stale, source permissions can be lost, and an agent's interpretation can be confused with an approved business rule.
2. Store company knowledge in Library and retrieve current records through the owning app's actions. Give knowledge its source, revision, audience, and update history. Save agent conclusions deliberately, with visible authorship. This is the recommended shape because each fact has an identifiable source that can correct it.

The second design matches the agreed distinction between company knowledge and live app records. Search results should preserve the source and check access when retrieved. A summary of a restricted document should not silently acquire a broader audience. The precise correction, visibility, and retrieval policies remain open in the interview.

## One business example can exercise the platform

The agreed core is:

1. A member's agent creates Inventory and Orders and deploys them into the workspace.
2. Teammates open either app directly or from Home.
3. An employee or their agent creates an order.
4. Orders calls Inventory's reservation action through authorized access.
5. A retried operation returns the same reservation outcome instead of reserving stock twice.
6. Activity identifies the person, agent, and app operations involved.

The shared-context extension is agreed; background-work examples are retained for later:

- Library contains supplier lead times and the company's reorder policy. An agent reads these with source references while asking Inventory for current stock.
- Deferred: a scheduled automation checks low stock each morning and drafts a reorder for review. It keeps working when the employee's laptop is closed and exposes its outcome and failures.
- A later connection to an external supplier or communication service can send an approved order. This is not a settled first-launch requirement.

The stock value remains Inventory's responsibility. The policy remains Library's responsibility. Orders owns the order. Switchboard authorizes calls, and Loops owns a durable background run if that capability is included. A business policy written in a document informs reasoning; enforceable limits still need an explicit product rule rather than relying on a model to remember the text.

## Design consequences before implementation

### Workspace access must belong to the platform

Changing a visibility default cannot establish company-only access for imported apps. Identity, workspace membership, and access checks must cover the app interface, assets, API, and agent actions independently of template code. The user should get this when deploying, without assembling a separate login system.

An employee's agent is a caller acting for that employee. The user's selected action audience supplies standing permission, normally for the whole workspace, with optional per-person restrictions. Calls through another app must preserve those restrictions. A separate connection approval should not be required for each internal integration when the existing audience already grants access.

An unattended app or automation would need independent authority, but that capability is deferred. The original spec's statement that agents are Loops only applies to hosted operational agents; it is too broad for external agents using Atrax.

### Local validation must describe the hosted artifact

Current Atrax-hosted deployment collects sibling `.js` and `.mjs` files without resolving a complete module graph. The customer's account path and dry-run use Wrangler bundling. A locally working app with nested imports or dependencies can therefore fail on the hosted path. See `bundleForInstant` in [bin/atrax.mjs](../bin/atrax.mjs).

The agreed import promise needs one supported build contract and an artifact that is actually what will be deployed. Static apps should use that contract without an empty database or fabricated migration. This should be resolved in the contract, not by creating another deployment mode for each frontend framework.

### Deployment and business-data recovery are separate concerns

`redeployApp` applies migrations before uploading code, then updates the applied-migration record afterward. A failure can leave live data changed while the record is stale. Concurrent deployments can both observe the same pending migration. These are source-derived failure paths, not reproduced incidents. See [control-plane/src/index.js](../control-plane/src/index.js).

Readiness currently accepts an HTTP success after publishing. It does not test a candidate release before switching live traffic. The asset shim also caches unversioned non-HTML assets as immutable for a year, which can leave a returning browser using old code after an update.

The new release model must define candidate checks, promotion, migration ownership, failure recovery, and caching together. Reverting code cannot honestly promise to undo stock reservations or restore deleted business data. The user agreed that irreversible data changes need an explicit decision and accepted isolated previews while emphasizing that Atrax is a simple cloud platform. These are deployment concerns. Source hosting, branches, and code review remain with GitHub or the user's existing tools.

### Agent operation includes observing and repairing failures

Hosted apps currently lack CLI logs, plan, and drift support. `doctor` also requires a Cloudflare account before checking the build. These limitations conflict with the desired no-Cloudflare-account agent journey. An agent needs to discover what is available, invoke it, determine whether it completed, and recover or explain a failure through documented operations.

The operation contract should serve interfaces, CLI, and MCP. A separate implementation of the same business rule for each caller would make permissions and retries disagree.

## Documentation and verification

Documentation currently has multiple manually maintained representations. The status Markdown calls plan and drift planned, while the CLI implements them for one hosting path. Door's overview says unavailable while later sections document an alpha slice. The pricing page describes both instant hosting and the absence of a hosted control plane. The old account control-plane design differs from the implemented anonymous hosting service.

These discrepancies matter for agents because the docs direct them into incompatible workflows. Before launch, published capability status should be derived from one maintained inventory and checked against supported commands and operations. Proposed product behavior must remain visibly separate from runtime documentation until implemented.

Existing tests exercise CLI behavior, fake provider operations, hosted provisioning and redeployment, Door sessions, chat validation, and exported site content. The hosted tests use an in-memory database stand-in and fake Cloudflare API. Their integration-test names do not establish live provider behavior. No current test demonstrates workspace identity, shared knowledge, two-app reservations, employee agent authority, previews, or safe deployment recovery. The inspected harnesses are useful foundations; the agreed workflow still needs end-to-end proof.

## Current scope

The consolidated build brief is maintained in [launch-scope.md](./launch-scope.md). Core product decisions are settled, with a final shared-understanding review before implementation. Reservation failure handling, delegation, recovery, and knowledge processing must implement those decisions consistently. Hosted agents, schedules, independent unattended credentials, and automatic document synchronization are deferred.
