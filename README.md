# Atrax

Atrax is a cloud for internal software at small businesses. A workspace holds your team's apps, Library, and membership. People use the apps; existing agents build and operate them through the CLI or MCP.

- Site and docs: [atrax.run](https://atrax.run)
- Source: [github.com/rishabhsai/atrax](https://github.com/rishabhsai/atrax)

## Install

Requires Node.js `>=22.13.0` and npm.

```bash
npm install -g atrax-cloud@0.2.2
atrax setup --client codex
atrax new team-chat --template chat
cd team-chat
atrax dev
```

Choose `claude-code`, `codex`, or `cursor` explicitly for skill setup, then start a fresh client session. Setup reports the CLI executable and installed skill location. It preserves locally edited skills and existing client settings.

For an existing static prototype, run `atrax init client-review --assets .` inside its folder. See [static prototype imports](./docs/static-prototypes.md).

## Deploy to a workspace

Local development needs no account. A hosted deployment verifies an email and uses a workspace. The workspace owns the app and its business data.

```bash
atrax deploy --json
```

The CLI returns structured output with the app and workspace identifiers and its URL. Keep `atrax.lock.json`: it identifies the app for future updates. A repeated deploy resumes its saved work where possible.

## What is available

- **Apps:** create, run, and deploy company-owned apps with static assets, declared actions, and persistent D1 migrations.
- **Database:** app-owned SQL records and ordered migrations, with persistent local development.
- **Access:** workspace membership, selected audiences, maintainers, verified external guests, and revocable browser, CLI, and agent sessions.
- **Actions:** typed app-to-app calls with current permission checks and stable business keys for writes.
- **Library:** revisioned company guidance and immutable file versions. Text, Markdown, CSV, and JSON are searchable; PDFs are stored and downloadable. Files are limited to 10 MiB.
- **MCP:** connect an existing agent through the official stdio protocol with a named session and the same workspace permissions.

Shared secrets, hosted agents, scheduled automation, automatic document synchronization, and third-party connectors are deferred from this launch.

## Use the CLI and MCP

```bash
# Search company guidance that the current identity may read
atrax library search "brand" --workspace <workspace-id> --json

# Discover an app's current named actions
atrax call actions.list --input '{"appId":"<app-id>"}' --json

# Connect an existing agent
atrax login --agent "Operations agent"
atrax workspace use <workspace-id>
atrax mcp --workspace <workspace-id>
```

Use `atrax operations list` and `atrax operations inspect <name>` for the installed operation contracts. Run `atrax recipes list` for tested workflows. See [agent recipes](./docs/agent-recipes.md), [private sharing](./docs/private-sharing.md), and [retrying writes](./docs/cli-writes.md). Operation schemas are also published at `/operations.json`. HTTP, CLI, and MCP use the same operation registry. For a write, choose a stable key and reuse it only when retrying the same business intent.

## Work on Atrax

Contributor source installation:

```bash
git clone https://github.com/rishabhsai/atrax.git
cd atrax
git checkout feat/workspace-launch
npm ci
npm link
```


```bash
npm install
npm run dev                 # public site at localhost:3000
npm run lint
node --test tests/mcp.test.mjs
node --test tests/library-files.test.mjs
node --test tests/external-sharing.test.mjs
```

`npm test` builds the static site and runs the full test suite. It is a broader check than the focused commands above.

The app contract and current product scope live in [docs](https://atrax.run/docs). The local [AGENTS.md](./AGENTS.md) describes repository and launch-workflow rules.
