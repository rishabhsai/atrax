# Quickstart

Status: available

Brief a coding agent with the read-only agent reference:

```bash
curl -fsSL https://tarantula-9l0.pages.dev/agent
```

This prints the current docs map, contract rules, and safe CLI workflow. It does not execute a script or change the machine.

```bash
git clone https://github.com/rishabhsai/tarantula.git
cd tarantula
npm install
npm link
tarantula new open-chat --template chat
cd open-chat
tarantula dev
tarantula deploy --json
```

The deployer uses an authenticated Wrangler session. The generated chat is public and requires no visitor login.

Inspect the live state with `tarantula inspect --json` and stream requests with `tarantula logs`.
