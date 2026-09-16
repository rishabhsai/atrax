# Workspace experience proposal

Status: the workspace, per-app access, Home, direct app URLs, and a flat member/maintainer model are agreed. First hosted deployment establishes verified identity and workspace ownership. Agents may perform ordinary work with their employee's permissions. Inventory + Orders and agent-contributed company knowledge are in scope. Hosted agents and background automations are deferred.

## Product shape

Atrax hosts the complete app, including its interface and backend. Each app has its own URL. Employees can bookmark it or discover it from a workspace home that lists the apps they can access. The home links to the same apps; it does not embed or duplicate them.

Atrax provides a simple cloud-platform experience. Source hosting and code collaboration stay with GitHub or the user's existing tools. Deployment history and optional isolated previews concern running versions of apps and do not require building a code-review or source-control product.

The workspace home gives employees a useful place to start. It is distinct from the previously deferred infrastructure account dashboard. Launch also includes basic team and app-access management.

## Agreed access default

New apps are company-only and available to all workspace members. An app can be explicitly restricted to selected people. Workspace admins control invitations to external guests and public publishing. The interface must display the actual audience, including any guests. Permission to use an app remains distinct from permission to change it.

Every member can create an app and becomes its first maintainer. Maintainers can change and deploy their apps and invite other maintainers. The workspace owns the app, so its data and operation survive its creator leaving. Reserve Owner for responsibility for the workspace.

An app's exposed actions default to everyone in the workspace. Its maintainer can select the audience at deployment and restrict specific actions for particular people. This policy grants ongoing access, so ordinary internal calls within it do not require a second connection-approval workflow. UI, API, and agent calls must enforce the same action restrictions. Hosted service agents and their independent unattended permissions are later work.

## Agreed onboarding

Creating and running an app locally needs no sign-in. The first hosted deployment verifies the creator's email and creates or joins a workspace. The app belongs to that workspace immediately, with no separate claim step and no customer Cloudflare account.

An existing HTML or React frontend can keep its interface. The agent handles backend adaptation to the documented Atrax runtime contract and explains incompatibilities before deploying. Deployment should complete the hosting, data, and access setup in one flow.

## Alternatives

- Backend only: developers build or host the employee interface elsewhere. This changes the agreed complete-app deployment promise and adds assembly work for small businesses.
- Mandatory portal: every visit starts in Atrax. This makes discovery consistent but adds navigation and weakens direct links to specific work.
- Direct app URLs plus a workspace home: one app can be opened from a bookmark, a message, or a directory. Agreed.

## Proposed vocabulary

- App: the internal software people use, such as inventory or an approvals app. Already in the glossary.
- Workspace: the business's apps and team. Already in the glossary.
- Home: the workspace page listing apps the signed-in member can open.
- Action: a named operation an app offers to people, agents, or other apps, such as checking or reserving stock. Now in the glossary.
- Connection: authorized access from an app or agent to another app or external service.
- Release: a deployed version of an app's code and assets. Now in the glossary.

Use “tool” informally for internal software, but use “app” in the product. Reserve technical tool-calling terminology for agent documentation where it is needed.

## Distinct permissions

Using an app, invoking one of its actions, and changing its deployed code are separate permissions. Connecting an agent to a workspace must not automatically grant all three.

An employee's agent can perform ordinary work within that employee's permissions without asking for approval every time. Each operation checks access, and Activity records the person and agent responsible. Deleting an entire app or opening it to the public requires deliberate confirmation from someone authorized.

An agent can help build or update an app through Atrax. Reusing another app means invoking an explicitly exposed action with permission, not silently gaining database access or copying live data.

## Example

A small business has Inventory and Orders apps. Staff open them directly or from Home. Creating an order calls Inventory to reserve stock. Staff can perform this work through the interface or their agent. A retried request cannot reserve stock twice. Permission to reserve stock does not grant access to change Inventory's code or read its entire database.

The user selected this connected workflow as the primary launch demonstration. Shared company context extends the workflow through Library. An authorized agent can save a user-provided preference, such as "we don't use blue in this company," through a tool call. Other authorized agents and apps can retrieve that knowledge for future work. Live stock and order records remain owned by their apps.

People can manually upload company files to Library, and agents can upload files through the CLI. Agent-created entries and uploaded files contribute to the same shared knowledge. Automatic synchronization with external document services is deferred.

Ordinary authorized members and their agents can correct company guidance, with attribution and revision history. An explicit correction updates the existing entry. The agent asks for clarification when a contradiction does not clearly establish new guidance.

## Current scope

The consolidated build brief and implementation-planning questions are maintained in [launch-scope.md](./launch-scope.md). Core product decisions are settled, with a final shared-understanding review before implementation.

The app's exposure policy now supplies internal action access. Independent unattended calls and hosted agents are deferred. Preview isolation and code/data recovery remain hosting concerns under the agreed GitHub boundary; their implementation details do not require a source-control product.
