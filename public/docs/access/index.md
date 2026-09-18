# Access

Verified company access, app sharing, and revocable agent sessions.

## Company-only by default

Every active workspace member can open a new app. A maintainer can narrow the audience to selected coworkers, assign maintainers, and control each action’s audience and explicit denials. Workspace owners and admins manage membership.

## Private guests and public pages

Workspace admins can invite a verified external email to an exact app and explicitly selected actions. A forwarded invitation is not proof of that email. Public publishing requires explicit confirmation from an admin. It publishes the web interface; app actions and Library remain protected.

## Invite a guest without changing the team audience

A workspace owner or admin can invite an external email to one app. The guest accepts after signing in with the exact invited address. A forwarded invitation alone does not grant access.

Omitting --actions grants app-page access without business action grants. Discover the actions needed by the interface before selecting them. Inviting a guest preserves the existing workspace audience and public-web setting.

```
atrax call actions.list --input '{"appId":"APP_ID"}' --json
atrax share guest@example.com --app APP_ID --actions orders.list,orders.get --key guest-invite-v1 --json
atrax call apps.guests.list --input '{"appId":"APP_ID"}' --json
```

The action names in this example belong to Orders. Use the names returned by the target app. Connected operations may also need access to the dependency app.

## Recipient-only access in the next release

The 0.3.0 source candidate allows an empty selected-person workspace audience, followed by an explicit guest grant. This recipient-only behavior is awaiting hosted rollout. The current hosted release requires at least one selected workspace person.

After rollout, the empty selected audience removes live app use from workspace members while maintainers retain management and private-candidate authority. To establish recipient-only access, also verify that public web is off, remove other accepted guests, and cancel other pending invitations.

## Revocation

App cookies refer to the central browser session. Membership, app access, action denials, and session revocation are checked for each operation and delegated app call. Removing a person does not transfer company-owned data to them.
