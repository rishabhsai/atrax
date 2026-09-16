# Launch architecture proposal

September 15, 2026. This is an implementation proposal against the agreed [launch scope](./launch-scope.md), not a claim of shipped or tested behavior. Only this document changed during the architecture investigation. No provider resources, packages, or runtime files changed, and no tests ran.

## Recommendation

Give each hosted app a platform-owned public gateway and a private app runtime. The gateway owns sign-in, app access, action authorization, asset delivery, and calls to other apps. Customer code runs in the private runtime and receives its own database plus a request-scoped action context. It receives no account session token, control-plane database, Cloudflare token, or general platform service binding.

Use ordinary Workers and service bindings for launch. An app declares the other apps it calls as named dependencies, and Atrax binds its gateway to those apps' gateways. This avoids a central routing deployment on every app update and does not require Workers for Platforms enrollment. The dependency declaration establishes routing, while each target app's policy establishes permission. It adds no separate connection approval.

Keep the website and console as the existing static application on Cloudflare Pages. Keep each app's business data in its own D1 database. Central D1 owns people, workspaces, policies, releases, and platform operation records. Library stores bytes in R2 and metadata, revisions, and a text index in central D1.

The first implementation should replace anonymous ownership and template-owned Door. It should not extend the current claim token into another account identity or retain arbitrary public backend routes beside protected actions.

## Start with the caller

The deployment journey is:

```text
atrax new inventory
atrax dev
atrax deploy
  Sign in using verified email if needed.
  Create or choose a workspace.
  Build, check, and deploy the app into that workspace.
  Return its permanent app URL and an inspectable deployment.

atrax login                 # Recover the same identity on another computer.
atrax apps list             # Recover apps from workspace membership.
atrax app link <app-id>     # Attach this source folder to an existing app.
```

The same business action is available through the app interface and the employee's agent:

```text
POST https://orders.atrax.run/__atrax/actions/orders.create
Authorization: Bearer <employee CLI session>     # CLI and MCP only
Idempotency-Key: <stable command key>
{ "sku": "paper-a4", "quantity": 3 }

atrax actions call orders orders.create --input order.json --key order-123
```

The browser uses its host-only app session cookie on this exact endpoint. Orders' handler calls its declared dependency:

```js
await context.actions.call("inventory", "stock.reserve", {
  orderId: order.id,
  sku: order.sku,
  quantity: order.quantity,
}, { key: order.id });
```

`context.actions.call` executes in trusted gateway code through an RPC reference. The runtime cannot select a different employee or replace the parent invocation. Inventory sees the employee and agent that started the order, with Orders recorded as the calling app. Inventory checks current permission before running its handler or returning a previous result.

## Two viable infrastructure shapes

| Decision | Private runtimes with service-bound gateways | Workers for Platforms dispatch namespace |
| --- | --- | --- |
| Public ingress | One platform gateway per app | One platform dispatcher can route every app |
| Customer code | Ordinary private Worker | User Worker in an untrusted namespace |
| Dynamic target discovery | An app declares dependency aliases; its gateway receives service bindings | Dispatcher resolves a script by name at request time |
| Release routing | Deploy the app gateway with its private release binding | Update dispatcher routing metadata to an immutable release script |
| Deployment contention | Per app | Per app metadata, with a shared dispatcher implementation |
| Local execution | Gateway, auth service, runtimes, D1, and RPC can execute locally | Cloudflare's documented local dispatcher connects to remotely deployed user Workers |
| New platform prerequisite | Ordinary Workers and existing platform account | Workers for Platforms subscription and namespace setup |
| Main limit | Ordinary Worker and domain limits; declared dependency graph | Remote namespace verification is still required; namespace isolation has runtime differences |

