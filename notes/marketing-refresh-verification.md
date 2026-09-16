# Simple homepage verification

September 16, 2026. Ticket #28. Implementation `df1dae6`.

The homepage restores the approved heading, "A cloud for everyone.", and its exact explanation. The selected ink trees frame the page edges. A visible agent prompt is the primary action; terminal setup has an explicit Codex, Claude Code, or Cursor choice. The shorter capability section uses general descriptions.

Supporting landing pages remove decorative eyebrow labels, use the public CLI and canonical agent guide, and distinguish Library knowledge from planned shared credentials. Product names match the glossary. Human quickstart and CLI references point to the same onboarding and operation discovery.

## Local checks

- Production static build, TypeScript, ESLint, generated onboarding/recipe checks, and diff checks passed.
- All 55 unique internal links in the exported HTML resolve to exported files or routes.
- Browser verification covered 17 landing routes at 1440px and 390px. Each returned HTTP 200 and one main heading, without page overflow, clipped headings, or browser page errors. Homepage was also checked at 768px and 320px.
- Keyboard activation copied the exact visible prompt through the actual browser clipboard. All three selected client commands copied exactly; changing the client reset the prior copy result.
- An actual insecure local HTTP origin made the clipboard API unavailable. The control showed its failure message, focused the text field, and selected the complete payload for manual copying.
- Rendered review corrected the mobile tree crop, heading spacing, footer columns, and layouts whose removed labels had left obsolete grid columns. Company, developer, product, and solution screenshots were inspected.

## Production

Cloudflare Pages deployment: `9614f9e9.tarantula-9l0.pages.dev`, served at https://atrax.run.

Direct production requests to 19 pages returned HTTP 200 and headings matching the final export. The public guide, shell installer, and tree asset returned their intended content types and exact source bytes. Evidence is saved in `.scratch/build-wave/public-site-proof.json`.

The released CLI and public installer are covered in [CLI release verification](cli-release-verification.md) and [agent onboarding verification](agent-onboarding-verification.md). Claude/Cursor model-login checks remain pending by the user's release decision, recorded in [agent setup verification](agent-setup-verification.md).

The production browser smoke check also passed. Enter copied the exact visible prompt; selecting Claude Code copied the exact installer command. Desktop Products navigation opened with Enter and closed with Escape, restoring focus. The phone menu opened and closed without overflow. No browser page errors were observed. Script and result are saved at `/tmp/atrax-production-smoke.js` and `/tmp/atrax-production-smoke-result.json`.
