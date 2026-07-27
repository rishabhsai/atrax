# Public chat example

Status: available

The template contains a static UI, Worker API, server validation, D1 migration, tests, `AGENTS.md`, and the Atrax app contract.

```bash
atrax new open-chat --template chat
cd open-chat
atrax dev
atrax deploy --json
```

Two browsers see the same rows through short polling. Messages survive refresh and redeploy. User text is rendered with `textContent`.

Public-write guardrails cap request bodies at 4 KiB, allow 12 messages per IP per minute, and retain only the latest 500 messages.

Public means public. Anyone with the URL can read and post.
