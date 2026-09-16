# __APP_NAME__

Orders stores order intent and calls the Inventory app to reserve stock. Replace `inventory-app-id` in `atrax.json` with the deployed Inventory app ID, then run `atrax deploy`. Both apps must belong to the same workspace.

`orders.create` takes `{orderId, sku, quantity}`. `orders.cancel` takes `{orderId}`. Both require `orderId` as the idempotency key. `orders.list` lists recent orders; `orders.get` retrieves an order and reads its current reservation from Inventory.

Orders commits a pending order before reserving stock. If the reply or order finalization fails, retry `orders.create` with the same input and key. Inventory returns its original decision without taking more stock. Cancellation records its intent before releasing stock and can be retried the same way. Each database has its own transaction; there is no transaction spanning both apps.

The browser preserves an unfinished creation command across reloads. Pending orders and cancellations have retry controls. Inventory checks the current employee's action permissions on every call, including a replay of completed work.

Running this app alone with `atrax dev` does not provide its Inventory dependency. Use a local workspace launcher that binds both apps, or connect and deploy both apps in a workspace.
