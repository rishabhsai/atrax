# Fresh-user pilot: exact-recipient app sharing

Date: 2026-09-17

## Scenario

Starting only from `https://atrax.run/agents.md` and its installer, act on this request:

> Deploy this app and give me a link only alex@company.com can open.

The pilot used `alex@example.com` in the local mailbox instead of contacting the example in the request. It covered new-app creation, local development, local persistence, the first-deploy device flow, private sharing, an update at the same URL with retained data, and revocation.

## Evidence

- The public installer completed in isolated HOME, npm-prefix, config, and skill directories. It installed `atrax-cloud@0.2.1`, placed the Atrax skill under the isolated client directory, and printed a usable CLI path.
- The public files fetched during the pilot were:
  - `agents.md`: `c38e823b50683136a2275daea427d3f636e70f46ae489273f8172c07876ea68f`
  - `agents.sh`: `b18ca3410d209cb28c1536e46a87a4ae1421d3117ee275ab1bb3a24354f0b560`
- The source candidate identifies as `0.3.0`; the public installer remains pinned to `0.2.1`.
- `tests/fresh-user-pilot.test.mjs` passed with the source CLI and again with the exact isolated public `0.2.1` CLI. Both runs used the current local source control plane, gateway, runtime, Worker, D1, and R2 implementation.
- The test started `atrax dev`, wrote a chat message, stopped the process, started it again with the same isolated config, and read the same message from `.atrax/state`.
- The test built the app and exercised a first `atrax deploy`. It created a workspace before device approval, matching the real `DeviceApproval` browser flow, then completed deployment.
- The app was restricted to `audience: selected` with `personIds: []`. The owner retained maintenance authority but received `403` when opening the live app.
- Only the synthetic Alex identity could accept the invitation. A different signed-in synthetic email received `invitation_email_mismatch`; an uninvited outsider received `403` for app and action access.
- Alex opened the private live app and called its granted `messages.list` action. After a second deployment, the URL was unchanged, updated assets were visible, and the prior hosted message remained in the app database.
- Revoking Alex immediately made the existing app session and a new app-open attempt return `403`.
- Every invitation email stayed in the local mailbox and used an `example.com` recipient.

The tests use the real local product boundary, including Workers, D1, R2, gateway authorization, app sessions, and runtime data. Cloudflare provisioning is simulated by the test provider. This is not proof of a live hosted Cloudflare deployment, production email delivery, or the production control plane. No production resource was deployed or changed.

## Ranked findings

### 1. Critical: the permission model could not express “only this external recipient”

The released model required a selected app or action audience to contain at least one workspace person. `atrax share` correctly preserved existing workspace access, so the literal request could not be completed truthfully. Adding an owner to the selected audience would have violated the request.

There was no recorded rationale for coupling maintenance authority to live app use. Existing architecture already models maintenance and app use separately. The clean contract is:

- an empty selected audience grants no workspace member live app access;
- maintainers retain deployment and access-management authority;
- live assets and actions still require explicit app access;
- candidate inspection is available only to a current maintainer;
- maintenance health checks are limited to HTTP requests with no action name.

The source candidate now implements that contract across access validation, initial deployment policies, app and action sharing UI, live/candidate login, candidate health authorization, and app inspection. Tests cover excluded maintainers, ordinary administrators, live denial, candidate access, and empty action audiences.

### 2. High: “only this recipient” requires cleaning all access paths

An empty workspace audience is insufficient when the app is public, another guest is active, or another invitation is pending. A pending invitation can become access later. Interactive apps also need the actions used by their UI; an invitation without action grants can open assets while leaving the app unusable.

`docs/private-sharing.md` and the executable agent recipe now require the agent to:

1. inspect published actions and grant the actions the UI needs;
2. set the workspace audience to selected with an empty person list;
3. turn off public web access;
4. revoke other active guests;
5. cancel pending invitations for other emails; and
6. read the sharing state again before claiming success.

Maintainers remain trusted to manage the app, but cannot use its live interface unless separately granted access.

### 3. High: the public `0.2.1` default template contradicts the deployed privacy model

The generated default chat describes itself as a public room and says anyone with the URL can join, although deployed apps are private by default. It also leaves `__APP_NAME__` in `public/index.html` because the public package does not include that file in template substitution.

Both issues are fixed in the `0.3.0` source candidate. The public installer is still pinned to `0.2.1`, so a newly installed public client continues to show the old generated copy until publication.

### 4. Medium: `atrax share` is intentionally additive, but that is easy to misread

The command creates an exact-email guest invitation while preserving public and workspace policy. Its structured result exposes that fact, but a fresh agent can still read “share with Alex” as “make Alex the sole audience.” The source candidate's human output now explicitly says when no workspace member can open the live app, and the private-sharing guide documents the complete guest-only composition.

### 5. Verified non-issue: first device approval already handles a user with no workspace

A low-level test that approved a device code without first creating a workspace produced a CLI with no deploy target. That sequence bypassed the supported browser UI. `components/console/DeviceApproval.tsx` asks a new user to accept an invitation or create a workspace before it shows the CLI approval control. The pilot now follows that flow and first deploy succeeds.

## Verification commands

```sh
node --test tests/fresh-user-pilot.test.mjs
ATRAX_PILOT_CLI=/tmp/atrax-pilot-install.Hox9m5/prefix/bin/atrax \
  node --test tests/fresh-user-pilot.test.mjs
node --test tests/sharing.test.mjs tests/app-login.test.mjs \
  tests/deployments.test.mjs tests/fresh-user-pilot.test.mjs \
  tests/sharing-cli.test.mjs tests/agent-recipes.test.mjs
node scripts/generate-agent-recipes.mjs --check
```

The combined focused run passed 36 tests. The source and public-CLI pilot runs each passed independently.

## Remaining proof

- Publish the candidate and rerun `tests/integration/agent-onboarding-published.test.mjs` plus this pilot against the new registry package.
- Run the lifecycle against the production control plane and a real Cloudflare-hosted app before claiming hosted rollout proof.
- Claude Code and Cursor login-dependent client checks remain pending by prior user direction.
