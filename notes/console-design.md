# Atrax console and Library

Status: implementation specification, September 15, 2026, updated after the Claude Opus 5 review in `notes/claude-design-review.md`. This document describes the intended interface and required data contracts. It does not claim that the endpoints or screens exist. No application source was changed for this design task. Implementation-ticket approval remains separate.

## Design decision

A workspace navigation rail leads to Home, Library, Activity, and Members. Home opens the apps a person can use. App details expose access, available actions, and deployment information to people with the relevant permissions. Library gives company files and guidance the same visible home.

Physical scene: an employee opens Atrax on a laptop beside their ordinary business tools during the workday and wants to open an app or find a policy without learning cloud infrastructure. Use a light console, warm paper neutrals, dark readable text, orange for selection and primary actions, and familiar controls.

The design borrows the clear hierarchy of a cloud console. Keep Atrax's orange mark and warm surfaces. Use compact sans-serif interface text, small corner radii, flat lists, and ordinary forms. Reserve monospace for commands, identifiers, and exact values.

### Source facts

| Source | Observed fact | Design consequence |
| --- | --- | --- |
| `PRODUCT.md`, `CONTEXT.md`, `notes/launch-scope.md` | Apps belong to workspaces. Every member can create an app. Maintainers change apps. Admins control membership and external sharing. | Use these names consistently. Never label an app creator its owner. |
| `notes/launch-scope.md` | Employees bring their own agents. Library contributions, connected app actions, and Home are launch work. | Do not add hosted chat, agent builders, schedules, source editors, or GitHub controls. |
| `DESIGN.md` | Orange, warm paper, monospace, pill controls, and 18–30 px panels were specified for the marketing direction. | Preserve colors; use the product-specific typography and geometry below for the console. |
| `app/globals.css`, `app/layout.tsx` | Current code already loads Inter, Space Grotesk, and IBM Plex Mono, and uses sans for body text. The written design file is behind the code. | Scope console styles explicitly. Do not let marketing headline sizes or button motion leak in. |
| `app/account/page.tsx` | Account is a marketing page with an unavailable Cloudflare Access login and an account preview. | Replace the preview route with real session entry and console behavior when auth works. |
| `app/components/Visuals.tsx` | `AccountPreview` contains inert navigation, placeholder metrics, and fixed initials. | Reuse no fake identity or placeholder data as authenticated UI. |
| `control-plane/src/index.js` | Current routes cover legacy app creation, claims, deploys, per-app members, export, secrets, inspection, and deletion. Existing members cannot sign in again through the invitation operation. | Workspace identity, returning sign-in, Library, and action policies require real backend work. Existing per-app invitation data is not a workspace model. |
| `next.config.ts`, `app/layout.tsx` | The site is a static export. Marketing header/footer wrap every page. | Root implementation must provide a console layout boundary and working direct route handling. Dynamic workspace URLs cannot depend on a browser-only navigation path that returns 404 on refresh. |

### Two navigation arrangements

**A. Workspace-first rail, selected.** Persistent workspace selector, then Home, Library, Activity, Members. App management is reached from Home and uses tabs inside the app page. An employee can move directly between Inventory and a supplier policy; an admin can invite someone without first selecting an app.

**B. App-first switcher.** A top app selector anchors a contextual rail containing Overview, Releases, Access, Actions, and Activity. Library and workspace management live under a separate workspace switcher. This is good for someone operating one deployment all day. It hides shared knowledge and team administration behind a change of context, and makes ordinary employees confront infrastructure navigation before opening their app.

Choose A because finding and using software is the primary employee task. Maintainers still get a clear app context through the breadcrumb and tabs. Avoid a second Apps destination beside Home; both would lead to the same inventory.

### Review decisions

The agreed launch scope takes precedence over both design reviews. Adopt Claude's clear console token boundary, visible identity, person-specific action explanations, unified Library attribution, invitation recovery, and accessibility details. Keep these boundaries:

