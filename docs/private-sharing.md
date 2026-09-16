# Share a deployed app with a guest

Sign in with `atrax login`. A workspace owner or admin can invite an external email address to one deployed app:

```sh
# Inside a deployed checkout, use its atrax.lock.json app link.
atrax share guest@example.com

# From any directory, select the app explicitly.
atrax share guest@example.com --app <app-id> --json

# Grant only the named, currently published actions.
atrax share guest@example.com --app <app-id> --actions orders.inspect,orders.export
```

Omitting `--actions` grants no business actions. After accepting, the guest can open the app. Unknown and retired actions fail before a successful invitation is reported.

The recipient opens the invitation email, signs in with that exact email address through the existing browser sign-in flow, and accepts the invitation. This grants app access without adding workspace membership. A different signed-in email cannot accept it.

## Read the result

The result contains the stable app URL, invitation ID and current status, action grants, and an audience observation with a timestamp. It lists active workspace people who can open the app, current guests, and invitation states. Expired invitations are reported as expired.

Workspace access remains in effect. Workspace-wide apps still allow every active member; selected apps still allow their selected active members. Public apps remain public and the output says anyone can open their static web pages. Sharing never changes public publishing or the workspace policy. Actions still require authorization.

Use `--json` for the standard CLI envelope. Its `result` contains `appId`, `url`, `invitation`, `actionNames`, `audience`, `guests`, `invitations`, `observedAt`, and `workspaceAccessRemainsInEffect`. The audience is a transactionally consistent observation of the app's settings at that time; later access changes can supersede it.

If a response is interrupted, retry the exact command with the `--key` printed in the error. Reusing the key preserves the invitation intent. If invitation creation succeeded but reading the audience failed, the error includes the saved invitation instead of claiming a complete sharing result.

## Local verification

```sh
node --test tests/sharing-cli.test.mjs tests/external-sharing.test.mjs
```

These tests run the actual CLI against local control-plane Workers, D1, R2, the gateway, and built app runtime. Email goes only to the local mailbox Worker. They do not deploy to Cloudflare or send external email.
