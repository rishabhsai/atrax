# Atrax

A cloud for everyone, operated through an agent-native CLI. Atrax scaffolds a full-stack app, runs it locally with persistent data, and deploys it — a Worker, a SQL database with ordered migrations, static assets, and a real URL — from one command. No account needed to start.

- Site and docs: [atrax.run](https://atrax.run)
- Agent entrypoint: [atrax.run/agent](https://atrax.run/agent)
- Source: [github.com/rishabhsai/atrax](https://github.com/rishabhsai/atrax)

## Start

Requires Node.js `>=22.13.0`.

```bash
npx atrax-cloud new my-app
cd my-app
npx atrax dev
npx atrax deploy --instant
```

`deploy --instant` needs no Cloudflare account. The app lands on `https://<name>.atrax.run` and the deploy prints a claim token once — claim the app to keep it, or it disappears in 30 days:

```bash
npx atrax claim <token>
```

With an authenticated Cloudflare Wrangler session, `atrax deploy` provisions into your own account instead.

## What you get

```bash
atrax inspect --json      # what is running, claimed state, expiry
atrax tables export       # every user table as JSON — your data is never locked in
atrax secret set NAME     # instant apps: set a Worker secret (value read from stdin)
atrax share add a@b.com   # shared apps: invite a member by email
atrax logs                # Cloudflare-account deploys
atrax plan / atrax drift  # Cloudflare-account deploys: preview and detect drift
atrax delete --yes        # tear everything down
```

Every finite command speaks versioned JSON with `--json`, so coding agents can operate the whole platform. Point an agent at `curl -fsSL https://atrax.run/agent` for the docs, app contract, and safety rules.

## Status

Launchpad (deploys) and Tables (SQL with migrations) are v0 and available. Door (sign-in and sharing) ships in a v0 form on instant apps. Library, Switchboard, and Loops are planned; [atrax.run/docs/status](https://atrax.run/docs/status) says exactly where everything stands.

## Working on Atrax itself

This repository also holds the product site (Next.js, exports to `out/`) and the instant-hosting control plane (`control-plane/`).

```bash
npm install
npm run dev     # site
npm test        # builds the site, then runs every test
npm run lint
```

The provider-neutral product contract is in [SPEC.md](./SPEC.md); the account and control-plane design is in [CONTROL_PLANE.md](./CONTROL_PLANE.md).