| Recommendation | Decision |
| --- | --- |
| Keep all console chrome monospace, pill buttons, and 11 px metadata | Keep the existing spec's sans interface, 6 px controls, and 12 px minimum instead. This is a deliberate product tier within the orange/warm-paper identity, consistent with the user's capable, simple console brief. |
| Add Settings, Releases, and Data navigation | Keep four workspace destinations and existing app tabs. Inspect deployment history within Overview. Authorized devices live in the account menu. A Data browser and general settings destination would add launch scope. |
| Personal recency sorting, Home activity strip, weekly agent totals, and session/row counts | Do not require new telemetry or count endpoints for these decorations. Home defaults to alphabetical order. Counts appear only where an existing authoritative response supports a concrete decision. |
| Always show who is signed in, workspace, and role | Adopt. Use backend identity and role text, with a compact visible account summary. Show a workspace switcher only when there is a choice. |
| Effective-action checker with reasons; no generic action runner | Adopt. The checker uses the runtime policy evaluator. Business work stays in the hosted app or the employee's external agent. |
| Store conflicting guidance as a `Needs clarification` entry with a resolver queue | Do not add a new persistent workflow. Leave current guidance active and return a structured clarification result to the contributing agent or form. The scope requires asking which guidance is current, not an inbox. |
| Typed confirmation for every public or destructive action | Keep a named, explicit confirmation with the real consequence. Do not require invented counts or impose typing as a universal ritual. Backend decision IDs must bind any destructive approval to the exact proposed operation. |
| Refuse sign-in after removing a member | Refuse access to the removed workspace and its apps. The person may still sign into Atrax and use another workspace where they remain a member. |

The console manages workspace membership, invitations, access policies, knowledge, and inspectable operation results. The CLI/repository defines app code, action names and signatures, builds, and deployment requests. The console does not edit the action schema or originate a source build. A shared capability reference supplies the documented agent equivalent for each console mutation.

## Shell and visual system

- At 1024 px and wider: 220 px rail, 56 px top bar, 32 px content inset. Main content has a 1280 px maximum width and stays left aligned within its available space. At 768–1023 px: 188 px rail and 24 px inset.
- Rail header has the Atrax mark and wordmark. Show the actual workspace name above the four destinations; make it a selector only for people with multiple memberships. Place documentation near the bottom. The top bar contains breadcrumbs and the signed-in account menu, with actual name and role visible outside the menu. Verified email is visible in the rail's account summary; on mobile it appears in the menu. Do not duplicate workspace selection in both places. No fabricated initials or role inferred from a color.
- Home and Library have a 28 px page heading, one short supporting sentence when useful, and actions right aligned. Put the search/filter toolbar 24 px below the header and the list 16 px below the toolbar.
- Use `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` for console text, and the existing Plex Mono stack for code. The existing brand mark may keep its brand face. No new font dependency.
- Type: page heading 28/36 px at 600 weight; section heading 18/26 px at 600; normal text and controls 14/20 px; long knowledge content 16/26 px; metadata 12/18 px. Use sentence case, no tracked uppercase labels. No text smaller than 12 px.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px. Desktop buttons are at least 36 px high with 12 px horizontal padding. Inputs are 40 px high. Compact list rows are at least 56 px high. Forms have a 640 px reading width.
- Radii: controls 6 px, list enclosure 8 px, floating menu 8 px. A table has one border around the whole table and horizontal row rules. Do not put a card around each row or around each form section.
- Use one orange primary button per local task area. Secondary actions have a neutral border. Destructive actions use a dark red label and a plain-language consequence. Text links are underlined on hover and focus.
- Icons are optional supporting cues. Use a consistent 16 px stroke icon family only if installed, or text labels. No icon-only primary actions, fake avatars, decorative clouds, or animated status dots.
- Ordinary transitions are 150 ms for color and opacity. No page-load choreography, moving buttons, glass, gradients, pulsing data, or perpetual animation.

| Token | Value | Use |
| --- | --- | --- |
| `--console-bg` | `oklch(0.982 0.006 75)` | Main warm-paper canvas |
| `--console-subtle` | `oklch(0.958 0.008 72)` | Rail, table headings, hover |
| `--console-surface` | `oklch(0.995 0.003 75)` | Inputs and floating menus |
| `--console-text` | `oklch(0.17 0.008 50)` | Primary text |
| `--console-muted` | `oklch(0.46 0.015 60)` | Secondary text |
| `--console-border` | `oklch(0.84 0.012 70)` | Decorative row rules |
| `--console-control-border` | `oklch(0.59 0.012 60)` | Visible input boundaries |
| `--console-accent` | `oklch(0.69 0.2 42)` | Primary button with dark text, brand mark |
| `--console-accent-text` | `oklch(0.48 0.15 38)` | Restricted use of dark orange text on paper |
| `--console-focus` | `oklch(0.17 0.008 50)` | Focus ring on light surfaces; use warm paper on dark logs |
| `--console-selected` | `oklch(0.94 0.04 65)` | Current navigation background |
| `--console-success` | `oklch(0.43 0.1 145)` | Success icon and text |
| `--console-danger` | `oklch(0.46 0.16 28)` | Error and destructive text |

