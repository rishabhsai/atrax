# Atrax: an agent-operated cloud for internal software

## Recommendation

Atrax should host the complete software a small business runs: its interface, data, access rules, and operations. Employees open apps directly or find them in their workspace Home. Owners manage the business's apps and team. Agents can create and operate those apps, and can use the operations the apps expose with permission.

The central product promise is: **build with your agent, run with your team**. The technical promise is that every supported product operation has a documented machine interface, an explicit permission requirement, and an observable result.

Lakebed provides useful precedent for a compact app contract and an agent feedback loop. Vantage provides a concrete private-sharing use case and shows that an MCP interface alone is already insufficient differentiation. Atrax's opportunity is to combine complete apps, verified private access, shared business ownership, and reusable app operations into one coherent experience. That opportunity is a product hypothesis, not a demonstrated market advantage.

Workspace Home, direct app URLs, team membership, per-app access, returning email sign-in, recoverable management access, and complete agent access are the agreed direction. New workspace apps are company-only by default, meaning every workspace member can use them. Selected-person restrictions, external guests, and public access require explicit changes. The exact action interface remains proposed.

The subsequent interview settled ownership and onboarding. Every member can create apps and maintain those they create, with additional maintainers invited per app. Workspace admins manage the team and control external/public sharing. Apps belong to the workspace and survive employee departure. Local development needs no sign-in; first hosted deployment verifies email and creates or joins a workspace, eliminating a separate claim step. Existing HTML and React interfaces can be retained while the agent adapts backends to Atrax's documented runtime contract.

The next interview round selected Inventory + Orders as the primary launch example. Ordinary deployment updates the same URL after checks pass, preserves business data, and offers optional preview. Irreversible data changes require an explicit decision. An employee's agent can perform ordinary work within their permissions; destructive app deletion and public publishing require deliberate confirmation. Activity records the person and agent. Shared company context and the remaining product boundaries are now being explored in the [platform map](./platform-map.md).

Later scope decisions: Library includes shared company knowledge with an agent tool for saving user-provided policies, preferences, and decisions. App actions default to the whole workspace; maintainers can select their audience and restrict individual actions for particular people. Hosted agents and background automations are deferred. Atrax owns cloud operation of apps, while GitHub remains responsible for source hosting and code collaboration.

## Lakebed findings

### A complete app has one name and one contract

Lakebed calls a complete application a **capsule**. It combines the client, server, data, authentication, inspection, and hosting. Its documented structure has server, client, and shared code, with typed client calls derived from the server definition. [Lakebed overview][1]

For Atrax, the valuable idea is the complete unit. Keep the word **App**, which already means something to a business owner. Avoid making customers learn “capsule,” “project,” “stack,” and “deployment” before they can open their inventory system. An app can acquire capabilities as needed without changing its identity.

Lakebed's server vocabulary distinguishes queries, mutations, actions, and HTTP endpoints. Its actions have read-only database access; mutations can write. External fetches have separate capability constraints, and database rollback cannot reverse an external request. [Capsule API][2]

Atrax should define its own terms precisely. The proposed **Action** means a named app operation, such as checking stock or submitting an approval request. An action declares whether it reads or changes state. This deliberately differs from Lakebed's technical use of “action.” The term should have one meaning throughout Atrax's app contract, agent documentation, and console.

### The agent can observe the result

Lakebed documents equivalent local and hosted inspection routes, including manifests, data, logs, and usage. Its CLI supports deployment ownership, tokens, domains, and deployment lifecycle operations. Inspection is private by default on hosted apps. [Lakebed reference][3]

This is more useful than a command that merely returns a URL. Atrax should let an agent answer whether the URL is serving the expected release, whether access restrictions work, whether the migration finished, and what failed when an action returned an error. “Deployed” and “ready” need distinct states with a documented route to completion.

Lakebed's limits documentation pairs limits with structured failure information and recovery advice. It also warns that an action failure can follow an external side effect, so blindly retrying is unsafe. [Limits][4]

Atrax should return an operation identifier, status, error code, and recovery information for consequential work. A retry of the same deployment or business request should return its known outcome or resume it, without duplicating resources or business effects. An agent must not infer success from a process exit alone.

### Documentation is an entry point to the product

