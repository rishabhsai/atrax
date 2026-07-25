# App contract

Status: available

`tarantula.json` is the app-owned source of truth.

```json
{
  "version": 1,
  "name": "open-chat",
  "visibility": "public",
  "web": {
    "entry": "src/worker.js",
    "assets": "public",
    "health": "/.well-known/tarantula.json"
  },
  "tables": { "migrations": "migrations" }
}
```

`tarantula.lock.json` records stable non-secret resource identities. It is a portable identity cache, not the authoritative infrastructure state. Commit it. `.tarantula/wrangler.jsonc` is generated and should not be edited.

Declared files must stay inside the app and may not contain symlinks. `web.health` is optional and defaults to `/.well-known/tarantula.json`; it must remain on the deployed app's origin.