These are implementation values, not verified contrast measurements. Measure rendered combinations before sign-off. Signal orange is a fill with dark text, never ordinary foreground text on paper. Current navigation uses dark text on the selected tint. Focus uses a dark ring and paper offset on light surfaces, with the pair inverted on dark logs. Decorative borders need not meet text contrast; control boundaries and focus indicators do. Verify dark log secondary text independently.

## Routes and navigation behavior

Use `/account` as the account entry. Canonical console routes are `/account/workspaces/:workspaceId`, then `/library`, `/library/:itemId`, `/activity`, `/members`, and `/apps/:appId`. App tabs append `/access`, `/actions`, and `/activity`. A revision is linkable at `/library/:itemId/revisions/:revisionId`.

Search, filters, sort, and pagination live in URL search parameters. Browser back restores them. Stable backend IDs identify resources; names are presentation. These are proposed public route shapes, independent of the API transport. Root must select routing compatible with the deployed runtime and verify a fresh request to every nested route.

An unauthenticated deep link signs the person in, then returns to that exact authorized destination. An invalid or inaccessible app gets a neutral "This app isn't available to this account" page with the current account and a switch-account action. Do not reveal restricted app names through lookup failures. Direct hosted-app URLs go to the actual app; Home must never embed or copy the app UI.

The backend architecture uses a trusted public gateway for each app and a private app runtime. The directory's URL is always that public gateway. Gateway requests carry the verified employee identity into the common named-action contract; the console never exposes a private runtime URL or constructs a bypass endpoint. Identity, workspace, and Library operations use the control plane. This architecture is an implementation input, not content to place in ordinary employee flows.

## Home

Header: `Home`, supporting workspace name, and `Create an app`. Creation opens a real setup page with the published CLI/agent instructions. It does not create an empty deployed app or open a hosted builder. Its copy is `Build with your agent, then deploy to this workspace.` Use the verified installation and creation commands from the maintained capability reference, not hardcoded speculative flags.

Below the header: search input labeled `Find an app`, optional `All apps` / `Apps I maintain` filter, and a count only when the API gives one. Filter by app name and description, with alphabetical ordering. The filter changes the same directory; it is not a second navigation destination. Do not add recently-opened ordering without an agreed source of that data.

The directory is a flat list with columns App, Access, Status, and actions. Name and optional one-line description lead each row. Add a compact `You maintain this` label where relevant; guest sharing says `Shared with you`. These relationships complement the actual audience, never replace it. A subordinate URL is copyable if returned by the server. Status describes the real deployment result, such as `Live`, `Deploying`, `Deployment failed`, or `No deployment`. Do not imply that a live deployment is healthy without a health result.

`Open app` is the dominant row link and uses the hosted URL. `Manage` opens details only for someone allowed to manage or inspect them. A member who has app use permission but no maintenance permission sees no deployment controls. A maintainer whose app-use access has been restricted can reach management through `Apps I maintain`; the server must distinguish management discovery from employee app discovery.

Empty workspace: `Your team's apps will appear here.` / `Create and deploy an app with your agent.` / `Create an app`. A person with no permitted apps sees `No apps are available to you yet.` and a link to Members only if they can see that directory. Show `Create an app` to a workspace member even in this state. A filter with zero matches says `No apps match "…".` with `Clear filter`. Only a server-provided empty-state reason may distinguish an empty workspace from no permitted apps; do not fetch restricted app counts to infer it. Do not suggest account-owner intervention for a routine returning login.

## App details

Breadcrumb: workspace / Home / app name. Header has app name, exact URL with copy, real deployment status, and `Open app` when allowed. Tabs: Overview, Access, Actions, Activity. Tabs are links with `aria-current`; hidden tabs must also be inaccessible at their URL when unauthorized.

**Overview** shows description, workspace, and `Maintained by` with the actual permitted names. An app user allowed to inspect this summary sees the app link and available actions. Maintainers additionally see current release, deployed time, and the last deployment outcome in simple definition lists. Do not grant operational-log access merely because a person can open the app.