Lakebed's homepage offers a creation command and a prominent agent guide. Its visual design is sparse, black, and centered around that handoff. [Homepage][5] The guide identifies restrictions, the app shape, local checks, deployment checks, and further reading. Generated apps include instructions for agents. [Agent guide][6]

Atrax already has an agent entry point and template instructions. Improve their contract and accuracy rather than adding more discovery files with overlapping content. Maintain one source for commands, supported features, machine schemas, examples, and human documentation. Every documented recovery instruction should be exercised as part of release verification.

The homepage can retain a fuller cloud-product presentation while offering an equally clear agent handoff. Visual density and machine operability are independent choices.

### Authentication is substantial, but named private sharing has a gap

Lakebed documents protected guest sessions, built-in Google sign-in, stable account identities, and a distinction between app identity and deployment management. Sign-in requirements do not themselves grant row-level access. Its auth guide explicitly states that restricted access for approved people cannot currently be enabled in the alpha, although commands exist for already-restricted deployments. [Identity and authentication][7]

Requiring someone to sign in is different from checking that the owner invited them. Atrax's confidential-sharing promise needs both verified identity and an explicit grant. The product should describe these directly in its sharing UI and agent results.

The published `lakebed@0.0.33` package corroborates the restriction in its user-management command. Selected published modules and a package-wide search for common MCP implementation identifiers did not establish a built-in MCP server. That is bounded evidence, not proof about every hosted component. [Published package][8]

### Constraints should inform, not dictate, Atrax's design

Lakebed's documented alpha restricts package imports and resets local data on restart. [Lakebed overview][1] Its database contract uses declared indexes and transactional handlers, with writes serialized per deployment. [Database][9] Storage is built in, but private object display has documented client limitations, including no SDK private-download method. [Storage][10]

Atrax should borrow the clarity of these constraints. It should preserve persistent local development, and make private app images, assets, and requests work together from the start. The restrictions are evidence about Lakebed's current product shape, not grounds to assert that Atrax is already more capable.

## The private-prototype problem

The supplied posts describe a designer who has an interactive coded prototype and wants only selected people to open it. Sending files loses ongoing control, while screen sharing does not allow an independent review. The second post introduces Vantage as an attempted solution. These are useful qualitative examples; they do not establish market size or willingness to pay. [Supplied screenshots][11]

Vantage focuses on uploaded static prototypes and optional usability research. Its demo is explicitly simulated and does not save changes; the repository says a public hosted instance is not yet available. [Vantage repository][12] Its documented limitations include live API restrictions and the inability to prevent an authorized viewer from copying or photographing material already displayed. [Vantage limitations][13]

The inspected access code accepts a personal link as a bearer credential. An optional Google sign-in check matches the invited email before permitting content access. Session lookup rechecks revocation. [Viewer code][14] [Session code][15]

Atrax should make named confidential access a normal path: verify the invited email, establish a session, and check the grant on subsequent protected requests. A forwarded URL should not admit a different person. Revocation should prevent future access, while the product remains honest that it cannot retract copies already downloaded.

Vantage already offers MCP operations for publishing, inviting, revoking, extending access, and reading results. Deletion is available through its CLI or console but omitted from MCP. [Vantage MCP][16] That is a useful distinction for Atrax: agent operation must cover the complete supported lifecycle, with appropriate authorization, rather than a selection of convenient commands.

The Atrax experience could be one request to an agent: “Share this prototype with these two reviewers until Friday.” The agent would publish the app privately, establish the named access grants, verify an unauthorized request is refused, and report the URL and expiry. Whether Atrax sends invitations or returns delivery-ready links must be explicit; a successful grant is not proof that an email arrived.

### A prototype should remain an app

A static prototype needs assets and access control. A working inventory app adds server operations and persistent data. Both should use the same app identity, ownership, deployment lifecycle, and sharing model. A database should be optional rather than a mandatory empty resource for an HTML prototype.

External reviewers introduce a distinct relationship. **Guests** receive access to specific apps, possibly with an expiry, without joining the business's employee roster. The identity mechanism can be shared; the grants differ. An expired review grant must not remove an employee's independently granted access to a different app.

This gives private prototype sharing a place inside the internal-software product. Recording sessions, task questionnaires, and research reports are additional product areas and are not required to solve controlled access.

## What MCP should mean in Atrax

MCP defines named tools with input schemas and supports discovery and invocation. It does not turn arbitrary application code into a complete, permissioned interface automatically. Servers remain responsible for validation and access controls. [MCP tools specification][17]

