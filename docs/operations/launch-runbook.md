# Atrax launch runbook

Use this runbook from the repository root with Node.js 22.13 or later and the dependencies installed by `npm ci`. The lockfile pins Wrangler. The source CLI is `node bin/atrax.mjs`; a new npm release is a separate publishing step.

Deployment configuration lives in [control-plane/wrangler.jsonc](../../control-plane/wrangler.jsonc) and [wrangler.jsonc](../../wrangler.jsonc). Keep [launch verification](../../notes/launch-verification.md) updated with the commit, deployed versions, migrations, checks, and unresolved failures. A successful local test does not prove a Cloudflare deployment.

## Environments

| Resource | Production | Staging |
| --- | --- | --- |
| Wrangler environment | Default configuration, omit `--env` | `--env staging` |
| Control-plane Worker | `tarantula-instant` | `atrax-staging` |
| API | `https://api.atrax.run` | `https://api-staging.atrax.run` |
| Console | `https://atrax.run` | `https://console-staging.atrax.run` |
| App hostname suffix | `atrax.run` | `staging.atrax.run` |
| Control-plane D1 | `tarantula-instant-apps` | `atrax-staging` |
| Artifact and backup R2 | `atrax-artifacts` | `atrax-staging-artifacts` |
| Library file R2 | `atrax-library` | `atrax-staging-library` |
| Pages project and branch | `tarantula`, `main` | `tarantula`, `workspace-launch` |

There is no `production` environment block. `--env production` does not select the production resources in this repository. Staging and production have separate storage but share the Cloudflare account and `atrax.run` zone, including their quotas.

The owner authorized retirement of the unused prototype. Worker `i-468132b487` and D1 `54e33fc8-884f-4420-a9d9-f19b20ccf6d4` have been deleted. Migration `0014_retire_prototype.sql` removes `legacy_apps`. See [ADR 0002](../adr/0002-prototype-cutover.md). Do not recreate the prototype or edit earlier migration checksums.

## Operator access and provider credentials

Wrangler uses the operator's Cloudflare login or a protected CI credential. Atrax's running control plane separately uses its `CF_API_TOKEN` Worker secret to provision and inspect customer app resources. `wrangler login` does not refresh that Worker secret.

Preserve the existing production `CF_API_TOKEN` during deployment. Normal Wrangler deployments preserve secrets. Do not replace it with the staging credential. Staging provider testing used a temporary operator OAuth credential, which was removed after hosted verification. Staging can serve existing apps, but new provider deployments and recovery require a maintained API token. Install one through the secure secret prompt before running those operations:

```bash
npx wrangler secret put CF_API_TOKEN --config control-plane/wrangler.jsonc --env staging
```

Enter an actual authorized token when prompted. Do not extract tokens from local OAuth files, print credentials, put secret values in commands, or commit them. The repository contains account and zone IDs, not provider credentials.

The provider needs permission to create, inspect, update, and delete Workers; control their public URL settings; attach and detach custom domains; inspect zone routes; and create, query, export, import, and delete D1 databases. Scope credentials to the configured account and `atrax.run` zone. The first production smoke test identified a missing zone route permission; the existing provider token now includes Workers Routes Write scoped to `atrax.run`.

| Capability | Cloudflare permission guidance |
| --- | --- |
| Worker scripts and settings | API endpoints accept `Workers Scripts Write`. Under current Workers roles, creating Workers requires product-level `Admin`; an existing-Worker editor alone cannot provision new apps. |
| Custom domains and route inspection | Zone `Workers Routes Write`, scoped to the affected zone, plus the Worker permissions above. |
| D1 provider operations | Account `D1 Write`. |
| Pages release by the operator or CI | Account `Cloudflare Pages` → `Edit`. This is separate from the runtime provider secret. |

