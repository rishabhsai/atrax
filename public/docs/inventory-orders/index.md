# Inventory and Orders

Two company apps perform one business operation with explicit recovery.

## Create and deploy Inventory

Create both example apps. Deploy Inventory first, using a workspace that will also own Orders. Save the returned app ID and live URL.

Inventory starts with sample products. Read stock.list to choose a SKU and check its quantity before creating a sample order.

```
atrax new inventory --template inventory
atrax new orders --template orders
cd inventory
atrax deploy --workspace WORKSPACE_ID --json
atrax call actions.call --input '{"appId":"INVENTORY_APP_ID","actionName":"stock.list","input":{}}' --json
```

## Connect Orders to Inventory

In orders/atrax.json, replace dependencies.inventory.appId with the actual Inventory app ID. Keep the inventory alias because the Orders action code uses that name. The following fragment shows the property to edit inside the existing file.

```
"dependencies": {
	"inventory": { "appId": "INVENTORY_APP_ID" }
}
```

## Deploy Orders

From the Inventory directory, switch to Orders and deploy it to the same workspace. Each app keeps its own database. Orders calls Inventory through the declared action dependency.

```
cd ../orders
atrax deploy --workspace WORKSPACE_ID --json
```

## Create an order and inspect the reservation

Replace SKU with a value from stock.list. Use the same order ID as the write key. The Orders app saves the intent, then asks Inventory to reserve stock with the current caller's permissions.

A successful reservation produces a confirmed order. Read orders.get to inspect both the stored order and its current Inventory reservation. Unknown SKUs and insufficient stock produce rejected orders with the corresponding outcome.

```
atrax call actions.call --key order-42 --input '{"appId":"ORDERS_APP_ID","actionName":"orders.create","input":{"orderId":"order-42","sku":"SKU","quantity":1}}' --json
atrax call actions.call --input '{"appId":"ORDERS_APP_ID","actionName":"orders.get","input":{"orderId":"order-42"}}' --json
```

## Retry or cancel the same order

If the request is interrupted, inspect the order and retry orders.create with the exact same input and key. Inventory reuses an already committed reservation. A conditional transaction prevents stock from becoming negative.

Reusing an order ID with a different SKU or quantity returns idempotency_conflict. A key that does not match the order ID returns idempotency_key_mismatch. Use a new order ID for a different business intent.

Cancellation records its intent and releases stock once. Retry an interrupted cancellation with the same order ID and key. There is no transaction spanning the two databases, so inspect the final order and reservation rather than inferring success from a network response.

```
atrax call actions.call --key order-42 --input '{"appId":"ORDERS_APP_ID","actionName":"orders.cancel","input":{"orderId":"order-42"}}' --json
```

## Keep caller permissions across both apps

The caller needs access to Orders and its operation, plus access to Inventory and the target stock action. Restricting stock.reserve prevents the same person from reserving through Orders, their CLI, their agent, or a retry.

A dependency declaration does not grant access. Check the current app and action audiences if a call is denied. Removing workspace membership stops workspace-derived access for existing sessions too.
