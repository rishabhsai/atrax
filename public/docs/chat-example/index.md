# Chat example

A small persistent app with two named actions.

## Run it

```
atrax new team-chat --template chat
cd team-chat
atrax dev
```

In atrax-cloud 0.2.1, this starter's page shows __APP_NAME__ instead of your app name and wrongly describes the chat as public and login-free. A deployed app is company-only by default. For a first app, use the Inventory starter in the Quickstart until a corrected CLI is published.

## Use it

messages.list reads recent messages. messages.send writes one message using the employee and command key as the retry identity. Reusing a key for a different message is rejected. Local data persists across restarts.

## Share it

Deploy, then invite a teammate into the workspace. Both people open the same company-only URL and see the same stored messages. App access and maintenance are separate permissions.
