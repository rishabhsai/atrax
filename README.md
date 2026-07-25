# Tarantula

Tarantula is an agent-native CLI for small full-stack apps on Cloudflare. The current v0 can scaffold a public chat, run it locally with persistent data, provision D1, apply migrations, deploy a Worker with static assets, and return a shareable URL.

The product site lives in this repository too.

## Install the local alpha

Requires Node.js `>=22.13.0` and an authenticated Cloudflare Wrangler session.

```bash
npm install
npm link
tarantula --version
```

## Deploy the chat example

```bash
tarantula new open-chat --template chat
cd open-chat
tarantula dev
tarantula deploy --json
```

The generated app is public. Visitors do not log in, and anyone with its URL can read and post messages.

After deployment:

```bash
tarantula inspect --json
tarantula logs
```

`tarantula.lock.json` stores the Cloudflare account, Worker, database, and URL without storing credentials. Commit it so another checkout updates the same app.

## Product status

Available now:

- Launchpad v0: Cloudflare Worker, static assets, stable `workers.dev` URL, local development, deployment inspection, and logs
- Tables v0: D1 provisioning, ordered migrations, persistent local data, and persistent deployed data
- Public chat template with validation and safe text rendering
- Versioned JSON output for coding agents

Planned:

- Door: login, teams, sharing, and roles
- Library: files and company knowledge
- Switchboard: vaults, connected tools, and scoped app-to-app grants
- Loops: functions, webhooks, schedules, queues, and operational agents
- Previews, custom domains, rollback, private apps, backups, and a control panel

The proof deployment is [tarantula-chat-demo.rishabhsai-mdbar.workers.dev](https://tarantula-chat-demo.rishabhsai-mdbar.workers.dev).

## Work on the product site

```bash
npm run dev
npm run lint
npm test
```

The Next.js site exports to `out/` and deploys to Cloudflare Pages with:

```bash
npm run deploy
```
