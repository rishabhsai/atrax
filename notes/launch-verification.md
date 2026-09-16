# Launch verification

This records the first workspace launch. For the subsequent npm release, guest lifecycle migration, and current backend versions, see [CLI release verification](cli-release-verification.md).

Updated September 16, 2026. The workspace launch is deployed at https://atrax.run and published on `feat/workspace-launch`. Implementation commit: `1f687e4`; follow-up includes provider diagnostics and the final verification record. The twelve approved tickets are indexed in `notes/launch-tickets.md`.

## Verified locally

- Real Worker/D1/R2 execution covers identity, returning sign-in, device authorization, app login, current team/app/action permissions, guest grants, explicit public publishing, and revocation.
- CLI subprocesses cover create/build/dev, persistent data, artifact upload and deployment reconciliation, explicit app-link refresh, saved initial action audiences, Library files, and MCP stdio.
- Inventory and Orders reserve stock exactly once under concurrent retries, do not oversell, and recover a committed reservation after lost order finalization. Browser and agent requests reach the same gateway. Unpublished preview actions require a registered preview host and a current maintainer.
- Library tests cover current and historical source permissions, correction conflicts, immutable file versions, checksums, concurrent write receipts, download overwrite protection, and removed members.
- Actual browser sessions exercised workspace creation, team invitations and removal, role changes, app/action access, conflicting edits, keyboard controls, a 390px navigation drawer, manual file upload/replacement/download, entry correction/history, guest acceptance/revocation, and public publish/unpublish.
- Production Next.js static export and rendered-route checks passed. The public docs and operation reference are generated from maintained sources.

The integrated static build passed. The final suite passed all **128 tests**, with no failures, cancellations, or skips, after review fixes for explicit maintainer authority, independent public-web publication, concurrent Library retry receipts and immutable file timestamps, terminal candidate cleanup, and inline first-workspace device onboarding. ESLint passed and npm audit reported zero vulnerabilities. Earlier broad runs exposed those Library races; focused regressions preserve exact result and metadata equality. Recovery fault injection now persists an external outage until an explicit resume, rather than depending on a one-shot failure surviving background progress.

## Hosted evidence

An isolated Cloudflare environment was provisioned and deployed:

- API: `https://api-staging.atrax.run`
- Console: `https://console-staging.atrax.run`, a proxied custom domain for the `workspace-launch` Pages branch. The staging console is isolated from production.
- Separate staging control-plane D1, artifact R2, and Library R2 resources.
- Hosted email reached the user-authorized Gmail inbox. Gmail reported SPF, DKIM, and DMARC passing. The proof successfully established a browser identity and approved an agent/CLI device session.
- That verified identity created the `Launch verification` workspace through the shared API.
- Inventory and Orders deployed through the real CLI, provider, custom domains, D1, private service bindings, and trusted gateway. Anonymous app requests return 401; authenticated actions work.
- Repeating order `launch-order-1` reserved stock once: Inventory went from 10 to 8. Updating Inventory retained its URL and that 8-unit balance. A browser-created order then reduced it to 7.
- Both the isolated test browser and the user's regular browser completed actual email sign-in, workspace Home, and private app opening. The test browser required retry on two cross-origin redirects; the regular browser completed Orders and preview redirects without retry. This is recorded separately from the normal successful flow.
- Preview `2f24bf40-f6ac-bbdd-05e6-a9aeccc1c582` opens for the maintainer and shows the isolated 10-unit sample balance.
- Backup `backup-6e7bb6b8fccb950573abad502a1bc85a` exported and stored successfully. Restore `23905025-6c33-edb3-4f0e-2183c921975a` created database `e08fd700-4c68-4d5e-82db-fc31dcc6379b` with the snapshot's 8 units. The original `9ce65cc9-d20b-4844-b266-2423d1cf3fa3` remains and still contains 7, verified by a read-only query. Orders retains its later records, as disclosed in the restore plan.
- Official MCP stdio created, searched, and corrected synthetic Library entry `3ec2e43a-877b-44e9-9df9-c34c335df4b7`; its two revisions remain inspectable. CLI upload/download of file `0b6ad48e-908a-4426-8d0d-fa9b229448d4` passed byte and SHA-256 equality.
- Deployment `30cf4ad9-3bbf-ef46-3e11-273d3c4f31dd` updated the live Inventory app and completed candidate cleanup on Cloudflare. Fresh preview `8ff8b0d1-fd00-e885-8120-d411d1e79f86` was verified, closed through `previews.delete`, and reached `cleanup.status=complete`. Its disposable database `a8ec3c13-f60d-45e6-9127-ea7c39059294` was removed; live database `e08fd700-4c68-4d5e-82db-fc31dcc6379b` remains.
- Initial hosting attempts exposed an expired temporary credential and extra native D1 binding metadata. Both were diagnosed; provider metadata now normalizes by resource identity with regression coverage.

