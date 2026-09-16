# First launch

## Agreed scope

A new user can create an app without signing in, run it locally, sign in at the first hosted deployment, deploy into a workspace without a Cloudflare account, preserve its data, and share it with a teammate.

Hosted apps belong to the workspace from their first deployment. This supersedes the earlier anonymous-deploy-and-claim onboarding proposal. There is no separate claim step in the new launch flow.

Launch includes a workspace Home with an app directory, basic team/access management, connected apps demonstrated by Inventory + Orders, and Library read/contribution tools for shared company knowledge. Switchboard supplies the app-action capability needed for that workflow. Hosted agents, scheduled automations, and the Loops product are deferred. The broader infrastructure dashboard and paid onboarding remain deferred.

Atrax is intended as a simple cloud platform for these apps. GitHub remains responsible for source hosting, code history, and code collaboration. Atrax owns deployment, runtime, persistent data, access, shared knowledge, and agent operations. Launch does not include a GitHub replacement or a hosted agent development environment.

## Build brief

The first launch lets a small business bring an app and an existing agent, deploy without a Cloudflare account, and use the app across its team. Apps expose permission-controlled actions, and Library provides company knowledge that people and agents can read, upload, and update.

| User need | Launch behavior |
| --- | --- |
| Build and run | Create an app or adapt an existing HTML/React interface to the supported backend contract; local development needs no sign-in and keeps its data. |
| Deploy | Sign in at first hosted deployment, create or join a workspace, and receive a working app URL through one setup flow. |
| Work together | Apps belong to the workspace and are company-only by default. Members open them through Home or direct URLs. Maintainers manage code and action exposure; admins manage the team and external sharing. |
| Use an agent | Bring an existing agent. It can discover, call, and inspect the same supported platform and business operations as a person, with that person's permissions. |
| Connect apps | Inventory + Orders demonstrates an order reserving stock through an exposed action, with caller permissions preserved and retries unable to reserve stock twice. |
| Share knowledge | People upload files manually; agents upload through the CLI and add knowledge entries through tools. Authorized members and agents can retrieve and correct company knowledge, with attribution and history. |
| Operate reliably | Updates retain the URL and business data. Optional isolated previews do not affect live work. Deployment outcomes and failures are inspectable. Destructive data changes require an explicit decision. |

The core product decisions in this brief are agreed. Before implementation, the user will review this consolidated understanding. The detailed architecture must satisfy these behaviors rather than extending the product interview into routine technical choices.

## Acceptance scenarios

