# Quickstart

Create an app, run it locally, and share it with your company.

## Install Atrax

Use Node.js 22.13 or newer with npm. Install the published CLI, then choose your local agent for the bundled skill. Supported clients are claude-code, codex, and cursor. Start a fresh agent session after setup. Local development needs no account.

```
npm install -g atrax-cloud@0.2.0
atrax setup --client codex
atrax new team-chat --template chat
cd team-chat
atrax dev
```

## Deploy to your workspace

Run deploy from the app directory. On your first hosted deploy, follow the one-time browser approval link and verify your email. If you do not have a workspace yet, create one or accept a team invitation on that approval screen, then connect the CLI. Deployment continues with your only workspace automatically. Your company owns the app; you become its first maintainer.

You do not need a Cloudflare account. The app is company-only by default: every current workspace member can open it.

```
atrax deploy --json
```

Read the returned URL. Do not guess a hostname. Keep atrax.lock.json: it identifies this app for future updates.

## Invite your team

Open Home, then Team to invite a coworker by email. They verify that address and join the workspace. Workspace-wide apps become available immediately.

Use the app’s sharing controls to select people, appoint another maintainer, or restrict an action. Removing a teammate revokes their existing app and agent access.

## Update without starting over

Edit the app, check it locally, then deploy again. The app keeps its URL and business database. A private candidate is checked before promotion.

If a request is interrupted, repeat atrax deploy. The CLI resumes its saved artifact and deployment rather than creating another app.

```
atrax build
atrax deploy --json
```

## Connect your existing agent

Sign in with an agent label, then configure your MCP client to run atrax mcp. The agent uses your permissions.

```
atrax login --agent "My coding agent"
atrax workspace use <workspace-id>
atrax mcp --workspace <workspace-id>
```
