# Agent instructions

This is a Tarantula v0 app.

- Read `tarantula.json` before changing infrastructure.
- Keep browser code in `public/` and server code in `src/`.
- Add ordered SQL files to `migrations/`; never edit an applied migration.
- Run `tarantula dev` for the local app and persistent local Tables state.
- Run `tarantula doctor --json` before deployment.
- Run `tarantula deploy --json` to deploy. Treat its JSON as the authoritative result.
- Run `tarantula inspect --json` to inspect the live deployment.
- Do not edit `.tarantula/wrangler.jsonc`; Tarantula generates it from `tarantula.json` and `tarantula.lock.json`.

The app is public. Anyone with the URL can read and post messages.
