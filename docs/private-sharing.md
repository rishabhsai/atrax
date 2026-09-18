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

## Make one guest the only person who can open the app

Restrict the workspace audience before inviting the guest. Read the current revision, then replace the app audience with an empty selected-person list:

```sh
atrax call apps.access.get --input '{"appId":"<app-id>"}' --json

atrax call apps.access.set \
  --input '{"appId":"<app-id>","audience":"selected","personIds":[],"expectedRevision":<revision>}' \
  --key '<app-id>-guest-only-v1' --json

# Inspect the app's published actions and grant the ones the UI needs.
atrax call actions.list --input '{"appId":"<app-id>"}' --json

atrax share guest@example.com --app <app-id> \
  --actions orders.inspect,orders.export \
  --key '<app-id>-guest-invite-v1' --json
```

The empty selected audience removes live app access from every workspace member, including its maintainers. Maintainers keep authority to update the app and manage access. The invited guest can open the app only after accepting with the exact invited email. An interactive app also needs the actions used by its UI; discover them instead of assuming that opening the page is enough.

Before claiming that this recipient is the only person who can open the live app, read the complete sharing state:

```sh
atrax call apps.guests.list --input '{"appId":"<app-id>"}' --json
```

Its `audience.publicWeb` must be false, `audience.workspace.policy` must be `selected`, and `audience.workspace.people` must be empty. Revoke every accepted guest other than the intended recipient:

```sh
atrax call apps.guests.revoke \
  --input '{"appId":"<app-id>","personId":"<other-guest-person-id>"}' \
  --key '<app-id>-revoke-<other-guest-person-id>-v1' --json
```

Cancel every pending invitation for another email, because it could otherwise grant access later:

```sh
atrax call apps.guests.invitation.cancel \
  --input '{"appId":"<app-id>","invitationId":"<other-pending-invitation-id>"}' \
  --key '<app-id>-cancel-<other-pending-invitation-id>-v1' --json
```

If `audience.publicWeb` is true, read `apps.public.get` and call `apps.public.unpublish` with its observed `publicationRevision` and `confirmation: "unpublish"`. Read `apps.guests.list` again. The final observation must show public web access off, no selected workspace people, no other active guest grants, and no pending invitation for another email.

Use `--json` for the standard CLI envelope. Its `result` contains `appId`, `url`, `invitation`, `actionNames`, `audience`, `guests`, `invitations`, `observedAt`, and `workspaceAccessRemainsInEffect`. The audience is a transactionally consistent observation of the app's settings at that time; later access changes can supersede it.

If a response is interrupted, retry the exact command with the `--key` printed in the error. Reusing the key preserves the invitation intent. If invitation creation succeeded but reading the audience failed, the error includes the saved invitation instead of claiming a complete sharing result.

## Local verification

```sh
node --test tests/sharing-cli.test.mjs tests/external-sharing.test.mjs
```

These tests run the actual CLI against local control-plane Workers, D1, R2, the gateway, and built app runtime. Email goes only to the local mailbox Worker. They do not deploy to Cloudflare or send external email.
