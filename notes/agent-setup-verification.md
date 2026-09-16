# Agent setup verification

September 16, 2026. [Install Atrax's skill through the CLI](https://github.com/rishabhsai/atrax/issues/26).

The versioned `atrax-cloud` package includes its Atrax skill. `atrax setup` installs, inspects, updates and removes it for one explicit local client. Installation changes only Atrax-owned files; edited content produces a conflict. Setup reports the CLI executable/version and skill revision/location.

## Verified

- 11 packaged lifecycle tests: install, repeat, inspect, upgrade, local-edit conflict, concurrent setup, crash recovery, I/O failure, removal, PATH shadowing, and preservation of client files.
- Actual package installation and local app creation/build/HTTP serving on macOS arm64 and Linux arm64. Linux used a clean Node 22 container without source checkout, Atrax account or Cloudflare credentials. All three client directory selections passed install/no-op/inspect/remove there.
- Codex 0.154.0 discovered the skill in a fresh user profile. A fresh model session used the installed 0.2.0 package to create, build and serve a static app, verified HTTP 200 and readable HTML, then stopped it.
- Claude Code 2.1.272 discovered the skill and expanded `/atrax` into a local recording model endpoint.
- Cursor's skill was installed at its documented personal path using the exact package artifact. Native model use was not tested.

## Scope decision

The user explicitly stopped further Claude/Cursor login-dependent checks and asked to proceed with the release. Model-driven creation in those two clients is not a release gate. This record does not claim those tests passed.

Client directory sources: [Codex](https://learn.chatgpt.com/docs/build-skills), [Claude Code](https://code.claude.com/docs/en/skills), [Cursor](https://cursor.com/docs/skills).
