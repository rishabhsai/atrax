# MCP

Use your existing agent through the official MCP stdio protocol.

## Sign in once

Use a separate named login for each agent connection. It acts as your verified person. You can revoke that session without removing another device’s session.

```
atrax login --agent "Operations agent"
atrax workspace use <workspace-id>
```

## Configure your client

Start the installed CLI as a stdio MCP server. It uses the saved credential outside the app. Do not put a token into your prompt or commit one in the project.

```
{"mcpServers":{"atrax":{"command":"atrax","args":["mcp","--workspace","<workspace-id>"]}}}
```

## Use the shared tools

Tools are generated from the platform operation registry. Dots become underscores: library.entry.create is atrax_library_entry_create. Read tools take their operation input directly. Write tools take {input, key}; reuse the key only for the same business intent.

Discover apps, inspect actions, contribute knowledge, and inspect deployment outcomes through these tools. Sign-in proofs and token-minting operations stay in the interactive login flow. This release brings your existing agent; it does not host agents.