The recommended statement is: **every app can expose its operations to agents and other apps**. “Everything it can do” means all intentionally supported business operations, not every internal function, database table, or visual interaction.

### One definition of each operation

An action definition should own its name, description, input and output shapes, authorization requirements, behavior, and compatibility version. The browser, typed app client, CLI, and MCP interface should invoke the same implementation and policy checks. They are ways to reach one operation, not independent implementations.

For example, Inventory exposes `check_stock` and `reserve_stock`. Purchasing is allowed to check stock. A warehouse agent can reserve it within a granted scope. Neither permission implies permission to deploy Inventory code or export the complete inventory database.

MCP's HTTP authorization specification binds credentials to their intended resource and separates resource servers from the authority issuing tokens. [MCP authorization][18] Atrax's design should preserve that separation when routing a workspace request to an app. It must not pass a broad owner credential through customer code. Authorization is checked at invocation, even when an operation was visible during discovery.

### Compare the possible shapes

| Shape | Consequence | Assessment |
| --- | --- | --- |
| Each app independently implements its MCP server and auth | Repeated integration work and inconsistent policy across apps | Poor fit for an operated cloud |
| Atrax exports arbitrary routes and database functions automatically | Easy initial coverage, but weak business semantics and excessive access | Does not fulfill a safe app contract |
| Apps declare actions; Atrax generates access through a shared runtime | One operation definition, consistent permission checks, reusable discovery | Recommended |

The workspace can provide one agent connection that discovers permitted app actions. App identity still owns each action. A stable app identifier disambiguates two apps that both offer `search`; titles can change without breaking callers. A workspace directory should expose only authorized metadata, then let the agent retrieve the full schema for relevant apps.

A static prototype can have no business actions. It remains agent-operable through the platform's deploy, inspect, and access-management operations. Manufacturing dummy MCP tools for it would add no value.

### Complete access with distinct authority

There are two jobs for agents: operating the cloud and doing work through the apps. Atrax should support both through explicit permissions.

An operator may create an app, deploy a release, inspect logs, or manage access. An app caller may invoke business actions. An agent acting for an employee should retain that employee's relevant constraints. Unattended app-to-app work needs an app identity and a grant of its own, rather than borrowing whichever employee last signed in.

Some operations require the owner's decision, such as adding a recipient outside the business or deleting stored data. Agent-first means the agent can prepare the operation, request the required decision, execute once authorized, and verify the result. It does not mean granting every connected agent unrestricted ownership.

## Vocabulary and interface direction

Lakebed's vocabulary is compact because one noun names the complete app. Atrax can achieve the same clarity with familiar business language.

| Term | Atrax meaning | Status |
| --- | --- | --- |
| Workspace | A business's apps and team | Agreed |
| App | A complete piece of internal software | Agreed |
| Home | The directory of apps a member can open | Agreed |
| Member | Someone on the workspace team | Agreed |
| Guest | A named outside person granted access to particular apps | Agreed |
| Action | A declared operation an app offers to permitted callers | Proposed precise definition |
| Connection | An authorized relationship to another app or service | Proposed |
| Release | A version of app code deployed as a unit | Proposed |
| Preview | An isolated, non-live deployment for trying a change | Proposed |
| Activity | The record of changes, access events, and action outcomes | Proposed |

Use “tool” in MCP documentation when discussing the protocol, and “app” for the software a business uses. Avoid “agent” as a name for a hosted resource until an actual long-running execution model exists. A coding assistant using Atrax and an autonomous process hosted by Atrax are different things.

Retain Launchpad, Tables, and Door as product names where they help explain capabilities. The main console navigation should use the things people act on: Apps, Team, Connections, and Activity. Within an app, show its overview, releases, data, access, actions, and logs as those capabilities become available. Do not give unimplemented products empty navigation destinations.

The visual direction should remain a legible cloud console: clear navigation, compact tables, visible status, restrained orange accents, and readable forms. Commands and agent connection controls belong beside the operation they enable. Employees opening an app should not have to understand infrastructure terminology. The marketing site should combine a concrete business example with a conspicuous agent start command and accurate feature status.

## Atrax's current gaps

These findings come from repository source and documentation. They describe implementation coverage, not a completed live audit.

