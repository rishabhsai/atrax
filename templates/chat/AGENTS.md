# __APP_NAME__

This is an Atrax version 2 app. Keep its interface in `public/`, named operations in `src/actions.js`, and numbered SQL migrations in `migrations/`.

Use `atrax build` and `atrax dev` before deployment. Keep existing migration files immutable. Add a new migration when the schema changes; deployment preserves the existing database.

Actions declare input/output JSON Schemas, a description, and a read/write effect. The platform enforces app and action access. Do not implement a second login system. Keep business mutations and their idempotency receipts together in the app database.

Agents and apps use the same named actions as the browser. Fetch current business records from the app that owns them. Company knowledge belongs in the workspace Library.
