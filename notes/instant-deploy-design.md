# Instant deploy design — anonymous apps with claim-or-expire

*2026-07-27. Removes the last precondition between `tarantula new` and a live
URL: owning a Cloudflare account.*

## The slice

`tarantula deploy` with no Cloudflare auth and no lockfile prints one line —
"No Cloudflare account detected — deploying to Tarantula instant hosting." —
and posts the app to a hosted control plane instead. The reply is a real public
URL plus a claim token:

```text
Deployed open-chat
URL: https://i-3f9a2c81be.<subdomain>.workers.dev

This app is unclaimed. It disappears in 30 days unless you claim it:

  tarantula claim <token>
```

`--instant` forces the path. The authenticated flow is untouched, and a lockfile
of either kind pins the app to the provider that created it.

## Decisions and reasons

1. **Claim-or-expire, not sign-up-first.** Anonymous creation is the whole
   point; asking for an account before the URL exists reintroduces the
   friction. Unclaimed apps are deleted after 30 days, which bounds the cost of
   abandoned deploys without a billing relationship.
2. **The claim token is printed exactly once, by the deploy that minted it.**
   It is never written to disk, and redeploys never reprint it. Tokens are 32
   random bytes base64url; only their SHA-256 hex is stored.
3. **Tarantula's own Cloudflare account, one Worker + one D1 per app.** No
   multi-tenant runtime, no shared database. An instant app is the same shape
   as an authenticated one, so claiming can later mean "move this to your
   account" rather than "migrate to a different architecture".
4. **The bundle travels as JSON.** The CLI has no bundler and the control plane
   runs no user code: modules go as source, assets as base64, migrations as
   SQL. Caps are 3 MB of body, 40 assets, 20 modules.
5. **Assets are compiled into the script.** The Workers script API has no
   Static Assets support, so the control plane generates two extra modules and
   uploads them with the user's: `_tarantula_assets.mjs` (base64 blobs decoded
   lazily plus a content-type map) and `_tarantula_shim.mjs` (the main module).
   The shim hands the user's Worker an `ASSETS` binding that behaves like the
   real one — Worker first, then the asset, then `/index.html` for unknown
   non-API GETs — so template code runs unchanged in both modes.
6. **No secrets in instant mode.** There is no instant equivalent of
   `wrangler secret put`, so Door's `DOOR_SESSION_SECRET` cannot be provisioned.
   A `shared` app deployed instantly fails with a CliError that says to use a
   Cloudflare account. Instant apps are always `visibility: "public"`.
7. **Rate limiting by hashed IP.** 10 creates per day per `cf-connecting-ip`,
   salted and SHA-256 hashed, pruned after two days. The 429 names the escape
   hatch: deploy with a Cloudflare account.

## Shape

```text
control-plane/
  wrangler.jsonc          name tarantula-instant, D1 binding CP_DB, cron 0 3 * * *
  migrations/0001_apps.sql  apps, meta, rate
  src/index.js            router, handlers, scheduled sweep
  src/cf.js               the single cfApi() helper + multipart script upload
  src/shim.js             buildShim() / buildAssetsModule(), pure string builders
  src/errors.js           CpError → the CLI's error JSON shape
```

Endpoints, all JSON with `schemaVersion: 1`:

| Method | Path | Auth | Does |
| --- | --- | --- | --- |
| POST | `/v1/apps` | none | create D1, apply migrations, upload script, enable workers.dev, return url + claimToken + manageToken |
| POST | `/v1/apps/:appId/deploys` | Bearer manageToken | apply new migrations only, re-upload script |
| POST | `/v1/claims` | claimToken in body | set `claimed_at`, clear `expires_at`, idempotent |
| GET | `/v1/apps/:appId` | Bearer manageToken | status, url, expiry |

`scheduled()` deletes the Worker script and D1 database of every unclaimed
expired app, then its row, then prunes stale rate rows.

Every Cloudflare REST call goes through `cfApi(env, method, path, body)`, which
tests replace wholesale with `env.__cfApi`. The control plane holds one secret,
`CF_API_TOKEN`, set by a human; `CP_ACCOUNT_ID` is a plain var. Nothing in the
Worker mints credentials.

## CLI state

- `.tarantula/instant.json` (mode 0600, gitignored): `{ appId, manageToken, url }`.
- `tarantula.lock.json`: `{ version: 1, provider: "tarantula-instant", mode: "instant", appId, worker: { name, url } }`.

The lock's `mode` is what every other command keys on. `inspect`, `logs`,
`plan`, `drift`, and `share` all refuse instant locks with a recovery line,
because each of them reads Cloudflare through Wrangler against an account the
deployer does not have.

## Non-goals for this slice

Claiming into your own Cloudflare account, custom domains, secrets, shared
visibility, logs and inspection for instant apps, abuse review beyond the daily
IP cap, and any mention of instant hosting on the marketing site until it works
end to end against the deployed control plane.

---

# Follow-on slice — secrets, delete, reserved names