Below the maintainer summary, list deployment attempts with release ID when assigned, responsible person/agent, start/end time, and outcome. Expand an attempt to its authorized failed check and redacted output; use a compact dark log region only for actual technical output. The current release stays visible while a later deployment runs or fails. Release ID and deployment attempt ID are different fields. Show `Deploy an update` as instructions only. No resource count metrics, general database browser, or separate Releases tab is required. If the maintained capability reference supports code rollback, expose that exact operation and say `Rolling back code does not restore business data.` Do not invent a rollback button ahead of its backend contract.

**Access** contains three separate sections in this order.

1. `Who can open this app`: radio choice `Everyone in the workspace` / `Selected people`. Workspace-wide is the creation default and automatically includes future members. Selected people opens a searchable member checklist. Show the unsaved consequence, for example `Only the selected people will be able to open this app.` A save updates one versioned policy.
2. `Maintainers`: names and email addresses, `Add maintainer`, and remove actions if allowed. Helper text: `Maintainers can change and deploy this app. The app belongs to the workspace.` A maintainer addition uses current members, not arbitrary outside emails. Reassignment behavior for a departed maintainer is a backend/admin responsibility.
3. `External access`: actual guest list and `Invite guest` for admins. A separate public-publishing control requires an authorized explicit confirmation showing the exact app and intended audience. Public web access never silently changes action access. External/private guest access remains scoped to specific apps.

Hide mutations a person cannot perform and explain the current policy in read-only text. Do not expose an apparently usable Save button that always ends in permission denied. The server still checks permission on every mutation.

**Actions** starts with the app's exposed operations as a list. Each row shows display name, description, technical action name in mono, and the actual audience summary. Opening a row reveals its input/output documentation, personal availability, and a link to the documented agent operation. An employee discovers only actions the backend permits them to discover; absence from the list cannot be used as the permission check.

Print once above the list: `Action access applies whenever an operation runs, including through this app, another app, or an agent acting for a person.` This statement must be proven through gateway and action-handler verification before shipping. Do not claim access cannot be bypassed merely because the console displays the policy.

For maintainers, `Default action access` uses `Everyone in the workspace` or `Selected people`. `Exceptions` beneath an individual action is an inline editor with member picker and `Allowed` / `Blocked`, plus `Use default` to remove an exception. Explicit blocks are visible as named exceptions. Summaries such as `Everyone in the workspace · 2 exceptions` come from real policy data.

Provide `Check access for` with a person picker and a resolved list of actions, `Allowed` / `Blocked`, and a reason such as `Workspace default`, `Selected audience`, `Explicit exception`, or `Not a current member`. It must come from the same policy evaluation as runtime calls, under the checker's own inspection permission. When editing unsaved policy, label its results `Proposed access`; the server evaluates that proposed policy without persisting it. Keep app access and action access separately labeled; opening an app must not imply permission to every operation. No per-connection approval after the standing policy grants a call. No unattended service-credential panel at launch.

At first deployment, the CLI/agent flow shows detected named actions with `Everyone in the workspace` selected and a way to choose another audience before publication. Accepting all defaults is one continuation; no mandatory browser policy wizard. Initial and later policy edits use the same contract and evaluator. The console reads the resulting policy.

Do not add a generic action runner. The app's own UI and the employee's existing agent perform business work through the common named-action contract. The console inspects that contract and controls its audience.

## Members and invitations

Members page lists Name/email, Role, State, Joined, and permitted row actions. Keep pending invitations in a distinct section below active members. Owner, Admin, and Member are roles; Pending and Expired are invitation states. Do not infer membership from email domains.

`Invite member` opens an inline form above the list: Email, Role with Member selected, and `Send invitation`. A secondary action cancels. For launch, one email per submission gives clear delivery/error feedback. Success adds the returned pending invitation with expiry and delivery status. An accepted invitation no longer offers resend. Expired invitations offer `Send new invitation`; revocation is a separate action.

Removal confirmation names the person and says `They will lose access to workspace apps and their active sessions will be revoked. Apps they created stay in this workspace.` Commit only after confirmation. The backend identifies and prevents invalid owner removal or last-owner transitions; render the returned explanation. Never solve a returning sign-in by removing and reinviting a member.

The emailed invitation links to workspace name, inviter attribution if disclosed by the backend, invited email, and `Continue with this email`. Verifying a different account displays the mismatch before accepting; offer switch account. After verified acceptance, open Home. An expired link offers sign-in and a truthful expired-invitation state; it must not offer a request action without a supporting backend operation.

