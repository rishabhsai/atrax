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