Check the current [Workers authorization rules](https://developers.cloudflare.com/workers/authorization/workers/), [Worker upload API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/), [D1 create API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/create/), and [Pages CI guidance](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) when configuring a new credential. Binding R2 to a Worker uses Worker authorization; the running app accesses storage through its binding. Operators who administer buckets through the R2 API need the appropriate [R2 permissions](https://developers.cloudflare.com/r2/api/tokens/).

## Storage, email, and routing prerequisites

- Confirm the configured D1 databases and R2 buckets exist in the expected account. Keep the explicit database IDs and bucket names in configuration. Deployment must fail if a required resource is missing; do not substitute a newly provisioned empty database.
- Keep `ARTIFACTS`, `LIBRARY_FILES`, `CP_DB`, and the SQLite-backed `DEPLOYMENTS` Durable Object bindings in both environments. Worker deployment applies the Durable Object migration; D1 migrations are a separate command below.
- Enable Email Sending for `atrax.run`. The `EMAIL` binding permits `sign-in@atrax.run`, matching `EMAIL_FROM`. Confirm the domain's sending status and required MX, SPF, DKIM, and DMARC records in Cloudflare Email Service. Atrax sends through the native binding, so it does not need a separate SMTP password. [Email Sending setup](https://developers.cloudflare.com/email-service/get-started/send-emails/)
- Keep each API custom domain and console origin aligned with its environment. The staging console custom domain routes to the `workspace-launch` Pages branch. Verify that association after a Pages release; the generated `pages.dev` URL alone does not prove the configured console origin works.

Hosted verification already delivered a sign-in email with SPF, DKIM, and DMARC passing. Repeat sign-in with an operator-owned inbox when verifying a new release.

## Verify the checkout

```bash
npm ci
npm run lint
node --test tests/*.test.mjs
npm run build:control-plane
```

Build the Pages export for the intended environment as shown below. Record failing checks before deployment. Do not infer email delivery, provider permission, custom-domain routing, or native cleanup success from the local provider fixture.

## Deploy staging

List and apply pending migrations, then deploy the control plane. Resource auto-provisioning is disabled explicitly.

```bash
npx wrangler d1 migrations list CP_DB --remote --config control-plane/wrangler.jsonc --env staging
npx wrangler d1 migrations apply CP_DB --remote --config control-plane/wrangler.jsonc --env staging
npx wrangler deploy --config control-plane/wrangler.jsonc --env staging --experimental-provision=false --experimental-auto-create=false
```

Build and upload the staging Pages export:

```bash
NEXT_PUBLIC_CONTROL_PLANE_URL=https://api-staging.atrax.run npm run build
npx wrangler pages deploy out --project-name tarantula --branch workspace-launch
```

`NEXT_PUBLIC_CONTROL_PLANE_URL` is embedded at build time. Rebuild when switching environments; uploading the same `out` directory to another branch does not change its API origin.

## Deploy production

### Secrets rollout

Apply migration `0016_workspace_secrets.sql` before deploying a control plane that records invocation environments. Provision a separate `SECRETS_ENCRYPTION_KEY` for each environment using a protected random 32-byte key encoded as base64. Store an operator recovery copy before uploading it through `wrangler secret put`; keep the value out of commands, logs, and source control.

```bash
npx wrangler secret put SECRETS_ENCRYPTION_KEY --config control-plane/wrangler.jsonc --env staging
npx wrangler secret put SECRETS_ENCRYPTION_KEY --config control-plane/wrangler.jsonc --env ''
```

Run only the command for the intended environment. Existing values depend on that key. Do not replace it without a separately verified re-encryption procedure; master-key rollover is not implemented. Customer credential rotation is a different operation and needs no app deployment.

The new gateway connects to the `Secrets` control-plane entrypoint only for live deployments. Existing apps acquire the runtime method and gateway binding when rebuilt and normally deployed with the matching CLI. Retain `atrax.lock.json` so the update preserves app identity/data. Prove a disposable credential can be granted, used by a live action, rotated, and revoked, and that previews remain denied. Never use a real third-party credential for this smoke test.

Build and publish the matching CLI and skill before publishing onboarding files that require the new commands. Run `npm run test:published` after the registry serves that exact version. This post-publication suite keeps the real registry installation and bundled-skill comparison; `npm test` verifies the source candidate before publication. The source-only verification notes are not a hosted release record.

Use the default Worker configuration. Review the pending migration list, including the authorized prototype retirement. Keep the existing production provider secret.

```bash
npx wrangler d1 migrations list CP_DB --remote --config control-plane/wrangler.jsonc
npx wrangler d1 migrations apply CP_DB --remote --config control-plane/wrangler.jsonc
npx wrangler deploy --config control-plane/wrangler.jsonc --experimental-provision=false --experimental-auto-create=false
```

Build a fresh production Pages export and deploy to the production branch:

```bash
NEXT_PUBLIC_CONTROL_PLANE_URL=https://api.atrax.run npm run build
npx wrangler pages deploy out --project-name tarantula --branch main
```

Wrangler applies each pending D1 migration in order. A failed migration rolls back that migration; earlier successful migrations remain applied. Inspect the reported state before retrying. [D1 migration commands](https://developers.cloudflare.com/d1/wrangler-commands/)

## Verify the hosted release

Check `/health` on the selected API. It should return the Atrax service response, but this endpoint does not exercise credentials or storage. For provider failures, `wrangler tail --search atrax.provider.request_failed` shows method, path, status, and numeric error codes without provider prose, request bodies, query strings, or credentials.

Use a separate CLI credential directory for staging:

```bash
export ATRAX_API_ORIGIN=https://api-staging.atrax.run
export ATRAX_CONFIG_DIR="$HOME/.config/atrax-staging"
node bin/atrax.mjs login
node bin/atrax.mjs workspace list --json
```

For production, use `https://api.atrax.run` and the default `$HOME/.config/atrax` directory. Complete email sign-in and browser device approval with the intended identity. Never reuse another person's session for verification.

Verify these behaviors through the actual browser and CLI:

1. Open the console, sign in, and directly load workspace, team, Library, and app routes. Reload a deep link and check the narrow layout.
2. Deploy a disposable test app using the source CLI. Keep its `atrax.lock.json` and `.atrax/deploy.json`. Confirm the deployment reaches `succeeded`, its normal URL works for an authorized person, and a private app rejects anonymous access.
3. Exercise Inventory and Orders with a stable business command key. Retry identical input and confirm stock changes once. An update must retain the app URL and live data. A denied downstream action must remain denied through Orders.
4. Remove a test member and verify that their existing session loses access. Test public web publishing separately from action permissions.
5. Create a sample preview. Confirm that its database is isolated and that it cannot use live app dependencies. Close it through `previews.delete` and verify cleanup.
6. Capture a backup of synthetic data, write a later row, and inspect a restore plan. Restore only after reviewing its explicit confirmation. Confirm the restored app uses a new database and the original still contains the later row.
7. Upload and download a Library file, compare bytes, and exercise an MCP read and permitted write under the same identity.

Record Worker versions, release/deployment IDs, URLs, backup/fork IDs, and observed results in the verification notes. Do not record bearer tokens, email login codes, or signed snapshot URLs.

## Inspect and recover deployments

Use operation schemas from `/operations.json`. Replace the example IDs with the recorded values. These examples use the CLI's current API origin and login:

```bash
node bin/atrax.mjs call deployments.get --input '{"appId":"<app-id>","deploymentId":"<deployment-id>"}' --json
node bin/atrax.mjs call deployments.resume --input '{"appId":"<app-id>","deploymentId":"<deployment-id>"}' --json
node bin/atrax.mjs call deployments.cancel.plan --input '{"appId":"<app-id>","deploymentId":"<deployment-id>"}' --json
```

An interrupted CLI deploy resumes its saved intent. Preserve its files and reuse its job; do not create a new app to escape a timeout. Verification uses the current maintainer's real credentials. At `awaiting_verification`, the CLI performs the check; direct callers use `deployments.verify`.

For an unpublished failed job, inspect `deployments.cancel.plan`. If `canCancel` is true, submit `deployments.cancel` with that exact `planHash`. Cancellation preserves applied schema and business data, then permits a corrected deployment. Once publication was durably admitted, cancellation is unsafe even if the old gateway is still visible. Resume and reconcile that job first. Do not alter coordinator state or migration ledgers manually.

Code rollback retains business data and additive schema. Database restore is a separate data fork: it imports an immutable backup into a new database and retains the original. Connected apps keep their own databases and later records. The confirmation must match the current head, original database, snapshot time, and connected-app impact. Atrax does not promise a cross-database transaction or arbitrary point-in-time restore.

## Candidate cleanup and preview closure

Successful live deployments and completed cancellations enqueue durable cleanup. Cleanup revokes the candidate host, detaches its domain, deletes its gateway and private runtime, then deletes only a proven disposable database. It checks current live references and retained database records. Business databases, successful restore databases, originals, and uncertain restore attempts are retained.

Cleanup retries independently of deployment success and does not hold the app's deployment ownership. Inspect `deployment.cleanup` through `deployments.get`:

| Status | Operator meaning |
| --- | --- |
| `pending` | Inspect `phase`, `error`, `attempts`, and `nextAttemptAt`. Fix provider credentials, quota, or conflicting references; durable retries continue with backoff. |
| `complete` | The disposable candidate resources have been reclaimed. Retained business and rollback resources are outside this cleanup. |
| `retained` | Inspect `retained.reason` and resource identities. An unresolved creation/upload could arrive late, or the job lacks durable evidence needed for safe deletion. |

A delayed upload can recreate a deleted Worker with public defaults. Elapsed time alone is not evidence that such a request has finished. Do not force-delete resources marked `retained` or infer safety from a currently absent resource. Jobs created before cleanup tracking may lack the required evidence.

Completed previews stay active until explicitly closed:

```bash
node bin/atrax.mjs call previews.list --input '{"appId":"<app-id>"}' --json
node bin/atrax.mjs call previews.delete --input '{"appId":"<app-id>","deploymentId":"<preview-id>","confirmation":"delete-preview"}' --json
node bin/atrax.mjs call deployments.get --input '{"appId":"<app-id>","deploymentId":"<preview-id>"}' --json
```

Closure requires a current maintainer, records `closedAt`, and revokes host access before provider cleanup. It is safe to repeat. Cancel an unfinished preview through the cancellation plan first. An explicitly authorized backup copy belongs to the preview; deleting that copy retains the source database and backup.

## Capacity and retention

Cloudflare's documented defaults are **100 custom domains per zone** and **500 Workers per paid account**. Count both environments, control-plane hosts, live apps, active previews, pending candidates, and retained uncertain resources. Normal candidate cleanup prevents every completed deployment from permanently consuming another hostname. Historical live runtimes still accumulate. Request a limit increase or change the capacity model before exhausting these limits. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

D1's paid defaults are 50,000 databases and 1 TB total storage per account. Retained originals and database forks consume storage. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

Atrax currently retains historical live runtimes, release artifacts, immutable backups, business database forks, and unresolved provider resources. There is no automatic age-based deletion policy for them. Preview and backup lists return the latest 100 entries, so retain operation IDs in the release record. Budget for this retention and inspect pending/retained cleanup before admitting more apps. Any future business-data retention policy needs explicit ownership and recovery requirements; temporary candidate cleanup is not that policy.