| Launch need | Current evidence | Required change |
| --- | --- | --- |
| Private hosting independent of app code | The chat Worker calls `handleDoor`; the instant wrapper supplies assets rather than enforcing workspace access | Put the access boundary under platform ownership |
| Verified returning access | Door redeems a link into a session; there is no email sign-in flow | Separate stable identity, membership, invitation, and session |
| Recoverable management access | Claim removes expiry; management relies on a locally stored token | Establish workspace ownership on first hosted deployment and revocable credentials recoverable on another computer |
| Shared team and Home | Members live in individual app databases; the account page has disabled sign-in | Add workspace membership and per-app grants with a real Home |
| Full agent operations on instant apps | Instant logs, plan, and drift are explicitly unavailable | Close operational gaps for the actual launch hosting path |
| Static prototypes | Current contract validation requires server and Tables configuration | Model optional app capabilities within one app contract |
| App actions | The template has HTTP handlers but no declared action catalog | Define and enforce the common action contract |
| Honest discovery | Product status differs between docs, spec, and template metadata | Generate public capability descriptions from verified support |

Evidence: [CLI](../bin/atrax.mjs), [Door](../templates/chat/src/door.js), [template Worker](../templates/chat/src/worker.js), [instant wrapper](../control-plane/src/shim.js), [control plane](../control-plane/src/index.js), [agent instructions](../public/agent), and [account page](../app/account/page.tsx).

## Launch proof

An ambitious launch can demonstrate a connected business workflow without implementing six broad product suites. The proposed proof has three parts, all exercised through the same platform.

**Private review.** An agent publishes an existing interactive prototype. Two named reviewers can open it and return on another device. A forwarded link fails for someone else. Revocation and expiry prevent subsequent protected requests, including direct asset and API requests. No unnecessary database is created.

**Daily internal work.** A small business uses an Inventory app. Its creator signs in at first hosted deployment and the app belongs to the workspace. They recover their maintenance access on a fresh computer. A workspace admin invites the team and manages access. Members find the app in Home or bookmark its URL. Restarting local development and deploying updates preserve the appropriate data. Removing a member terminates their workspace access while the app remains available to the business.

**Apps working together.** The user selected Inventory + Orders for the primary launch proof. Creating an order calls Inventory to reserve stock, through the interface or an employee's agent. A forbidden reservation must fail without changing stock, revoking a connection must prevent subsequent calls, and a retried permitted write must not reserve the same stock twice. Activity can be inspected by an authorized agent. The detailed connection and failure contract remains to be designed.

The implementation sequence should follow those dependencies: identity and platform access, app lifecycle reliability, Home and sharing, then the declared action contract with one real connection. Logs and failure inspection belong alongside each step. Preview isolation and recovery need explicit data semantics: rolling back code must not silently undo customer data or pretend to reverse an incompatible migration.

Measure success through completed workflows: fresh-install onboarding, unauthorized access refusal, return visits, clean offboarding, data persistence, management recovery, and repeatable action calls. A count of available MCP tools would not establish readiness.

## Evidence limits and open decisions

Sources were accessed on September 14, 2026. Lakebed's public documentation and selected modules from its published npm package support the findings above; its hosted implementation and reliability were not independently validated. Vantage's demo and source support its described flow, but no live security audit was performed. The screenshots establish individual requests and claims, not a validated market segment. Atrax's current gaps were traced in source; the expanded launch experience is not yet implemented.

The agreed default is **company-only access for the whole workspace**. An app may be explicitly restricted to selected people, shared with named external guests, or published publicly. Company-only access covers use of the app. Every member can create apps, maintainers can edit and deploy their apps, and workspace admins control team management and external/public sharing.

Core product decisions are consolidated in the [launch scope](./launch-scope.md). Knowledge inputs are manual file uploads, agent uploads through the CLI, and agent-created entries. Ordinary authorized members and agents may correct guidance with attribution and revision history; agents clarify ambiguous contradictions. Automatic document synchronization and hosted background agents are deferred. App-action audiences and employee-agent authority are settled. Identity-provider selection, protocol topology, and release mechanics should implement those user journeys without adding a source-control product.

## Sources

The supplied screenshots have no verified canonical post URL in this record. Other references are primary product documentation, specifications, published packages, or public implementation source. Product docs are mutable and often lack publication dates.

