# Quickstart

Status: available

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
