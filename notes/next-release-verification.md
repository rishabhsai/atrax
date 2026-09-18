# Atrax 0.3.0 source verification

Date: September 17, 2026.

## Release state

This is a source candidate. The public npm CLI remains `atrax-cloud@0.2.1`. This work did not deploy a control plane, apply a remote migration, publish npm, change a production credential, or send external email.

The implementation ran in an isolated checkout outside the Desktop directory, with its own dependencies. The original checkout contains unrelated untracked files that were preserved.

## Delivered

- A fresh-user lifecycle test covers public installation, app creation, local persistence, first deployment, recipient-only sharing, update with retained data and URL, and immediate revocation. It exposed and fixed the requirement that every selected audience contain a workspace member. Maintenance authority remains separate from live app use.
- Shared Secrets adds encrypted credential storage, administrator management, named app grants, rotation, and revocation. CLI, HTTP, MCP, and the workspace console use the same operations. Live app actions retrieve credentials with current request authority; previews cannot retrieve live credentials. Management returns metadata only.
- App operations adds recorded deployment state, failure details, release history, action counts, and existing code rollback and database recovery operations to the console. Action counts are not billing or uptime measurements.
- The pricing report compares current competitors and models Cloudflare usage, support, and payment costs. It identifies per-app domains and accumulated Worker scripts as capacity constraints before broad self-serve launch.

## Checks

- Production Next.js build: passed, including `/workspace/secrets/`, `/docs/secrets/`, and `/docs/operations/`.
- TypeScript, ESLint, generated recipe checks, and `git diff --check`: passed.
- Control-plane build and Wrangler upload dry run: passed.
- CLI package staging: passed for `atrax-cloud@0.3.0`.
- Full source suite: **198 passed, zero failures or skips**, using `node --test --test-concurrency=2 tests/*.test.mjs`. The final run completed in 151.5 seconds.
- The public `0.2.1` installer was exercised in isolated HOME/npm/skill directories. Both that installed client and the source candidate completed the fresh-user pilot against the current local backend.
- Independent Secrets review exercised authorization, concurrent writes, idempotency, cross-workspace isolation, preview denial, and credential-free operation responses. No unresolved material findings remained.

The first full suite found that the new Secrets write shortcuts were missing from the existing documentation-driven retry-key coverage. The fix extends the real CLI cases and documentation, preserving the requirement that every documented keyed shortcut is exercised.

## Browser verification

Secrets was opened directly at `/workspace/secrets/?workspace=company` against the real local control plane. Browser interaction created a disposable credential, granted an app binding, rotated the value, and revoked it. A fresh page load confirmed the revoked state. Desktop and 320px screenshots were inspected. The editor preserves the console's established layout and fits the narrow viewport.

The app operations console was inspected at desktop and 320px widths, including keyboard focus, failed deployment details, code rollback review, database restore review, and access controls. The manual browser fixture does not contain a deployment coordinator, so browser recovery checks stopped at review/cancel. Automated deployment and recovery tests use the real local Durable Object with a provider fixture.

See [fresh-user evidence](fresh-user-pilot.md) and [app operations browser evidence](app-operations-verification.md).

## Before hosted rollout

1. Follow the [launch runbook](../docs/operations/launch-runbook.md). Apply migration `0016_workspace_secrets.sql` and provision the environment's encryption key with an operator recovery copy. Master-key replacement without re-encryption is not supported.
2. Deploy the control-plane candidate and verify it against actual Cloudflare resources. Local provider fixtures do not prove hosted provisioning or email delivery.
3. Publish the matching CLI and run `npm run test:published` and the Linux installer check against that exact registry version. These checks remain separate from pre-publication source tests, with their real installation and bundled-skill assertions intact.
4. Build the Pages export from committed source in an isolated directory. Publish onboarding files pinned to `0.3.0` only after that CLI exists in npm.
5. Rebuild and normally deploy existing apps that will use Secrets, retaining their lockfiles. They need the new runtime method and live gateway binding. Verify a disposable credential through grant, action use, rotation, revocation, and preview denial on the hosted stack.
6. Repeat the recipient-only lifecycle against the hosted service before calling this a production release. Claude Code and Cursor login-dependent checks remain pending by the user's earlier direction.

## Commercial follow-up

The proposed $49 Team and $149 Business workspace plans are research recommendations. No prices, billing integration, or usage enforcement were published. Run a small measured pilot, validate willingness to pay and support time, and correct routing/runtime capacity before opening broad self-serve signup. See [pricing research](pricing-research.md).