1. Lakebed. [Product overview][1].
2. Lakebed. [Capsule API][2].
3. Lakebed. [CLI and runtime reference][3].
4. Lakebed. [Limits and failure contracts][4].
5. Lakebed. [Homepage][5].
6. Lakebed. [Agent instructions][6].
7. Lakebed. [Identity and authentication][7].
8. npm registry. [Lakebed 0.0.33 metadata and published artifact][8].
9. Lakebed. [Database contract][9].
10. Lakebed. [Object storage][10].
11. [Supplied screenshots][11], with both attachments linked below.
12. Madhumita Krishnan. [Vantage repository and README][12].
13. Vantage. [Documented limitations][13].
14. Vantage. [Viewer implementation][14].
15. Vantage. [Session implementation][15].
16. Vantage. [MCP operations][16].
17. Model Context Protocol. [Tools, specification 2025-11-25][17].
18. Model Context Protocol. [Authorization, specification 2025-11-25][18].

[1]: https://docs.lakebed.dev/ "Lakebed, product overview, accessed September 14, 2026"
[2]: https://docs.lakebed.dev/capsule-api/ "Lakebed, Capsule API, accessed September 14, 2026"
[3]: https://docs.lakebed.dev/reference/ "Lakebed, CLI and runtime reference, accessed September 14, 2026"
[4]: https://docs.lakebed.dev/limits/ "Lakebed, limits and failure contracts, accessed September 14, 2026"
[5]: https://lakebed.dev/ "Lakebed homepage, accessed September 14, 2026"
[6]: https://lakebed.dev/agents.md "Lakebed, agent instructions, accessed September 14, 2026"
[7]: https://docs.lakebed.dev/auth/ "Lakebed, identity and authentication, accessed September 14, 2026"
[8]: https://registry.npmjs.org/lakebed/0.0.33 "npm registry, Lakebed 0.0.33 metadata and linked published tarball"
[9]: https://docs.lakebed.dev/database/ "Lakebed, database contract, accessed September 14, 2026"
[10]: https://docs.lakebed.dev/storage/ "Lakebed, object storage, accessed September 14, 2026"
[11]: /Users/rishabhsai/.t3/userdata/attachments/8f15d682-6ec4-4b3a-a369-fa6cbeeb06f6-b943ca83-0361-4ffd-a183-7e4d2d71f446.png "Supplied image.png: Michal Krzton's private-prototype-sharing request; second supplied image.png shows Madhumita Krishnan's Vantage post"
[12]: https://github.com/madhumita-krishnan/vantage "Madhumita Krishnan, Vantage repository and README, accessed September 14, 2026"
[13]: https://github.com/madhumita-krishnan/vantage/blob/main/docs/WHAT-IT-CANNOT-DO.md "Vantage, documented limitations, accessed September 14, 2026"
[14]: https://github.com/madhumita-krishnan/vantage/blob/main/server/lib/viewer.js "Vantage, viewer redemption and identity verification implementation"
[15]: https://github.com/madhumita-krishnan/vantage/blob/main/server/lib/shares.js "Vantage, session and revocation implementation"
[16]: https://github.com/madhumita-krishnan/vantage/blob/main/mcp/README.md "Vantage, MCP operations and exclusions"
[17]: https://modelcontextprotocol.io/specification/2025-11-25/server/tools "Model Context Protocol, Tools, specification version 2025-11-25"
[18]: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization "Model Context Protocol, Authorization, specification version 2025-11-25"

### Repository sources

- [CLI and contract validation](../bin/atrax.mjs)
- [Door invitation and session implementation](../templates/chat/src/door.js)
- [Chat Worker request flow](../templates/chat/src/worker.js)
- [Instant deployment wrapper](../control-plane/src/shim.js)
- [Instant hosting API](../control-plane/src/index.js)
- [Agent entry point](../public/agent)
- [Current account page](../app/account/page.tsx)
- [Approved launch direction](launch-scope.md)
- [Workspace experience](workspace-experience-proposal.md)

### Supplied visual references

- [Private prototype-sharing request](/Users/rishabhsai/.t3/userdata/attachments/8f15d682-6ec4-4b3a-a369-fa6cbeeb06f6-b943ca83-0361-4ffd-a183-7e4d2d71f446.png)
- [Vantage announcement](/Users/rishabhsai/.t3/userdata/attachments/8f15d682-6ec4-4b3a-a369-fa6cbeeb06f6-f59d97c9-039b-4319-8de4-efc5efb6cbe0.png)
