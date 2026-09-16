# Launch verification

Updated September 16, 2026. Work is on `feat/workspace-launch`. The twelve approved tickets are indexed in `notes/launch-tickets.md`.

## Verified locally

- Real Worker/D1/R2 execution covers identity, returning sign-in, device authorization, app login, current team/app/action permissions, guest grants, explicit public publishing, and revocation.
- CLI subprocesses cover create/build/dev, persistent data, artifact upload and deployment reconciliation, explicit app-link refresh, saved initial action audiences, Library files, and MCP stdio.
- Inventory and Orders reserve stock exactly once under concurrent retries, do not oversell, and recover a committed reservation after lost order finalization. Browser and agent requests reach the same gateway. Unpublished preview actions require a registered preview host and a current maintainer.
- Library tests cover current and historical source permissions, correction conflicts, immutable file versions, checksums, concurrent write receipts, download overwrite protection, and removed members.
- Actual browser sessions exercised workspace creation, team invitations and removal, role changes, app/action access, conflicting edits, keyboard controls, a 390px navigation drawer, manual file upload/replacement/download, entry correction/history, guest acceptance/revocation, and public publish/unpublish.
- Production Next.js static export and rendered-route checks passed. The public docs and operation reference are generated from maintained sources.

The integrated static build and all 126 tests passed after review fixes for explicit maintainer authority, independent public-web publication, concurrent Library retry receipts and immutable file timestamps, terminal candidate cleanup, and inline first-workspace device onboarding. ESLint passed and npm audit reported zero vulnerabilities. Earlier broad runs exposed those Library races; focused regressions preserve exact result and metadata equality. Recovery fault injection now persists an external outage until an explicit resume, rather than depending on a one-shot failure surviving background progress.

## Hosted evidence

An isolated Cloudflare environment was provisioned and deployed:

- API: `https://api-staging.atrax.run`
- Console: `https://console-staging.atrax.run`, a proxied custom domain for the `workspace-launch` Pages branch. Production `atrax.run` still points at its existing deployment.
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

Production migrations through `0014` have applied. The API and Pages release are pending. Production release/file buckets were created and Email Sending was enabled for `atrax.run`.

The owner confirmed that the platform had no users and authorized deleting the unused `instant-e2e` prototype. Worker `i-468132b487` and database `54e33fc8-884f-4420-a9d9-f19b20ccf6d4` were deleted successfully. Migration `0014` removes the retired prototype record store. No compatibility or adoption path is required.

A local export of the prototype restored into SQLite with integrity `ok`: one message, one rate-limit row, no Door members. Its SHA-256 is `4264d32f68653043bcdfce073c1bf32475cdb882d55e213750961d0d05e80641`. The export is in the ignored, private `.scratch/launch/legacy-archive/` directory. The owner subsequently authorized deletion; the export is only a local verification artifact.

Final work covers the admin guest-action selection follow-through, final publication, and production cutover. GitHub tickets remain open until the integrated result and its evidence are delivered.