*2026-07-27. Three additions on top of the design above. Decision 6 ("no
secrets in instant mode") is now partly superseded; see the note at the end.*

## Secrets

| Method | Path | Auth | Does |
| --- | --- | --- | --- |
| PUT | `/v1/apps/:appId/secrets/:name` | Bearer manageToken | `PUT /accounts/{aid}/workers/scripts/{worker}/secrets` with `{name, text, type:"secret_text"}` |
| DELETE | `/v1/apps/:appId/secrets/:name` | Bearer manageToken | `DELETE .../secrets/{name}`; a Cloudflare 404 becomes a clean 404 |

Body for the PUT is `{ "value": "<string ≤ 1024 chars>" }`. Names match
`/^[A-Z][A-Z0-9_]{0,63}$/`. Responses are `{ schemaVersion: 1, status: "set" |
"removed", name }`. The value is forwarded to Cloudflare and nowhere else: it
is never written to `CP_DB`, never returned, and never part of an error.

On the CLI, `atrax secret set <NAME>` reads the value from **stdin**, never from
argv — process arguments are readable by every other process on the machine and
land in shell history. The whole of stdin is read to EOF and one trailing
newline is trimmed; a TTY gets a `Value: ` prompt on stderr with no echo
suppression. Both subcommands are instant-only; an account app is told to use
`npx wrangler secret put <NAME> --config .atrax/wrangler.jsonc`.

## Delete

| Method | Path | Auth | Does |
| --- | --- | --- | --- |
| DELETE | `/v1/apps/:appId` | Bearer manageToken | delete the Worker script, the D1 database, then the row |

The teardown is the same `deleteAppResources()` the daily sweep uses, so an
explicit delete and an expiry delete cannot drift apart. Unknown app or wrong
token is the usual 404. `atrax delete` is instant-only and requires `--yes`;
without it the CliError names what would be lost. After a successful delete the
CLI removes `.atrax/instant.json` and `atrax.lock.json`.

## Reserved names

`POST /v1/apps` rejects a name in `reservedNames` (www, api, docs, app, apps,
mail, admin, account, accounts, status, blog, dev, staging, help, support, cdn,
assets, atrax, instant, claim, dashboard, console, ftp, smtp, imap, ns1, ns2,
root, ssl, test), compared case-insensitively. This is preparation for
`<name>.atrax.run`: the labels Atrax needs for itself, plus the ones a mail or
DNS convention would claim, have to stay unclaimable before apps get subdomains.

## Shared visibility on instant hosting: still refused, for a different reason

Secrets remove the original blocker — `DOOR_SESSION_SECRET` could now be
generated by the CLI and set through the endpoint above. It is deliberately
**not** auto-provisioned, because member management is the real blocker:
`atrax share add` writes invites into the app's own D1 with `wrangler d1
execute --remote`, which needs the deployer's Cloudflare account. A shared
instant app would deploy, lock its own front door, and offer no way to hand out
a key — strictly worse than refusing. So instant deploy still requires
`visibility: "public"`, and its error now names member management rather than
secrets. Shared instant apps unblock when invites move to a control-plane
endpoint that writes to the app's D1 through `cfApi`.

---

# Follow-on slice — shared instant apps and the public-access line

*2026-07-27. Decision 6 above is now fully superseded, and so is the "still
refused, for a different reason" section: member management moved to the
control plane, so instant hosting serves both visibilities.*

## The one-line access warning

Every instant deploy now says who can open the URL, because that is the one
property of a deployed app a person cannot check by reading the link. A public
app prints `This app is public: anyone with the URL can open it.` — with
`Claim it to keep it and manage access: atrax claim <token>` appended on the
deploy that mints the token — and a shared app prints `Shared app: only invited
members can open it. Invite someone: atrax share add <email>`. The deploy JSON
gains `"access": "public" | "shared"`. Nothing else was added: one line, once,
at the moment the URL appears.

## Shared visibility

`POST /v1/apps` and `POST /v1/apps/:appId/deploys` accept `contract.visibility`
of `"public"` or `"shared"`. The `ATRAX_VISIBILITY` binding follows the
contract instead of being hardcoded to `public`.

For a shared app the control plane generates `DOOR_SESSION_SECRET` itself — 32
random bytes, base64url — and sets it through the same Workers-secrets call
`atrax secret set` uses, immediately after the script upload. The value is
never stored and never returned. `apps.door_secret_set` (migration
`0002_door.sql`) records only that provisioning happened, so a redeploy leaves
live sessions and open invites working, and one create means exactly one
secrets call. That column is also the "this app is shared" flag the member
endpoints check.

## Member endpoints

| Method | Path | Auth | Does |
| --- | --- | --- | --- |
| POST | `/v1/apps/:appId/members` | Bearer manageToken | upsert an invite, return `{status:"invited", email, inviteUrl, expiresAt}` |
| GET | `/v1/apps/:appId/members` | Bearer manageToken | `{status:"ok", members:[{email, state, joinedAt, inviteExpiresAt}]}` |
| DELETE | `/v1/apps/:appId/members/:email` | Bearer manageToken | `{status:"removed", email}` |

They operate on the **app's own** D1 — the `d1_id` in the app row — through the
same `cfApi` D1 query endpoint migrations use, with bound `params` rather than
escaped literals. The SQL, the `door_members` table, the SHA-256 hex invite
hash, the 14-day expiry, the upsert-unless-joined rule, and the lowercased
email validation all match `atrax share` on the Cloudflare-account path exactly,
so an app behaves the same whichever path deployed it. The raw invite token
exists only in the response. On a public app all three return 409 naming the
fix: set `"visibility": "shared"` and redeploy.

On the CLI, `atrax share add/list/remove` now branches on the lockfile: an
instant lock calls these endpoints with the manage token from
`.atrax/instant.json`, an account lock still runs `wrangler d1 execute`. The
JSON payloads and the human output are produced in one place, so the two paths
are indistinguishable to the caller. `inspect`, `logs`, `plan`, and `drift`
still refuse instant locks; `share` no longer does.

## Claim stays token-based

Claiming is still "run the `atrax claim <token>` line the deploy printed", and
it will stay token-based until the account console exists — signing in to claim
needs accounts and device auth, which is the Account Foundation slice, not this
one.