Cloudflare documents private Workers reached only through service bindings, RPC methods, and local service binding development. The ordinary Workers Paid limit is currently 500 Workers per account. The documented custom-domain limit is 100 per zone, so retained release runtimes, previews, and app domains must count against real capacity before a deployment begins. Do not invent an unlimited launch claim. [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Workers for Platforms is a genuine alternative for a later scale boundary. Its dispatcher can select scripts dynamically; untrusted namespaces isolate customer caches and omit sensitive request metadata. Its paid subscription is currently $25 monthly. Its local-development documentation describes remote namespace bindings, so it does not establish an entirely local dispatch test. [Dynamic dispatch](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/dynamic-dispatch/), [Worker isolation](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/worker-isolation/), [Pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/), [Local development](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/local-development/).

Choose the service-binding shape for this launch. There is no public-HTTP fallback for app-to-app calls. Unknown dependency aliases return a structured configuration error. Adding a dependency requires a maintainer's deployment because it changes the app's runtime configuration. Selecting that dependency does not grant an employee permission to call it.

## Boundaries and modules

These are ownership boundaries, not a request for one class per row.

| Proposed location | Owns | Does not own |
| --- | --- | --- |
| `shared/operations.js` | Operation names, input/output schemas, documented permissions, CLI/MCP mapping | Database writes or provider calls |
| `shared/app-contract.js` | Versioned app manifest and release artifact validation | Identity or authorization |
| `control-plane/src/identity.js` | Email verification, sessions, device authorization, account recovery | App business data |
| `control-plane/src/workspace.js` | Members, invitations, owners/admins, maintainer recovery | App action implementations |
| `control-plane/src/access.js` | One evaluator for app use, maintenance, action audiences, deny rules, Library access | Customer-supplied permission callbacks |
| `control-plane/src/apps.js` | Workspace-owned app identity, access configuration, maintainer lists, dependency resolution | Provider provisioning steps |
| `control-plane/src/releases.js` | Deployment state, desired resources, reconciliation, promotion, preview and rollback rules | Source history or Git collaboration |
| `control-plane/src/library.js` | Uploads, revision history, source permissions, retrieval, indexing state | Current stock or orders |
| `control-plane/src/operations.js` | Platform mutation receipts, activity, inspectable results | A claim of exactly-once customer code execution |
| `gateway/src/index.js` | Trusted public fetch and private delegated invocation entrypoint | Customer module imports |
| `gateway/src/action-context.js` | Fixed caller identity, dependency calls, bounded Library calls during an invocation | An independent app identity or unattended authority |
| `runtime/entry.js` | Generated private Worker entry that calls declared action handlers | Public route dispatch or platform authorization |
| `runtime/migrations.js` | App database migration ledger and atomic migration execution | Workspace membership |
| `cli/` | Build artifact, local Workers configuration, login storage, operation client, stdio MCP | A second implementation of permissions |

The gateway is the app's public Worker. Customer modules must never be included in its module graph. Even top-level customer code executes only in the private runtime. The gateway binds `DOOR` to a named internal control-plane entrypoint, `RUNTIME` to the selected release, `LIBRARY` to its narrow internal entrypoint, and one service binding per declared app dependency. Only platform-generated configuration can choose these bindings.

Keep `control-plane/src/index.js` and the shared operation inventory under one integration owner. Identity/workspace, apps/releases, and Library each export their operation handlers and own a separate ordered migration file. Feature implementers do not edit a shared schema file or extend a central switch independently. The integration owner registers those handlers and applies migrations in order. This gives separate tickets useful, disjoint write ownership without creating transport-specific business logic.

The private runtime has no route, Custom Domain, public `workers.dev` endpoint, or version preview URL. Explicitly set both `workers_dev: false` and `preview_urls: false`, including in provider metadata and drift checks. Disabling one does not substitute for disabling the other. [Workers routing](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [Preview URL defaults](https://developers.cloudflare.com/changelog/post/2025-09-17-update-preview-url-setting/).

The private runtime may receive its own `DB` binding and explicitly declared app secrets. It gets no `DOOR`, `LIBRARY`, dependency gateway, control-plane, or provider-admin binding. Its action context contains RPC methods implemented by its gateway. Workers supports passing functions, `RpcTarget` objects, and RPC references between Workers. The gateway disposes the context after the call and refuses calls after its request deadline or completion, including if customer code duplicates the reference. [Workers RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/), [RPC lifecycle](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/).

## Public operation contract

Maintain one inventory in `shared/operations.js`. The HTTP server, console client, CLI, MCP tool descriptions, and generated capability reference consume it. Each entry contains `name`, `inputSchema`, `outputSchema`, `permission`, `effect`, `confirmation`, and the public route. Keep operation handlers separate from this data so the browser does not import server code.

```ts
type OperationResult<T> =
  | { schemaVersion: 1; operationId: string; status: "succeeded"; result: T }
  | { schemaVersion: 1; operationId: string; status: "pending";
      phase: string; retryAfterMs: number }
  | { schemaVersion: 1; operationId: string; status: "failed";
      error: { code: string; message: string; retryable: boolean;
               details?: Record<string, unknown> } };
```

Platform operations use `POST /v1/operations/{name}` with JSON input. Binary upload and download routes are listed by their owning operation. Action discovery returns each action's app URL and exact call route, so clients do not infer URLs. Business calls use the app gateway endpoint shown above. Both use the same result and error conventions. Polling uses `operations.get`; a timeout reports an unknown or pending outcome, not a fabricated failure.

Every mutation requires an idempotency key. For platform mutations, the receipt and resulting central-D1 changes commit together. A matching key and matching canonical input return the prior result; matching key with different input returns `idempotency_conflict`. An in-flight deployment returns its existing operation. Authorization is checked before returning any stored result.

The launch inventory must cover the following exact operation families:

| Family | Operations |
| --- | --- |
| Identity | `auth.email.start`, `auth.email.verify`, `auth.device.start`, `auth.device.approve`, `auth.device.poll`, `auth.session.get`, `auth.session.revoke`, `auth.sessions.list` |
| Workspace | `workspaces.create`, `workspaces.list`, `workspaces.get`, `members.list`, `members.invite`, `members.accept`, `members.setRole`, `members.remove`, `workspace.transferOwnership` |
| Apps | `apps.create`, `apps.list`, `apps.get`, `apps.setAccess`, `apps.setMaintainers`, `apps.setActionAccess`, `apps.shareGuest`, `apps.removeGuest`, `apps.publish`, `apps.unpublish`, `apps.delete` |
| Releases | `releases.upload`, `deployments.plan`, `deployments.start`, `deployments.get`, `deployments.resume`, `releases.list`, `releases.rollback`, `previews.create`, `previews.delete` |
| Tables | `tables.export`, `tables.restorePlan`, `tables.restore` |
| Actions | `actions.list`, `actions.describe`, `actions.call`, `invocations.get` |
| Library | `library.list`, `library.get`, `library.search`, `library.upload.start`, `library.upload.complete`, `library.upload.get`, `library.upload.retry`, `library.entry.create`, `library.entry.revise`, `library.history`, `library.setAccess`, `library.archive`, `library.download` |
| Operation records | `operations.get`, `activity.list` |

Use `atrax mcp` as the launch MCP server over stdio. It uses a revocable, named employee session from `atrax login --agent <label>`. It converts MCP calls into these operations and returns structured results. This supplies the requested MCP access without introducing a remote OAuth server during launch. The label identifies the configured agent session; it is not proof of which model produced a request.

Console buttons invoke the same operation client. Their disabled state comes from returned capabilities, while the server still checks permission. The UI shows pending, failed, forbidden, empty, and stale-revision states as real outcomes.

## Identity, recovery, and sessions

Use verified email as the recovery identity. Store a stable `person_id` separately from normalized email. A new email proof looks up or creates that person; it never creates a duplicate account because a previous app invitation was consumed.

1. Email start creates a short-lived, single-use verification challenge. Store a hash of its secret, expiry, attempt count, purpose, and safe return destination. Send the verification email using the selected configured mail service. Return a generic success so the operation does not reveal existing accounts.
2. Email verify atomically consumes the challenge and creates a server-side session. Apply rate limits and attempt limits to both creation and verification. Email links open a confirmation page; a scanner's initial GET must not consume the challenge.
3. A session row stores the person, session type, optional agent label, expiry, and revocation. Store only a hash of the random bearer secret. Browser cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, and host-only. Never use a parent-domain account cookie that customer app JavaScript could expose through another app origin.
4. Signing in to a direct app URL redirects to central Door with a one-time state value. After verified sign-in, exchange a short-lived code bound to the original app and exact callback URL for a host-only app session. The app session references the central account session and is unusable at another app. Scrub codes from the final URL. Cookie-authenticated mutations check their exact allowed Origin and CSRF token; CORS does not accept arbitrary app origins.
5. Device start returns a secret device code for polling and a short user code plus verification URL. The browser displays the named CLI/agent requesting access. The person approves only after signing in. Poll atomically consumes the approved request into a named session. Do not print the session secret in ordinary CLI JSON, activity, or logs. Store it in a user credential file with restrictive permissions, separate from the project.
6. Every operation reads the current session and current membership. Do not use a cached workspace role or a long-lived signed token as the final permission decision. Removing a member revokes later operations from existing sessions and future sign-in cannot rejoin the workspace without a new invitation. Existing work that already committed is not undone by removal.

Authentication delivery is an operational prerequisite. No mail provider was configured or tested in this investigation. A local mailbox can support local integration tests; it must not become a hosted bypass code or an alternate identity model.

## Permission model

```ts
type AppAudience =
  | { kind: "workspace" }
  | { kind: "people"; personIds: string[] }
  | { kind: "public" };

type ActionAudience =
  | { kind: "workspace" }
  | { kind: "people"; personIds: string[] }
  | { kind: "public" };
```

Store the audience kind on its resource and selected people in relational rows. Store explicit action denials as separate rows keyed by app, action name, and person. A deny wins over audience membership. Policies use stable action names and survive releases; deleting and reintroducing the same action must not clear its denials.

Access evaluation is ordered:

1. Validate the session unless the operation is explicitly public.
2. Validate active workspace membership, or an active guest grant for this exact app.
3. Require app-use permission.
4. Require the action's audience to include the caller.
5. Reject an explicit person denial.

Workspace-wide action access is the default for newly declared actions. It still intersects app access. A person who cannot open a restricted app cannot invoke its actions. An app can be visible while particular actions remain unavailable. Discovery lists only callable actions, with a maintainer-only view of all declarations and policies.

Every member may create an app and becomes its first maintainer. Maintainers change code, dependencies, ordinary internal app access, action audiences, and other maintainers. Workspace admins manage membership and external/public access, and can assign replacement maintainers. App use does not permit export, secrets, deployment, or code changes. Admin status does not silently bypass an action deny. Admins may use their explicit management operation to change configuration, which activity records.

The initial creator becomes owner and admin. The owner role controls ownership transfer; prevent removal or demotion of the last owner. Prevent deletion of the last maintainer unless an admin supplies a replacement in the same operation. Removing a workspace member removes their maintainer assignments without deleting the app; admins retain maintenance recovery authority.

Guests are named people admitted only to particular apps by an admin. A guest does not become a workspace member, receive Library access, or gain implicit access to another app called by the shared app. A public app has no anonymous business-action access unless an admin explicitly publishes those action names too. Public publishing presents the exact app and actions that will become anonymous; its confirmation binds that plan. This supports public prototypes while keeping default action access internal.

## Delegation through Orders to Inventory

Gateways use a named internal Door RPC entrypoint with these bounded methods:

```ts
authorizeSession({ credential, appId, actionName, releaseId }): Promise<AuthorizedCall>
authorizeChild({ parentInvocationId, sourceAppId, targetAppId, actionName }): Promise<AuthorizedCall>
finishInvocation({ invocationId, outcome, resultDigest }): Promise<void>
```

`AuthorizedCall` contains platform-assigned `invocationId`, `rootInvocationId`, `parentInvocationId`, `personId`, `sessionId`, `agentSessionId`, `workspaceId`, `appId`, `actionName`, and `deadline`. It carries no bearer secret. Public APIs never accept this structure as proof of identity.

Only trusted gateways receive the Door service binding. The private runtime has no way to invoke these methods directly. Gateways construct `sourceAppId` from their fixed platform configuration, and child calls carry the parent invocation recorded by Door. Door checks the parent is active and belongs to that source app, the target belongs to the same workspace, and the underlying session and target policy still permit the action. App-supplied headers, body fields, and RPC data never choose the employee.

The Inventory gateway exposes a private `invokeDelegated` RPC method for trusted gateway callers, then uses `authorizeChild`. Its public fetch handler never accepts a parent invocation ID as authentication. The Orders runtime only receives `ActionContext.call`; it cannot obtain the Inventory binding or invoke `invokeDelegated` itself. Library calls follow the same request-scoped identity path and current source permissions.

All app business HTTP operations are named actions. The gateway alone dispatches them and validates the declared input schema. Customer runtime exports contain action handlers, not an arbitrary `fetch`, `scheduled`, queue, or WebSocket entrypoint. Static HTML and React interfaces remain usable; backend endpoints must be adapted to this documented contract.

The platform can enforce named action boundaries independently of app code. It cannot prove that a maintainer has not written the same business mutation under two different action names, because the maintainer controls the app and its database. The supported contract therefore places each protected business operation behind its canonical action. This is a code-authoring responsibility, not a reason to leave a second HTTP route around the gate.

## App manifest and artifact

Use a new manifest version with an optional backend and optional Tables resource:

```json
{
  "version": 2,
  "name": "orders",
  "web": { "assets": "dist", "fallback": "index.html" },
  "actions": { "entry": "src/actions.js" },
  "tables": { "migrations": "migrations" },
  "dependencies": { "inventory": { "appId": "app_inventory" } }
}
```

Actions export a descriptor and handler for each stable name. Descriptors include JSON input/output schemas, description, and `effect: "read" | "write"`. A write action requires an idempotency key. Deploy-time audiences are explicit deployment input, independent of app source, and persist across updates. Redeploying code never resets access.

`atrax build` creates one content-addressed artifact used by dev validation, dry-run, preview, and hosted deployment. It contains the fully resolved Worker module graph, compiled action descriptors, a content-hashed asset manifest and bytes, and ordered migration names, checksums, and statements. Use Wrangler's supported bundling workflow to resolve nested imports and dependencies. Do not retain the sibling-file collector for hosted deployment. A static-only app has no runtime or D1 requirement; the same trusted gateway serves its assets.

Store deployment artifacts and app assets in a private R2 bucket, separate prefixes or a separate bucket from Library. Serve assets after the app gate. Use `no-store` for private HTML and sensitive responses. Use private, revalidated caching for other company assets initially; immutable public caching is only appropriate for deliberately public content-addressed assets. Avoid the shared Cache API for private app data.

## Persistence contract

Use foreign keys, unique constraints, and checked status values. Keep all timestamps as integer UTC milliseconds and identifiers as opaque strings. Names and emails are labels, not foreign keys. Access decisions read central D1's primary state; do not opt into unconstrained replicas for revocation checks.

| Central-D1 table | Required identity, state, and uniqueness |
| --- | --- |
| `people` | `person_id` primary key, unique normalized email, verified timestamp |
| `sessions` | `session_id`, unique secret hash, person, kind, optional agent label, parent session, app scope where applicable, expiry, revoked timestamp |
| `email_challenges` | challenge ID, secret hash, email, purpose, return destination, expiry, consumed timestamp, attempts |
| `device_authorizations` | device secret hash, unique user code, client label, status, expiry, approved person/session, consumed timestamp |
| `workspaces` | workspace ID, display name, unique slug, created timestamp |
| `workspace_members` | primary key workspace/person, role `owner/admin/member`, active or removed state |
| `invitations` | invitation ID, workspace, normalized email, role or exact guest app, expiry, accepted/revoked timestamps |
| `apps` | app ID, workspace, stable slug and gateway name, URL, lifecycle state, app audience, live D1 ID if any, observed active release |
| `app_maintainers` | primary key app/person |
| `app_people`, `app_guests` | exact app/person use grants; guest grants record granting admin |
| `action_policies` | primary key app/action name, audience kind, policy revision |
| `action_people`, `action_denials` | primary key app/action/person; explicit deny persists independently of releases |
| `releases` | release ID, app, artifact hash/key, descriptor hash, schema compatibility, created-by attribution; artifact hash unique per app |
| `release_dependencies` | primary key release/alias, target app, generated binding name |
| `deployments` | deployment ID, app, release, mode, phase, expected predecessor, desired and observed resources, provider version, error and timestamps |
| `operation_receipts` | operation ID, actor, operation name, target, idempotency key hash, input hash, state and result; unique actor/operation/target/key |
| `invocations` | invocation ID, root/parent, person, session/agent session, app, action, release, key/input hashes, state, timestamps and outcome |
| `activity` | append-only event ID, workspace, actor/session/agent, source app, operation/invocation, target, outcome and time |
| `library_items` | item ID, workspace, kind `file/entry`, title, current revision, audience kind, archived timestamp |
| `library_revisions` | revision ID, item, ordinal, predecessor, text/blob key and hash, attribution, change reason; unique item/ordinal |
| `library_people` | selected-person item access when restricted |
| `library_sources` | derived revision and exact source item/revision references |
| `library_uploads` | upload ID, item/revision, expected length/hash/type, state, error and attempt count |
| `library_search` | FTS5 index over current authorized item content, keyed back to item/revision |

App D1 holds business tables plus `__atrax_migrations` with unique migration name, immutable checksum, applied timestamp, and deployment ID. The migration ledger belongs in the database it describes. Central D1 may cache its observed summary, but that summary never decides whether to apply a migration.

The app handler stores business command receipts beside its data. The platform's invocation record alone cannot make arbitrary code exactly-once. A customer handler must commit its business mutation and deduplication result in the same app-D1 transaction. Read actions and completed business receipts still pass through current authorization.

## Inventory and Orders correctness

Make the launch example one order line per order. That demonstrates the required cross-app transaction without adding a cart allocation problem to the acceptance test. Orders owns `orders`; Inventory owns `stock` and `reservations`.

Orders has a unique command key associated with its initiating person and canonical input. `orders.create` first inserts or loads the order in `pending_reservation`. The stored order ID is the child reservation's permanent key, independent of request attempts. A retry with different SKU or quantity returns a conflict.

Inventory has a unique reservation identity `(source_app_id, order_id)`, plus SKU, quantity, input hash, and terminal outcome `reserved`, `insufficient_stock`, or `unknown_sku`. Quantities are positive integers and available stock has a nonnegative check constraint. Reserve runs one D1 batch:

1. Insert the reservation, computing its outcome from the current stock inside the SQL statement.
2. Subtract stock only if that newly inserted reservation has outcome `reserved`.
3. Read the saved outcome.

Use a normal unique insert, so a concurrent duplicate fails and rolls back the whole batch. Then load the committed existing reservation, check its input hash, and return that result. The first successful transaction commits either a reservation or a terminal rejection. Both are stable on retries. A stock mutation and its reservation record cannot commit separately. D1 documents transactional rollback for a failed batch. [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

Orders records the returned reservation outcome as `confirmed` or `rejected`. If Inventory committed but the response or Orders' final write was lost, Orders remains pending. A retry of `orders.create`, or an explicit `orders.resume` action for that order, calls Inventory with the same order ID and completes from its saved outcome. Never release stock because an HTTP request timed out. No automatic scheduler or independent service credential is required.

Show a pending order in the interface and expose its invocation/result to the agent. Any later retry runs under the currently signed-in employee's permission. A removed employee cannot resume it; an authorized teammate can. The activity chain preserves both the original creation and later repair attempt.

## Library

Both browser and CLI uploads use `library.upload.start`, a bounded authenticated byte-upload route, and `library.upload.complete`. The start result gives an upload ID and maximum size; the bytes stream to a private R2 key. Complete verifies stored length and hash before creating the immutable revision. Retrying any step adopts the same upload identity. No public bucket URL or long-lived download URL can bypass current access.

Store uploaded originals even when text extraction is unsupported. Launch text indexing supports UTF-8 plain text and Markdown. Other file types remain downloadable and searchable by filename/title, with a visible `stored_without_text` outcome. PDF, office, OCR, or model extraction should only be advertised when its processor actually exists and passes tests. This is a bounded processing contract, not a silent claim that every upload is searchable by contents.

For text uploads and knowledge entries, index current text with D1 FTS5. D1 documents FTS5 support, so semantic embeddings and Vectorize are unnecessary for the launch's search requirement. [D1 SQL support](https://developers.cloudflare.com/d1/sql-api/sql-statements/).

`library.search` returns item ID, exact revision ID, title, snippet, source references, and indexing status. SQL applies current item audience and membership before result limits and snippets. `library.get`, download, and history repeat the same check. Old revisions inherit the item's current audience. An index is a retrieval aid, never an access authority.

`library.entry.revise` requires `baseRevisionId`, replacement text, and a correction reason. Commit the new revision and current pointer atomically; a stale base returns `revision_conflict` with the current revision, never silently overwrites another person's correction. A deliberate correction replaces current guidance while retaining history. Ordinary members can contribute and correct allowed entries. Agents ask about ambiguous contradictions before invoking revise; the platform does not pretend that a string comparison can decide company policy.

A contribution derived from Library sources records those exact source revisions. Its effective access is the intersection of its own audience and all source items' current audiences. Recheck that intersection on retrieval and search, so a later source restriction also restricts the derived entry. Reject cycles and broader requested audiences. Launch Library participation is for active workspace members; sharing an app with a guest does not share company knowledge. Uploaded file content and knowledge are data, never instructions that can change operation permissions.

The initial upload state machine is `created -> uploaded -> indexing -> ready | stored_without_text | failed`. Indexing of bounded supported text can complete in the request. If background retries become necessary, use a platform-owned queue with the same upload ID and state transitions; customer scheduled automation remains deferred. Do not claim that `waitUntil` guarantees completion after a request fails.

## Deployment, migrations, and recovery

Use a durable per-app deployment coordinator, keyed by app ID, to own provider mutations and reconciliation. Store the durable operation and expected predecessor before creating resources. Provider resource names derive from app and release IDs, so a retry can inspect and adopt an existing database, runtime, artifact, or gateway version. Different apps deploy independently. Concurrent deployments of the same app queue or return the current operation, rather than racing migrations.

The deployment phases are:

```text
received -> validating -> candidate_ready -> migrating -> publishing
         -> verifying -> succeeded
         -> failed
```

`failed` includes the last completed phase, observed resources, and whether live data changed. A timeout with uncertain provider outcome remains pending until reconciliation observes it. Store progress durably; a request ending must not strand the sole copy of deployment state.

1. Validate membership, maintenance, app identity, artifact hashes, dependencies, capacity, policy changes, and migration checksums.
2. Build a private candidate with isolated D1 and assets from the exact artifact. Apply all migrations, run import/descriptor checks, and run the application's declared smoke actions against isolated data. Both candidate and live runtime come from the same artifact hash.
3. Plan pending live migrations from the app-D1 ledger. Keep code compatible with both the old and new schema for ordinary updates. A destructive or compatibility-breaking plan needs an exact, expiring confirmation bound to app, artifact, migrations, and predecessor release. Do not rely on a regex for arbitrary SQL safety; unknown transformations require review. Confirmation is not a rollback strategy.
4. Apply each migration's complete statement list and ledger insertion in one D1 transaction. The build artifact contains already-separated statements, produced by a SQLite-aware parser. Do not use the existing semicolon/newline splitter. Enforce limits before executing; never split an oversized migration into independently committed pieces to make it fit.
5. Upload the live private runtime using the same artifact with the existing live D1 binding. A non-mutating runtime check verifies its declared release identity. Publish the trusted gateway version with that runtime binding and resolved dependency gateways.
6. Inspect the actual provider gateway deployment and check the protected app through the real gateway. Record the observed active release. If the process crashes between provider publication and its D1 update, resume by inspecting the provider version and binding metadata. Do not deploy again merely because the central receipt is stale.

Cloudflare's current D1 query API supports multi-statement batches. Its Wrangler implementation applies a migration with its ledger update together and uses a SQL-aware splitter for local D1 execution. This directly contradicts the current control-plane comment that query requests need one statement at a time. Reuse a maintained parser or a pinned, attributed copy of the upstream parser with its own cases; do not import undocumented Wrangler internals. [D1 query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/), [Wrangler migration implementation](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/d1/migrations/apply.ts), [Wrangler SQL execution](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/d1/execute.ts).

There is no atomic transaction spanning D1 and a Cloudflare gateway deployment. Represent that fact in the deployment state and reconciliation rules. During provider propagation, either old or new gateway code may serve. Each identifies its actual release, and Door authorizes against that release's recorded action declarations with the same current policies. Only backward-compatible migrations qualify for this ordinary path. A breaking migration needs a deliberate maintenance deployment that stops new actions and drains in-flight work before changing live data. If safe draining cannot be demonstrated, that migration is blocked.

Retain a small bounded number of prior runtime releases and their assets for code rollback. Rollback changes the gateway's runtime binding to a retained release only if its schema contract remains compatible with the current app-D1 ledger. It never rewinds the business database or deletes reservations created since deployment.

Optional previews receive their own runtime, gateway URL, D1, and isolated asset prefix. Default to sample data. A live-data copy requires data-export authority and an explicit choice; its preview audience is no broader than the source app. Preview dependencies must resolve to corresponding isolated preview apps, or the preview returns `dependency_not_configured`. Never bind a preview Orders app to live Inventory.

Business-data restore is a separate planned operation. Preserve the current database first, stop writes, show the exact source snapshot/bookmark and affected period, and require confirmation from an authorized maintainer or admin. Restoring only Inventory can invalidate Orders' reservation references; the connected example must report that dependency and require a coordinated restore decision. Do not silently claim automatic cross-database point-in-time recovery.

## Local runtime and verification contract

Local dev starts the real platform gateway, local Door/Library services, private app runtime, and local D1/R2 bindings using the same generated artifact and authorization handlers. It seeds a local workspace and developer identity without sending email or requiring an account. An isolated local configuration owns this seed; hosted code has no `skipAuth` flag. Persist D1/R2 under `.atrax/state` and preserve it on restart and rebuild.

For Inventory + Orders, the local workspace launcher starts both gateways and runtimes with their real service bindings. An integration test may create employee sessions directly in its local fixture database, but requests still cross the same gateway and authorization code. Use the current Cloudflare Workers Vitest integration or Miniflare's multi-Worker runtime with actual D1 migrations. Cloudflare provides examples for D1 migrations, multiple Workers, RPC, and R2. [Workers test recipes](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/).

Required tests observe outcomes, not just emitted provider requests:

- Anonymous asset, action, alternate-path, private runtime, and spoofed-header requests cannot bypass company access.
- Employee removal invalidates existing app and agent sessions on their next request; email recovery cannot recreate membership.
- A denied Inventory reserve stays denied directly, through the browser action endpoint, through MCP, and through Orders. It remains denied even after a completed result exists.
- A malicious runtime cannot read a bearer secret, mint another actor, obtain Door/Inventory bindings, or call its action context after completion.
- Concurrent orders cannot make stock negative. Duplicate successful and rejected reservations return the same result. Lost responses and lost Orders finalization recover without reserving twice.
- Failed migration statements roll back that migration and its ledger. A retry after ledger commit does not reapply it. Changed checksums and concurrent deployments are rejected or serialized.
- Candidate smoke actions and preview app calls cannot mutate live D1 or reach live dependency gateways.
- Library search, history, source-derived entries, downloads, and stale revisions enforce the stated permission and correction behavior using real D1/R2.
- Restarting local dev retains app data. Nested imports and static-only apps build into the artifact actually exercised by tests.

A local provider API double remains useful for provision/reconcile failures. It is not proof that Cloudflare uploaded or routed a Worker. Final hosted acceptance must separately verify email delivery, device login, private runtime reachability, gateway bindings, DNS, real migrations, redeploy data retention, and the Inventory/Orders workflow. Record these as hosted checks only when run against actual resources.

## Current code this replaces

- `control-plane/src/index.js:createApp` creates resources before durable app ownership exists, enables public `workers.dev`, and returns anonymous manage/claim tokens.
- `redeployApp` relies on a central JSON migration-name list, applies statements individually, and publishes before proving a candidate.
- `control-plane/src/shim.js:buildShim` imports customer code in the public request entry and trusts its Door call. It also passes scheduled handlers through.
- `templates/chat/src/worker.js` owns the current gate and arbitrary `/api/messages` routes. The template must become named actions behind the platform gateway.
- `bin/atrax.mjs:readInstantModules` collects sibling modules, while local and account deployment use a different bundler. `validateContract` requires a Worker and migrations even for static content.
- `tests/instant.test.mjs:FakeDatabase` routes statements by string shape and therefore cannot prove D1 transactions, constraints, or cross-app retry behavior.

These observations come from source inspection, consistent with [the platform map](./platform-map.md). Existing deployment comments explain the anonymous prototype path, but no inspected evidence requires preserving it in the new account model. Existing hosted resources need a separately inventoried migration plan before their credentials or URLs change; do not silently delete them or pretend an anonymous bearer token proves a verified person.

## Implementation order

1. Pin shared operation schemas and app artifact version, then add real local Worker/D1 integration support.
2. Implement verified identity, device authorization, workspace membership, and one access evaluator.
3. Build the trusted gateway/private runtime pair, named actions, and request-scoped delegation. Verify denied Orders-to-Inventory calls before adding the full console.
4. Implement Inventory/Orders transactional receipts and failure recovery.
5. Replace anonymous provisioning with workspace-owned apps, durable deployments, the app-D1 migration ledger, isolated candidates, and previews.
6. Implement Library bytes, revisions, source permissions, and search. Connect the CLI, stdio MCP, and console to the shared operation inventory.
7. Update published docs from that inventory, then complete local and hosted acceptance separately.

Hosted agents, customer schedules, unattended app credentials, document-service synchronization, and source-hosting features remain outside this design.
