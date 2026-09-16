# Atrax

Atrax is a cloud for internal software at small businesses. People and coding agents use it to create, run, deploy, and share the apps a business needs.

## Language

**App**:
The software a customer builds and operates through Atrax, including its data and access rules. A hosted app belongs to its workspace and survives its creator leaving.

**Launchpad**:
The Atrax product for deploying and hosting apps.

**Tables**:
The Atrax product for an app's SQL data and ordered migrations.

**Library**:
The Atrax product for files and shared company knowledge that authorized people, apps, and agents can read and contribute to.

**Company knowledge**:
The business's shared policies, terminology, documents, preferences, and saved decisions. Agents can contribute knowledge through an authorized tool call; current business records remain in the apps that own them.
_Also called_: Shared context
_Avoid_: Conversation archive

**Shared secret**:
An API key, password, or other credential that a company manages for use by authorized apps and agents. Shared secrets are distinct from company knowledge.
_Avoid_: Library entry

**Knowledge entry**:
A saved item of company knowledge, such as a brand preference or supplier policy, with attribution and revision history. Authorized members and their agents can correct it for future work.

**Door**:
The Atrax product for sign-in and access to customer apps. Atrax account identity is a separate concept.

**Workspace**:
A business's shared home for its apps and team. Team membership is managed centrally, and new apps are available to the whole workspace by default.

**Member**:
A person who belongs to a workspace and can create apps and use workspace-wide apps. An explicitly restricted app can limit access to selected people.

**Owner**:
The person with overall responsibility for a workspace. Apps belong to the workspace, rather than to their individual creators.
_Avoid_: App owner

**Admin**:
A workspace member who manages the team and controls external sharing and public publishing.

**Maintainer**:
A workspace member who can change and deploy an app, configure its action audience, and invite other maintainers. An app's creator is its first maintainer.

**Release**:
A version of an app's deployed code and assets. Deploying a release preserves the app's identity, URL, and business data.

**Action**:
A named operation an app offers to people, agents, or other apps, such as checking stock or reserving it. Calling an action requires permission for that operation.

**Action access**:
The people allowed to call an app's exposed actions, including through their agents. The default is everyone in the workspace; a maintainer can select an audience and restrict particular actions for particular people.

**Activity**:
The record of changes and operations in a workspace, including the person and agent responsible.

**App access**:
Permission to use an app, granted to the workspace by default or explicitly to selected people. Removing someone from the workspace revokes their access to all its apps.

**App sign-in**:
A person proves control of their email to use an app they are allowed to access, including on a new device or after a session ends.

**Home**:
The workspace page where a member finds the apps they can use. Each app also has a direct URL.

**Company-only access**:
An app is available to everyone in its workspace and to nobody outside it. This is the default access policy for a new workspace app.

**Guest**:
A named person outside the workspace team who is explicitly granted access to specific apps.
