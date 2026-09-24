# Chat example

A small persistent app with two named actions.

## Run it

```
atrax new team-chat --template chat
cd team-chat
atrax dev
```

## Use it

messages.list reads recent messages. messages.send writes one message using the employee and command key as the retry identity. Reusing a key for a different message is rejected. Local data persists across restarts.

## Share it

Deploy, then invite a teammate into the workspace. Both people open the same company-only URL and see the same stored messages. App access and maintenance are separate permissions.
