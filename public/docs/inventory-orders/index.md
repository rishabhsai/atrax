# Inventory and Orders

Two company apps perform one business operation with explicit recovery.

## Create both apps

Deploy Inventory first. Set orders/atrax.json dependencies.inventory.appId to the returned app ID, then deploy Orders to the same workspace. The Inventory app starts with sample products; inspect them before using the example for real work.

```
atrax new inventory --template inventory
atrax new orders --template orders
```

## Reserve without overselling

orders.create saves an order intent, then calls stock.reserve in Inventory. Inventory is the authority for stock. A conditional database transaction prevents stock from becoming negative. The order ID is the business command key in both apps.

An interrupted order remains inspectable and can be retried with the same input and key. A reservation already committed in Inventory is reused. Cancellation records intent and releases stock once; a cancellation that arrives first prevents a later reservation.

## Permissions still apply

An employee who cannot reserve stock cannot do so through Orders, a CLI call, an agent, or a retry of a previous order. Removing their workspace membership stops existing sessions. There is no database transaction spanning both apps.