An already-joined person opening an old invitation receives `You're already a member. Sign in to continue.` once the backend can safely identify that state for the verified person. Signed-in members continue straight to Home. Do not expose membership information to an unverified holder of an arbitrary email address. Removing a member blocks this workspace and its apps, including existing sessions and delegated calls; it does not invalidate membership in an unrelated workspace.

## Library

Header: `Library`, `Company files and guidance for your team.`, secondary `Add entry`, primary `Upload files`. These controls appear only when authorized. Search label: `Search company knowledge`. Filters: All, Files, Entries; processing status only when useful. Sort defaults to Recently updated. Scope this search to Library; do not mix live Inventory/Orders rows into knowledge results.

Rows contain item icon/type, title, source or description, visibility summary, updated time/person, and processing state for files. Contribution source is visible as `Console upload`, `CLI upload`, `Console entry`, or `Agent tool`, using the server's actual provenance. Keep this distinct from the source document cited by a knowledge entry. Person attribution remains primary; agent attribution supplements it. Keep filenames with extensions visible where they identify a source. A text badge says `Searchable`, `Processing`, `Stored, not searchable`, or `Processing failed`. No file becomes Searchable merely because upload finished. The status specifically describes indexed retrieval; original-download permission is separate.

Search results include title, relevant excerpt, type, source, updated date, and a direct item link. Excerpts and hit counts must be permission-filtered at the server. If the backend implements only literal text matching, call it search and explain the searchable fields where needed; do not imply semantic retrieval. If retrieval returns source passages, cite each passage to its item and revision. No generated answer panel is required for launch.

### File upload

`Upload files` reveals an inline region with a file picker and drop target. The picker remains usable with keyboard and touch. Show accepted types and maximum size from server capabilities before selection. Each selected file has filename, size, visibility, upload state, progress when measurable, and a remove/cancel control where supported.

The default is workspace-wide knowledge. If restricted Library items are supported, audience selection must be the same policy component and server evaluation used everywhere else. Do not add a restricted option that retrieval cannot enforce. Source-derived entries never widen the source audience.

Stages are `Waiting`, `Uploading`, `Processing`, and the returned terminal outcome. Upload errors remain next to the file with a Retry action. A network interruption must not create duplicate items when retried; use the returned upload identity. After bytes are durable, link to the item immediately while indexing continues. Leaving the page may interrupt an in-browser upload, but does not cancel a server processing job. State this only while bytes are actively transferring.

Unsupported content can be stored and downloaded if the backend supports that behavior. Label it `Stored, not searchable`, with the returned reason. Otherwise reject it before upload with the supported types. Never use a hardcoded successful processing animation.

### Item details and corrections

Full page detail with breadcrumb Library / item title. Header shows type, audience, active revision, update time, person and agent attribution when applicable. Two tabs: Content and History. Right-aligned controls depend on capability: Edit entry, Download original, Replace file, and a secondary menu for supported archival/removal operations.

Knowledge content is readable prose with source links and revision references. Editing opens a labeled Title input and Content textarea with plain text or a documented Markdown subset. Helper text under the editor: `Saving replaces the current guidance and keeps the previous version in History.` The save label is `Save correction`. Allow a short optional correction note. Do not require administrator approval for ordinary authorized corrections.

Create and correction are explicit operations. Saving a new entry does not quietly overwrite a similar one. If the contribution service identifies unresolved conflicting guidance, it returns the candidate entries and a clarification result without changing active guidance. The contributing agent asks which statement is current. A console form shows Current and Proposed text with attribution and retains the proposed draft. The person can explicitly correct the named existing entry, save a distinct new topic when that is their intent, or discard the draft. These are ordinary create/correct operations, not a new approval queue or persistent `Needs clarification` state. Do not pretend the client can detect all contradictions by comparing titles.

History is newest first with revision number, time, responsible person, agent when present, and correction note. Selecting a revision shows its content and identifies the active version. An optional `Use this version` action creates a new revision through the same correction API; it never erases history. Only show it when supported. On concurrent edits, keep the user's draft and offer the new current content for comparison. Never silently overwrite.

File details show original filename, bytes, content type, uploader, processing state/reason, and extracted text or preview only if actually available. Replacement creates a new source revision. Source links retain revision identity so past knowledge is inspectable. A removed source does not magically transfer permission to derived knowledge.

