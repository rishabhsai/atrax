# Atrax workspace console

Current naming and navigation guidance, updated September 16, 2026. This replaces the earlier design proposal. Definitions live in `CONTEXT.md`; supported operations live in the shared registry.

## Navigation and routes

The console presents real workspace, app, Library, and team state. The public site links to Workspaces. A workspace's name supplies the current context above Apps, Library, and Team.

| Destination | Route | Purpose |
| --- | --- | --- |
| Workspaces | `/workspaces/` | Choose or create a workspace; review invitations |
| Apps | `/workspace/?workspace=<id>` | Find and open the workspace's permitted apps |
| App details | `/workspace/app/?appId=<id>` | App overview, release, actions, access, maintainers, guests, and public web |
| Library | `/workspace/library/?workspace=<id>` | Company files and knowledge entries |
| Library item/history | The Library route with `item` and optional `revision` query values | Read and correct knowledge or inspect file versions |
| Team | `/workspace/team/?workspace=<id>` | Membership, invitations, roles, and ownership transfer |

Apps is the existing app directory, formerly labeled Home. Keep a single directory destination. Account refers to the person and their sessions, not the workspace selector. Workspace handle labels the creation slug; do not call it a web address without an actual address to show.

## Visual guidance

Use a light console with warm paper neutrals, dark readable text, orange selection and primary actions, and familiar form controls. Keep the selected workspace, verified email, and actual role visible. Show workspace switching when there is a choice. Separate the console from marketing artwork and examples.

Use one primary action per task area. Destructive operations explain their effect and require the supported confirmation. Technical identifiers appear only where they help a person inspect or operate the resource. Never invent app health, deployment history, people, or activity.

## Apps

List the apps the current person can discover. Show actual app names, deployment state, access summary, and maintenance relationship. Open app navigates to the authorized public app URL returned by the platform. Settings access does not imply permission to open an app.

Create an app leads to the published agent/CLI workflow; it does not create an empty hosted builder. Empty and failed states are different: a failed fetch offers retry rather than an empty app list.

App details uses the workspace Apps breadcrumb and app name. The existing sections cover overview, current release, app actions, access, and external sharing. Additional tabs are not required for a naming change.

## Access

Keep these distinctions visible:

- App audience: Everyone in the workspace or Selected people.
- Maintainers: members permitted to change, deploy, and manage the app.
- Action access: the audience and explicit restrictions for each action.
- Guests: verified outsiders granted access to this app and selected actions.
- Public web: static pages can be loaded anonymously; actions and company knowledge retain their access rules.

Company-only describes the default audience before outside access is granted. Guest grants add access without revoking existing workspace access. Do not summarize every sharing setting using only the app's workspace audience.

A person can have permission to use an app without permission to maintain it, or use the app without permission for every action. The server enforces these distinctions for browser, CLI, MCP, and app-to-app requests. Hidden controls are not authorization checks.

## Library and Team

Library contains files and knowledge entries. Company knowledge describes its contents; shared context describes their use by apps and agents. Files and entries retain attribution, revisions, and source permissions. Current operational records belong to apps. Secrets is a separate planned capability.

Team contains members and invitations. Owner, Admin, Member, Maintainer, and Guest retain their glossary meanings. Removing membership revokes current workspace access. An account may remain valid in other workspaces.

## Sign-in and existing agents

People verify their email. Deep links preserve the exact permitted return destination through sign-in; unsafe destinations fall back to Workspaces. A CLI or agent connection shows its identity and requires the person to approve the device request.

An existing agent can inspect and call the same operation contracts as the console. Keep the terms distinct: a platform operation manages Atrax resources; an app action performs business work; an MCP tool exposes an eligible platform operation. Hosted agents and Automation are planned.

## Accessibility and verification

Support keyboard navigation, visible focus, meaningful labels, live status feedback, and layouts down to a 320px mobile viewport. The mobile menu closes after navigation and returns focus when dismissed. Read-only, pending, error, conflict, and empty states remain distinct.

Verify actual route entry and refresh, sign-in return destinations, workspace selection, app navigation, Team changes, Library work, and permission failures through their real interfaces. Use owned test resources; production begins with the real account state.

Activity has a backend operation contract, but there is no workspace Activity destination in the current console. A general data browser, account settings page, hosted agent editor, and scheduling console are not implied by these names.
