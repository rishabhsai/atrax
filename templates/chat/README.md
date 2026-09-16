# __APP_NAME__

Run `atrax dev` to start company chat locally. No account is required; data stays in `.atrax/state` between restarts. Run `atrax build` to validate the exact artifact used for hosting.

`atrax login`, select your workspace, then `atrax deploy` to publish a company-only app. The workspace owns it. App access and action access are managed by Atrax, outside your code.

The frontend calls named actions in `src/actions.js`. Handlers receive their own database, the current person and invocation, and scoped capabilities for declared app dependencies and company knowledge. Write actions use the invocation’s idempotency key to prevent duplicate business changes.
