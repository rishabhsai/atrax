# Actions

Named app actions that preserve the employee’s permissions.

## Discover and call

Actions have names, descriptions, effects, and input/output schemas. An app calls declared dependencies with a short-lived request capability. The target checks current permissions; the source app does not acquire a general-purpose credential.

```
atrax call actions.list --input '{"appId":"<id>"}' --json
atrax call actions.call --key order-42 --input '{"appId":"<orders-id>","actionName":"orders.create","input":{"orderId":"order-42","sku":"<sku>","quantity":1}}' --json
```

## Use actions from an app or an agent

An action is one named operation with an input schema, an output schema, and a read or write effect. A browser interface, CLI user, agent, or another app can call it when the person has the required permissions.

Discover the published action names and inspect their schemas before constructing a request. A page being public does not make its actions public.

## Connect a declared dependency

Declare the target app ID under a local alias in atrax.json. From an action handler, call that alias with actions.call. The target receives the original caller's restrictions, not a general-purpose credential for the source app.

Both apps must belong to the same workspace. The Inventory and Orders guide demonstrates the full flow, including a retried reservation and cancellation.

```
// In an action handler with a declared inventory dependency:
const reservation = await ctx.actions.call(
	'inventory', 'stock.reserve', input, { key: input.orderId }
);
```

## Treat writes as business operations

Supply a stable key for a write and keep the original input when retrying it. The action handler owns its business retry rules. Atrax records the invocation identity but cannot deduplicate arbitrary side effects inside customer code.

Read the action result as well as the transport status. An accepted invocation can return a business outcome such as insufficient stock. A network timeout does not establish whether a write committed.

## Limits

A request capability has bounded lifetime, depth, and call count. It closes when the invocation ends. Preview environments do not receive bindings to live apps or credentials.

Shared Secrets for trusted app backends is awaiting the 0.3.0 hosted rollout. Third-party OAuth connectors and scheduled background work remain separate future capabilities.