- A new user can follow the published commands to create and run an app without signing in.
- Local data survives restarting local development.
- The first hosted deployment verifies the user's email and creates or joins a workspace, then provides a working URL without a Cloudflare account.
- Deployment handles hosting, data setup where needed, and company access as one flow. Subsequent deployments reuse the established identity and workspace.
- An existing HTML or React frontend can be brought to Atrax without rewriting its interface. The agent adapts any backend to the documented Atrax runtime contract and explains incompatibilities before deployment.
- App data survives a redeployment.
- An ordinary update publishes to the existing app URL after checks pass. Preview is optional, with no mandatory extra publishing step for every update.
- Deleting or irreversibly transforming business data requires an explicit decision.
- A signed-in user can recover their workspace and app-management permissions on a new computer through their verified email.
- Every workspace member can create an app and becomes its first maintainer.
- Maintainers can update their apps and invite other maintainers. Permission to use an app does not itself permit changing its code.
- Workspace admins manage the team and control external sharing and public publishing.
- Apps and their data remain in the workspace when their creators leave. The business retains control of maintenance.
- A new workspace app is company-only: every current workspace member can use it, and outsiders cannot.
- A new member receives access to workspace-wide apps without separate invitations to each one.
- Restricting an app to selected people removes general workspace access to that app.
- An app's exposed actions are available to everyone in the workspace by default. The maintainer can choose an audience at initial deployment and restrict individual actions for particular people.
- An employee's agent cannot bypass an action restriction by reaching the same operation through a different interface or another app.
- External guests receive access only to explicitly shared apps; public publishing is an explicit choice.
- Invited teammates can sign back in using their email after a session expires or on another device, without owner intervention.
- Removing a teammate revokes access, including an existing session and future sign-in.
- A business manages membership centrally; each app defaults to workspace-wide access and can have an explicit access policy.
- Removing a member from the workspace revokes their access to all its apps.
- Members can find permitted apps from Home or open the same apps directly by URL.
- The workspace interface supports team membership and per-app access management under the agreed permissions.
- Every launch operation exposed in the interface has a documented agent equivalent and an inspectable result.
- An employee's agent can perform ordinary work within that employee's permissions without approval for every operation. Each operation still checks access.
- Deleting an entire app or making it public requires deliberate confirmation from someone authorized to do it.
- Activity identifies the person and agent responsible for a change.
- Inventory + Orders demonstrates an order reserving stock through an Inventory action. Employees can perform the work through the interface or their agent.
- A retried order operation cannot reserve the same stock twice.
- An authorized agent can save user-provided company knowledge through a tool call, and another authorized agent or app can retrieve it later.
- A person can manually upload a file into Library, and an authorized agent can upload files through the CLI. Both paths contribute to the same company knowledge collection and enforce its access rules.
- An ordinary authorized member or their agent can correct a knowledge entry. The entry preserves attribution and revision history; explicit corrections replace the active guidance, while ambiguous contradictions prompt clarification.
- Published setup instructions and feature claims match verified behavior.

These are launch acceptance scenarios, not claims of completed verification.

## Access default

Company-only means everyone in the workspace can use a new app. Membership drives this permission, so joining does not require a separate invitation to each app. Selected-person restrictions, external guests, and public publishing are explicit choices. App use does not itself grant permission to edit or deploy code or export the underlying database.

The default audience for exposed app actions is also everyone in the workspace. At initial deployment, the maintainer can select who receives action access and restrict particular actions for particular people. This is an explicit permission policy, so an action may be unavailable to someone who can otherwise open the app. Employee agents inherit those restrictions. External sharing and public publishing still follow the agreed workspace-admin authority.

The user's preference is broad internal access with optional exceptions. A maintainer's exposure policy supplies standing permission for authorized callers. The earlier proposal for a separate approval whenever two internal apps connect should not add a hurdle where this policy already grants the requested operation. Independent service credentials and unattended calls are deferred with background execution.

## Creation and deployment

The team model is deliberately flat for a small business. Every member may create apps. App maintainers handle code changes and deployment; workspace admins handle team management and external/public sharing. Apps belong to the business independently of any employee's continued membership.

Local creation and development require no account. The first hosted deployment establishes verified identity and workspace ownership. The one-click intent is one deployment flow that handles the required platform setup, with sign-in when needed, rather than a sequence of separate infrastructure setup tasks.

Existing HTML and React interfaces are supported inputs. Backends must fit the documented Atrax runtime contract; the agent handles adaptation and explains unsupported dependencies before deployment. This does not promise unchanged hosting of arbitrary server runtimes.

Routine deployment updates the same app URL after checks pass, preserving business data. Preview is available on request. The user agreed with isolated preview data while emphasizing Atrax's cloud-provider boundary. The proposed sample-data default and explicit authorized live-data copy belong to hosting, not a source-control or pull-request workflow. Destructive data changes require an explicit decision. Failure recovery must preserve business activity; code rollback and business-data restore remain distinct operations.

## Agent authority and launch example

An employee's agent acts within that employee's permissions. Ordinary operations such as checking stock, creating an order, or updating a customer record do not require a fresh approval each time. Access is checked on each operation; deletion of an entire app or public publishing requires deliberate confirmation from an authorized person. Activity records the responsible person and agent.