The temporary staging provider credential was removed after hosted cleanup verification. Existing staged apps continue serving; new staged provider deployments and recovery need a maintained credential. Production retains its separate existing provider secret.

## Release status

Production migrations through `0014` have applied, with no pending migrations. The API is live at https://api.atrax.run and the console/site at https://atrax.run. Pages deployment: `cc69655b.tarantula-9l0.pages.dev`. Final API version: `3f4cd51d-4a92-4af1-b395-b658855ea86a`. Production uses its own control-plane D1, artifact R2, Library R2, and persistent provider token.

### Production smoke evidence

- The first `atrax deploy --json` requested browser authorization. The real email arrived at the user-authorized inbox; confirmation returned to that request. The browser created workspace **Atrax** (`849929ad-0451-442a-8973-e300000bcac6`) inline, approved the CLI, and the same deployment command continued with the sole workspace.
- The existing account token initially lacked zone Worker Routes permission. Sanitized operator diagnostics identified `GET /zones/.../workers/routes`, HTTP 403, code 10000. The existing token was updated with **Workers Routes Write scoped only to `atrax.run`**. Its value was neither retrieved nor replaced. The saved deployment resumed successfully.
- Inventory: `14b5e0e9-767e-4c02-bbf1-3b1a6f514abf`, https://launch-inventory-14b5e0e9.atrax.run. First deployment `50c51007-d6e2-a87b-356e-0527d0fda91f` completed and reclaimed its candidate resources.
- Orders: `93808eda-34e8-49f0-a1fe-118bebda036b`, https://launch-orders-93808eda.atrax.run. Deployment `8746014b-9f18-ed21-3754-fe0907dcd744` completed with its declared Inventory dependency.
- Repeating `production-launch-order-1` returned the same confirmed two-unit order; available paper stock changed from 10 to 8 once. The actual browser displayed that single confirmed order.
- Inventory update `6248adb4-98a0-5f01-644c-9600c08e415c` retained the URL, database `16bf6b15-74cb-4f63-8d49-c26c72eedd7b`, and 8-unit balance. Cleanup reached `complete`.
- The signed-in browser opened both company-only apps through normal app sign-in. An unauthenticated Inventory request returned HTTP401.
- Library file `e71e469a-4619-40c7-86ca-4f3a31b32f8e` uploaded and downloaded 132 identical bytes; SHA-256 `719357c8136d8bf8bd8e73109a6dad917eab896aeb4d62c683a0a32a056dd9ad`. Its text explicitly identifies it as a verification artifact, not company policy.
- The official MCP client connected to the production CLI server, found that Library file, and read Inventory's 8-unit balance after the update.
- The production docs include first-deploy workspace onboarding and source installation. The narrow docs layout has no page overflow at 390px, an expandable directory, and locally scrolling code blocks; desktop retains its full directory.

The owner confirmed that the platform had no users and authorized deleting the unused `instant-e2e` prototype. Worker `i-468132b487` and database `54e33fc8-884f-4420-a9d9-f19b20ccf6d4` were deleted successfully. Migration `0014` removes the retired prototype record store. No compatibility or adoption path is required.

A local export of the prototype restored into SQLite with integrity `ok`: one message, one rate-limit row, no Door members. Its SHA-256 is `4264d32f68653043bcdfce073c1bf32475cdb882d55e213750961d0d05e80641`. The export is in the ignored, private `.scratch/launch/legacy-archive/` directory. The owner subsequently authorized deletion; the export is only a local verification artifact.

## Final regression notes and limits

A final fault-injection sweep exposed a test-transport race: the provider fixture returned a rejected multipart upload without consuming its body, leaving Miniflare waiting before reconciliation. The fixture now drains rejected bodies; the exact scenario passed 15 consecutive repeats and the full recovery suite. Assertions and timeouts were preserved. Native successful empty DELETE 200 responses are handled explicitly; malformed nonempty responses still fail. Safe provider diagnostics include only method, pathname, status, and numeric codes.

Final integrated run: **128/128 passed** (63 seconds). Production build, rendered-route checks, scoped/full ESLint, and package assembly passed; npm audit reported zero vulnerabilities. The npm package release remains forthcoming; the published source installation is the supported launch path. Staging needs a maintained provider credential before further provisioning. Historical live runtimes, business-data forks, and backups are retained as documented in the operator runbook. Hosted agents, scheduling, automatic document synchronization, source hosting, and third-party connectors remain deferred.
