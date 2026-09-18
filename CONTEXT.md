# Atrax

Atrax is a cloud for internal software at small businesses. People and coding agents use it to create, run, deploy, and share the apps a business needs.

## Identity and ownership

**Account**:
A person's Atrax identity, which can belong to multiple workspaces and have browser, CLI, and agent sessions.
_Avoid_: Workspace, company account

**Workspace**:
A business's shared scope for apps, Library, and team membership. Hosted apps belong to a workspace, and new apps are available to its members by default.
_Avoid_: Account, project, Launchpad

**Team**:
The people who belong to a workspace, and the place where members and invitations are managed.

**Member**:
A person who belongs to a workspace. Membership grants access to workspace-wide apps; an explicitly restricted app can select a smaller audience.

**Owner**:
The person with overall responsibility for a workspace. Apps belong to the workspace rather than to their creators.
_Avoid_: App owner

**Admin**:
A workspace member who manages the team and controls external sharing and public publishing.

**Maintainer**:
A workspace member who can change and deploy an app, manage its access, and assign other maintainers. An app's creator is its first maintainer.

**Guest**:
A person outside the workspace team who is explicitly granted access to specific apps.

## Apps and data

**App**:
The software a customer builds and operates through Atrax, including its data and access rules. A hosted app keeps its identity when updated and survives its creator leaving.

**Apps**:
Atrax's app hosting capability and the workspace directory where people find their permitted apps.
_Avoid_: Launchpad, Home

**Project**:
The local source files used to build an app. A project is not another hosted ownership container.

**Database**:
An app's persistent SQL records and schema. Other apps use its actions to work with those records.
_Avoid_: Tables as a product name, shared company database

**Release**:
An immutable built version of an app's code and assets.

**Deployment**:
An attempt to prepare and run a release. An app keeps its identity, live URL, and business data through ordinary deployments.

## Access and actions

**Access**:
Atrax's sign-in, authorization, and sharing capability.
_Avoid_: Door as a product name

**App access**:
Permission to use an app, granted to the workspace by default or explicitly to selected people. Removing a member revokes their workspace-derived access.

**Action**:
A named operation an app offers to authorized people, agents, or other apps, such as checking stock or reserving it. Actions is the name of this capability.
_Avoid_: Switchboard, tool when referring to an app action

**Action access**:
Permission to call an app's exposed actions. Maintainers can select an audience and restrict particular actions for particular people.

**Company-only access**:
An app is available to everyone in its workspace and to nobody outside it. This is the default for a new workspace app.

**Sharing**:
Granting or adjusting access to an app or its actions. A guest grant adds access without removing the existing workspace audience.

**App sign-in**:
A person proves control of their email to use an app they are allowed to access, including on a new device or after a session ends.

**Public web**:
An app's static web pages can be loaded without signing in. Its actions and company knowledge retain their own access rules.
_Avoid_: Public app when only web assets are public

**Activity**:
The record of changes and operations in a workspace, including the person and agent responsible.

## Company knowledge and credentials

**Library**:
The workspace collection of files and company knowledge that authorized people, apps, and agents can read and contribute to.

**Company knowledge**:
The business's policies, terminology, documents, preferences, and saved decisions. Current business records remain in the apps that own them.
_Also called_: Shared context
_Avoid_: Conversation archive

**Knowledge entry**:
A saved item of company knowledge with attribution and revision history. Authorized contributors can correct it for future work.

**Secrets**:
The capability for company credentials such as API keys and passwords, distinct from Library. Workspace admins manage credentials and grant named bindings to trusted app backends. Agents manage references with the same permissions; management operations return metadata only.
_Avoid_: Library entry, company knowledge

**Shared secret**:
A credential a company manages for use by authorized apps and agents.

## Agent interfaces and future execution

**Platform operation**:
A named Atrax request for managing or using workspace resources. An operation may create an app, change membership, or invoke an app action.

**MCP tool**:
A platform operation exposed to an existing agent through Atrax's MCP connection. App actions are discovered and invoked through the corresponding platform operations.

**Agent session**:
A named, revocable connection acting with a person's current permissions. It is not a hosted agent.

**Automation**:
The planned capability for scheduled and background execution, separate from ordinary request-driven app actions.
_Avoid_: Loops
