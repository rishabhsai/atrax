# Agent onboarding verification

September 16, 2026. Ticket #27.

## Automated checks

`node --test tests/agent-onboarding.test.mjs` passed.

- The generated guide matches the current bundled skill, and every discovery index names `https://atrax.run/agents.md`.
- The copied `curl -fsSL <served-agents.sh> | sh -s -- --client codex` command installed published `atrax-cloud@0.2.0` in an isolated macOS npm prefix. A repeat returned `already_installed` through the CLI receipt contract.
- The test confirmed the installed skill bytes match the bundled skill. It covered a PATH shadow, an edited-skill conflict, invalid client input, missing Node, missing npm, an incompatible Node version, npm acquisition failure, and an incomplete acquired release.

`node --test tests/integration/agent-installer-linux.test.mjs` passed in Docker using `node:22-bookworm-slim` with an isolated `HOME` and npm prefix. It runs this command inside the container:

```sh
sh /tmp/agents.sh --client codex && sh /tmp/agents.sh --client codex && /tmp/atrax-onboarding-prefix/bin/atrax setup inspect --client codex --json
```

The first setup installed the skill, the second returned `already_installed`, and inspection returned `installed`.

## Public endpoint check

The initial Pages deployment `b1cf0d9c` returned the intended direct HTTPS content and MIME types. Its macOS and Linux isolated-prefix installer logs are in `.scratch/build-wave/public-installer-macos.json` and `.scratch/build-wave/public-installer-linux.log`; endpoint MIME and body evidence is in `.scratch/build-wave/public-entry-proof.json`.

The final Pages deployment `d8a55618` includes the PATH guidance update. Both public URLs returned HTTP 200, the intended MIME types, and bodies exactly matching the final generated files. The site build and all 54 unique internal links in the static export passed.

The installed package's complete local deploy/private-sharing workflow is recorded in [CLI release verification](cli-release-verification.md). Native Claude/Cursor model-login checks remain pending by the user's release decision.