Library empty state: `Add the knowledge your team works from.` / `Upload a policy, reference document, or add a written entry.` Offer the allowed upload and entry actions. No fake sample policies. Search zero state: `No results for "…".` with clear filters and a return to all items.

## Activity

One chronological list covers workspace operations. Filters are App, Person, Operation, and Result, restricted to the caller's visibility. Each event reads as a concrete sentence using actual names: person, operation, target, time, result. Agent-originated events add the agent name beneath the responsible person. Human direct operations say `Console` or the actual client. Cross-app calls preserve the employee and calling app identities.

Open an event into a detail page or inline expanded region containing event ID, exact time, result, permitted error details, target links, and request/operation ID for support. Do not expose secrets, unrestricted action payloads, or private Library excerpts in an activity detail. One retried business operation can have multiple attempts; display the durable business result without implying multiple reservations occurred.

No activity means `Workspace changes will appear here.` A failed request for activity is an inline retry state, never an empty list.

## Email sign-in and device authorization

Account entry has the brand mark, `Sign in to Atrax`, labeled Email input, and `Email me a code`. Use one paste-friendly input for the code, `autocomplete="one-time-code"`, with its length/pattern from the auth contract. Avoid six inaccessible independent boxes. Keep the verified return destination on the server.

After requesting a code, show `Check your email`, the entered address, code input, `Continue`, `Use another email`, and resend availability with the backend cooldown. Retain the email through the same deployment/sign-in flow instead of asking for it again. Allow paste and password-manager/autofill assistance; no cognitive test. Expiry and resend timing must allow assistive-technology users to complete the flow. Do not claim email was delivered until the provider has confirmed that level of status. Handle invalid, expired, rate-limited, and already-consumed codes distinctly without leaking whether an unrelated person belongs to a workspace.

On successful sign-in, choose the existing workspace automatically if there is exactly one and no requested destination. Otherwise show workspace selection. A new account can create its business workspace with one name field, or accept a verified invitation. A matching email domain never autojoins a business.

The CLI creates a short-lived device request and opens a real authorization URL. The browser shows `Connect your CLI`, requester/client name, matching code, expiry, signed-in email, and workspace selection if needed. Explain the actual delegation: `This CLI can act with your permissions in this workspace until you disconnect it or its access expires.` Display the backend's concrete scope rather than an invented list.

Explicit `Connect CLI` and `Cancel` resolve the pending request. Approval is single-use and returns `CLI connected. Return to your terminal to continue deployment.` No browser display of the resulting secret. Expired and already-used requests are terminal states with accurate copy. The account menu leads to authorized devices with last-used time and a working revoke action. Revocation does not remove membership. The same verified identity signs into Atrax and permitted app destinations through the chosen backend auth design.

## Required component and data contracts

The following operation names describe responsibilities to agree with the backend. They are not claims of existing REST routes. UI controls must bind to implemented operations in the shared capability reference before shipping.

Each operational screen has an `Agent equivalent` disclosure in a consistent position near its secondary actions. Generate its CLI command/tool name and required arguments from the maintained capability reference. It is copyable and may include the current workspace/app/item ID. A missing registry entry is an implementation gap for a shipping console operation; do not invent a command or silently count that operation as complete. No credential is included in a copied example.

Every response needs a request ID; every list needs items and an opaque next cursor, with total only if supported. Dates are ISO timestamps. Entities use stable IDs. Mutations return the saved entity, current version, and inspectable operation/event ID. Errors have a stable code, human message, field errors where applicable, and optional retry time. The UI cannot manufacture success from a 202 response; it follows the returned operation state.

