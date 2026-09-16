# __APP_NAME__

Inventory owns available stock and reservations. Start it with `atrax dev`; deploy it with `atrax deploy`. The sample starts with 10 packs of A4 paper and 20 black pens.

After deployment, put this app's ID in the Orders app's `atrax.json` under `dependencies.inventory.appId`. Both apps must belong to the same workspace. Deploy Orders after Inventory is ready.

`stock.list` reads current stock. `stock.reserve` and `stock.release` take `{orderId, sku, quantity}` and require `orderId` as the idempotency key. `stock.lookup` takes `{orderId}` and reads the current reservation for the calling app. Direct employee calls use a separate employee namespace and cannot release an Orders reservation.

A reservation and its stock decrement commit in one D1 batch. Insufficient stock and unknown SKUs are recorded decisions, so retrying the same order cannot turn a rejection into a new reservation. Reusing an order with changed SKU or quantity returns `idempotency_conflict`. Release restores stock once, and cancellation arriving first prevents later reservation.

Workspace members can use the published actions by default. Restrict an action through the platform to restrict both direct calls and calls through Orders.