Agents are supplied by the user for this launch. Atrax exposes the tools they call and hosts the business apps. Hosted agents and scheduled automations are pinned for later. This does not defer ordinary backend requests or the cross-app reservation triggered by an employee creating an order.

Inventory + Orders is the chosen primary launch example. Creating an order calls an Inventory action to reserve stock. Both the interface and an employee's agent can perform the work, and retries must not reserve stock twice. Existing prototype support and private external sharing remain acceptance requirements; the user preferred the connected business workflow as the main demonstration.

## Shared company knowledge

Shared context means company knowledge, including policies, terminology, documents, preferences, and saved decisions. The user explicitly wants an agent-accessible tool for contributing to it. For example, when a user says "we don't use the color blue in this company," their authorized agent can save that preference so other authorized agents and apps can use it in future work.

This establishes contribution through a deliberate tool call. It does not establish automatic conversation capture. Current stock, orders, and other live records remain in the apps that own them. This is a new Library capability, distinct from the existing platform documentation served to agents.

Launch inputs are manual file uploads, file uploads by agents through the CLI, and agent-created knowledge entries. Automatic synchronization with Drive, Notion, and other external document sources is deferred. The CLI upload and the manual upload serve the same Library, with the same permissions and observable result.

Ordinary workspace members and their authorized agents may correct company guidance under the knowledge permissions. Entries preserve attribution and revision history. An explicit correction updates the existing entry. If a statement contradicts current guidance without clearly replacing it, the agent asks which guidance is current. An ordinary contribution or correction does not require administrator approval.

The precise retrieval and file-processing contracts are implementation work. New conclusions must preserve the relevant source permissions; company knowledge and live business data retain their separate authoritative owners.

## Product direction

Atrax is a cloud for internal software at small businesses. The core experience is building and operating the tools a business needs, then giving the right people reliable access.

The launch may expand where that makes the complete business workflow better. Ambition is welcome. Home and basic team/access management supersede the earlier blanket dashboard deferral. Inventory + Orders brings app actions and connections into scope, and shared company knowledge brings Library read and contribution tools into scope. Hosted agents and background automations remain later work.

Agents must be able to operate Atrax and discover and use app capabilities with permission. MCP is a desired access method; “everything” means complete supported operations, with permission checked per operation. The concrete action contract remains to be designed.

The visual direction remains a clear, capable cloud console with Cloudflare-like structure and simplicity. Lakebed informs agent workflows and naming, not a minimalist visual redesign.

## Implementation planning

Core product questions are settled. Implementation planning must specify:

- The supported app and action contract, a common build artifact, and platform-owned access checks for imported apps.
- Workspace identity, invitation and recovery flows, and revocable employee delegation across app calls.
- Knowledge retrieval, upload processing, source permissions, revisions, and observable indexing outcomes. Ordinary background processing of uploads is infrastructure work, not the deferred customer automation product.
- Reservation correctness under retries, concurrent orders, and partial failure.
- Preview isolation, deployment serialization, compatible migrations, release recovery, and separate business-data restore semantics.
- One maintained capability reference for people and agents, verified against the implemented operations.

For the final review, the proposed onboarding default is that a new business's creator becomes its initial workspace owner/admin. Existing teams admit members by invitation and verified email; an email domain alone does not grant membership. These mechanics support the agreed centrally managed membership model and need no enterprise identity setup from the customer.

Hosted agents, schedules, independently authorized unattended service calls, and automatic external-document synchronization remain deferred. Optional previews do not introduce source hosting, code review, or mandatory GitHub integration.

Implementation starts after the consolidated product understanding is confirmed. No implementation, deployment, or live verification has been performed during this interview.

## Observed current behavior

Door consumes an invitation link and issues a 30-day session. There is no returning sign-in flow. The control plane rejects a new invitation for a joined member and instructs the owner to remove and reinvite them.

Claiming currently removes expiration; it does not establish an Atrax account or transfer app management credentials.
