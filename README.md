# Atrax

Atrax is a cloud for everyone, operated through an agent-native CLI. The current v0 can scaffold a public chat, run it locally with persistent data, provision D1, apply migrations, deploy a Worker with static assets, and return a shareable URL.

The product site lives in this repository too.

## Install the local alpha

Requires Node.js `>=22.13.0` and an authenticated Cloudflare Wrangler session.

```bash
npm install
npm link
atrax --version
```

## Deploy the chat example

```bash
atrax new open-chat --template chat
cd open-chat
atrax dev
atrax deploy --json
```

The generated app is public. Visitors do not log in, and anyone with its URL can read and post messages. Posts are capped at 4 KiB and 12 messages per IP per minute; only the latest 500 messages are retained.

After deployment:

```bash
atrax plan --json
atrax drift --json
atrax inspect --json
atrax logs
```

`plan` previews what a deploy would change. `drift` compares the provider with the lockfile and exits `2` when they no longer match.

`atrax.lock.json` stores stable, non-secret resource identities. Commit it so another checkout updates the same app. It is not the future authoritative infrastructure state; `.atrax/wrangler.jsonc` is a disposable provider artifact.

## Product status

Available now:

- Launchpad v0: Cloudflare Worker, static assets, stable `workers.dev` URL, local development, read-only plan and drift, deployment inspection, and logs
- Tables v0: D1 provisioning, ordered migrations, persistent local data, and persistent deployed data
- Public chat template with validation and safe text rendering
- Versioned JSON output for coding agents

Planned:

- Door: login, teams, sharing, and roles
- Library: files and company knowledge
- Switchboard: vaults, connected tools, and scoped app-to-app grants
- Loops: functions, webhooks, schedules, queues, and operational agents
- Named stacks, remote locked state, previews, custom domains, rollback, private apps, backups, and a control panel

The provider-neutral product contract and reconciliation model are in [SPEC.md](./SPEC.md).
The account identity, project registry, and CLI device flow are in
[CONTROL_PLANE.md](./CONTROL_PLANE.md).

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