| Component | Required read contract | Mutations and behavior |
| --- | --- | --- |
| `WorkspaceShell` | `session.get`: user ID/name/email, memberships with workspace ID/name/role, active workspace, permitted navigation. | `session.logout`; workspace selection preserves valid context or returns to Home. |
| `AppDirectory` | `apps.list`: app ID/name/description/public gateway URL, status with source, app access summary, relationship, canOpen/canInspect/canMaintain, current release summary, safe empty-state reason. Search and maintainers filter are server-scoped. | Open actual gateway URL; link to details; copy only returned URLs. Creation instructions use `capabilities.get` and known workspace context. |
| `AppOverview` | `apps.get`: same app identity plus maintainers, live release, last deployment attempt, versions, allowed operations. `deployments.list/get`: attempt/release IDs, attribution, times, outcomes, checks and authorized redacted output. | Only implemented update/deploy instructions, supported inspect details and deliberate deletion. Code rollback only through a registered supported operation. |
| `AudienceEditor` | `apps.access.get`, `members.listCandidates`, and `access.evaluate`: audience mode, selected member IDs, guest grants, policy version, effective personal permissions. | `apps.access.update` with expected version; named add/remove maintainer operations; guest invitation and public publishing under admin authority. |
| `ActionList` | `actions.list/get`: stable action ID/name, display label, description, named-action input/output schema reference, effective availability, policy and version for authorized editors. `access.evaluate`: subject, action ID, allowed/blocked, reason code and readable reason, evaluated policy version, saved/proposed marker. | `actions.policy.update`: default audience plus typed per-person allow/block exception. First-deploy selection uses the same policy shape. `access.evaluate` runs the authoritative gateway/action policy evaluator, including supplied unsaved proposals, under inspection permission. Agent call instructions from registry. |
| `MemberDirectory` | `members.list`, `invitations.list`: member IDs, names/emails, roles, join time, invitations with state/expiry/delivery status, allowed mutations. | `invitations.create/resend/revoke/accept`; `members.updateRole/remove`; ownership rules return a concrete conflict. |
| `LibraryList` | `library.list/search`: item ID/kind/title/summary, audience summary, active revision, contribution channel, update attribution/time, processing state/reason, canRead/canEdit/canDownload. Search hits carry permission-safe passages with source revision IDs. | `library.entries.create`; actual file upload start; filter and cursor changes. |
| `UploadQueue` | `library.capabilities`: accepted MIME/extensions, maximum bytes, upload protocol and processing types. `uploads.get`: durable upload/item IDs, byte state, processing state/reason. | `uploads.create`, byte transfer, `uploads.complete`, supported cancel/retry. Creation uses a stable idempotency key; complete returns item and processing operation. |
| `KnowledgeDetail` | `library.items.get`, `library.revisions.list/get`: versioned content, sources, responsible person, optional agent, contribution channel, time, correction note, active status and effective permissions. | `library.entries.correct` with expected revision, explicit target, content, optional note; `files.replace` preserving history. Clarification returns unchanged active revision plus authorized conflicting items and the proposed text. Concurrent edit is a distinct conflict result. |
| `ActivityList` | `activity.list/get`: event ID/time, responsible user, optional agent/client/calling app, verb, authorized target link, outcome, operation ID, redacted error. | Filters and detail navigation; no generic retry button unless the operation is actually safe and supported. |
| `EmailLogin` | Auth challenge ID, code format/expiry, resend-after time, generic challenge status, validated return destination. A verified invitation lookup distinguishes pending, expired, revoked, and already-joined without anonymous membership disclosure. | `auth.email.start/verify/resend`; successful session identity. Browser stores no long-lived bearer credential in local storage. |
| `DeviceAuthorization` | `devices.request.get`: pending/approved/denied/expired state, client identity, user code, expiry, requested authority. `devices.list`: authorized delegation IDs and last use. | `devices.approve/deny/revoke`; approve binds verified person and workspace, issues credentials only to the polling client. |

Attribution is a structured object with `personId`, display name/email when allowed, optional `agentId` and agent label, and actual client identity. A plain string such as `AI` is insufficient. Capabilities are server-derived allowed operations, not client role guesses. Do not conflate a deleted person with an unattributed event; preserve the allowed historical attribution.

Backend permission requirements are part of the interaction design: enforce current workspace membership on every operation, immediately honor removal/revocation, check effective action access across UI/CLI/cross-app paths, and filter Library retrieval by source permission. A hidden button alone satisfies none of these.

## Responsive, keyboard, and failure behavior

