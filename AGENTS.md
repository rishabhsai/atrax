# Project instructions

Host the public site on Cloudflare Pages using standard tooling. Do not use ChatGPT Sites or the Sites plugin.

Treat product directions as pointers toward the simplest clean design. When a requirement exposes a broken model, re-derive the design and explain the correction. Do not add special cases, compatibility shims, duplicate authorization paths, or weakened tests to preserve a broken design.

## Agent skills

Before planning or implementing launch work, read `docs/agents/launch-workflow.md` for task ownership and verification rules.

- Issue tracker: GitHub Issues in `rishabhsai/atrax`; see `docs/agents/issue-tracker.md`.
- Triage labels: defaults; see `docs/agents/triage-labels.md`.
- Domain: one glossary and decision context; see `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
