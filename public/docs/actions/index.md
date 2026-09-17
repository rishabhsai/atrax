# Actions

Named app actions that preserve the employee’s permissions.

## Discover and call

Actions have names, descriptions, effects, and input/output schemas. An app calls declared dependencies with a short-lived request capability. The target checks current permissions; the source app does not acquire a general-purpose credential.

```
atrax call actions.list --input '{"appId":"<id>"}' --json
atrax call actions.call --key order-42 --input '{"appId":"<orders-id>","actionName":"orders.create","input":{"orderId":"order-42","sku":"<sku>","quantity":1}}' --json
```

## Limits

A request capability has bounded lifetime, depth, and call count and closes when the invocation ends. Preview environments do not receive bindings to live apps. Third-party OAuth connectors and a general company secrets vault are separate future work.
