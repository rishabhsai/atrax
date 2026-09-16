# Atrax MCP

Atrax exposes the same platform operation contract to an existing MCP agent that the console and CLI use. The server runs over standard input/output; start it only after the local CLI has a saved, verified sign-in.

```sh
atrax login --agent "Operations assistant"
atrax mcp --workspace <workspace-id>
```

For an MCP client, configure the installed `atrax` command as a stdio server:

```json
{
  "mcpServers": {
    "atrax": {
      "command": "atrax",
      "args": ["mcp", "--workspace", "workspace-id"]
    }
  }
}
```

`--workspace` is optional. When present, tools reject a different `workspaceId`. Before an app-scoped operation is forwarded, Atrax resolves the app and rejects it when the app belongs to another workspace.

## Tools

Each eligible operation in the shared Atrax registry becomes an MCP tool named `atrax_` followed by the operation name with periods replaced by underscores. For example:

| Operation | MCP tool |
| --- | --- |
| `library.search` | `atrax_library_search` |
| `library.entry.create` | `atrax_library_entry_create` |
| `library.file.upload` | `atrax_library_file_upload` |
| `actions.list` | `atrax_actions_list` |
| `actions.call` | `atrax_actions_call` |

The tool input schema is the operation registry schema. Read operations accept that input directly. Every write accepts this wrapper:

```json
{
  "input": { "workspaceId": "workspace-id", "title": "Shipping policy", "text": "…" },
  "key": "knowledge-shipping-policy-v1"
}
```

`key` is a required, stable idempotency key. Reuse it only to retry the identical write. The MCP request identifier is not an Atrax business key.

Use `atrax_actions_list` with an `appId` to discover the actions currently available to the saved identity, then call one through `atrax_actions_call`. App access and action policy are checked by the control plane and gateway for every call.

## Sign-in and errors

MCP does not expose email or device proofs, browser app sign-in, or session-token creation. Run `atrax login` outside the MCP connection. If no saved sign-in is available, each tool returns a structured `login_required` error and the server writes the sign-in instruction to standard error.

Successful tools return their operation result as `structuredContent` as well as JSON text content. Failed calls return `isError: true` with structured `{ "error": { "code", "message", "details" } }`. Standard output remains reserved for MCP protocol messages.