- Below 768 px, replace the rail with a labeled `Menu` button opening a navigation drawer. The top bar is 56 px; content inset is 16 px. Close restores focus to the trigger. Escape closes. Background content is inert while a modal drawer is open.
- App directory and Library rows become stacked list items on mobile, keeping title, state, audience, and primary action visible. Members rows keep email, role/state, and action menu. No page-level horizontal scroll at 320 px. Technical schema or revision comparisons may scroll inside a labeled region.
- Actions and forms wrap into one column. Interactive mobile targets are at least 44 by 44 px; all remaining row/history controls meet a 24 by 24 px minimum. Long workspace names, app names, filenames, emails, and error messages wrap without pushing actions off-screen. Content remains usable at 200% text zoom and reflows at 400% page zoom to 320 CSS px. Row heights are minimums, so text-spacing overrides can grow them.
- Use semantic landmarks, a skip link, one page h1, real links for navigation, real buttons for mutations, labeled fields, field-linked errors, and text labels beside state colors. Keyboard order follows visible order.
- Focus has a visible 2 px outline with 2 px offset, using the surface-aware pair above. Sticky headers cannot obscure focused controls; set scroll padding and focus-target scroll margin to clear them. Focus newly revealed forms at their heading or first field; failed submission focuses the error summary. Toasts use polite status announcements and never contain the only evidence of success. Reserve assertive announcements for immediate blocking failures.
- Person pickers support typing to filter, keyboard navigation, selection with Enter/Space according to the chosen standard widget, and Escape to close while preserving selections. Show selected people as a readable list with individually labeled remove buttons. Prefer a native checklist when that satisfies the interaction without a custom combobox.
- Loading uses static skeleton rows with accessible loading text and stable dimensions. Empty, error, and forbidden are separate states. Keep a stale list on refresh failure with a visible retry banner rather than erasing it. No manufactured fake rows while loading.
- Save buttons disable only during their own submission, show `Saving…`, and settle to saved data from the server. Preserve unsaved drafts after recoverable errors. Invalidate affected views only after confirmed success. Concurrent policy changes get an explicit reload/review path.
- Critical confirmations use a standard accessible dialog because the user must make a separate deliberate decision. Ordinary edits stay inline or on a page. Public publishing names the audience change; app deletion names permanent data consequences. Avoid confirmation for every normal knowledge contribution or internal action call.
- Reduced motion disables transitions. Announce upload completion, processing failures, invitation outcomes, and saved corrections without moving keyboard focus away from ongoing work.

## Implementation handoff and verification

Root has selected trusted public per-app gateways, private runtimes, a named-action contract, and control-plane identity/Library endpoints. Implementation must settle canonical route handling, exact registry schemas, auth email delivery, workspace role/authority rules, and the supported file-processing matrix before these screens can be treated as complete. Use those contracts to drive rendered controls and instruction snippets. Do not retain an inert mock screen as a completed console when a dependency is missing.

Build and verify in this sequence: real sign-in and workspace shell; Home and direct app URLs; Members and revocation; app/access/action policies; Library upload and correction/history; Activity and device management. This is a dependency sequence, not a set of partial launch claims.

Required end-to-end evidence uses actual seeded or created test resources, clearly identified as test fixtures in the test environment. Production Home begins empty. Verify:

1. An invited member signs in on a new device, opens a permitted app from Home, then opens the same app through its direct URL. Revoking membership invalidates the existing session's access.
2. A maintainer restricts one person's action while leaving app use available. That person's app UI and agent receive the same restriction. The interface displays the resulting policy.
3. A normal member uploads a supported file, sees real processing completion, finds its content, corrects an entry, and can inspect both revisions with attribution. A concurrent correction preserves the second person's draft on conflict.
4. A restricted source is absent from an unauthorized person's results, excerpts, counts, original download, revision pages, and event details.
5. A failed deploy leaves the previous release and app URL visible. A successful update preserves the app identity and business data. The console shows actual deployment results.
6. Device approval, cancellation, expiry, and revocation all produce correct browser and CLI outcomes. No secret reaches the browser success screen.
7. Keyboard-only navigation, mobile layouts at 320/390/768 px, desktop at 1440 px, 200% text zoom, 400% page zoom/reflow, text-spacing overrides, reduced motion, and rendered contrast are checked on the real implementation. Include Safari/VoiceOver and available Chromium/Firefox coverage; record any untested browser explicitly.
8. An already-joined member follows an old invitation and signs in without reinvitation. A person removed from one workspace cannot access its apps or actions through an existing session, but can still use a different workspace where they remain a member.
9. First deploy accepts workspace-wide action defaults in one continuation. Effective-access inspection returns the same outcome and reason as actual gateway/action calls, including the cross-app path.
10. Console and CLI uploads appear in the same Library with actual contribution channels. An ambiguous contradiction leaves active guidance unchanged until the contributing person explicitly corrects it; no administrator approval or clarification queue appears.

No image-generation probe is needed for this written product specification. Its central questions are navigation, permissions, and working state transitions. No mock artifact was generated, and no visual or live application verification is claimed.
