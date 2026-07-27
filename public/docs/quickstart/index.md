# Quickstart

Status: available

Brief a coding agent with the read-only agent reference:

```bash
curl -fsSL https://atrax.run/agent
```

This prints the current docs map, contract rules, and safe CLI workflow. It does not execute a script or change the machine.

```bash
git clone https://github.com/rishabhsai/tarantula.git
cd tarantula
npm install
npm link
atrax new open-chat --template chat
cd open-chat
atrax dev
atrax deploy --json
```

The deployer uses an authenticated Wrangler session. The generated chat is public and requires no visitor login.

## Deploy without a Cloudflare account

```bash
atrax deploy --instant
atrax claim <token>
```

Deploy takes this path on its own when no Cloudflare account is detected; `--instant` forces it. Atrax posts the app to its own hosted control plane and returns a real public URL plus a claim token, printed exactly once by the deploy that minted it. An unclaimed app is deleted 30 days after it was created. `atrax claim <token>` keeps the same URL and stops the expiry. Instant deploys are capped at 10 per day per IP.

Every instant deploy names who can open the URL. A public app prints `This app is public: anyone with the URL can open it.`, and the JSON carries `"access": "public"`. Shared apps work here too: set `"visibility": "shared"` in `atrax.json`, deploy, and `atrax share add <email>` invites people the same way it does on a Cloudflare account.

```bash
atrax share add ana@example.com --json
```

Inspect the live state with `atrax inspect --json` and stream requests with `atrax logs`.
