# card-orders

Card Orders records a sale and reserves the item from Card Inventory. You choose an item, a quantity, a buyer, and a sales channel (eBay, Whatnot, TCGplayer, or Local show). Each order gets a readable order number, such as `CS-7F3K-9Q2M`. That number is also the order's idempotency key.

The backend is the 0.2.1 `orders` template with two additions. Orders now stores `buyer` and `channel`. A new read action, `catalog.list`, reads Card Inventory's `stock.list` through the declared dependency. Inventory's action contract is unchanged. If you retry `orders.create` with the same order number and input, Inventory returns its original decision and does not reserve stock again. Reusing an order number with different input returns `idempotency_conflict`.

Before deploying, replace `CARD_INVENTORY_APP_ID` in `atrax.json` with the deployed Card Inventory app ID. Both apps must belong to the same workspace.

Atrax 0.2.1 `atrax dev` runs one app and does not connect its dependencies. When you run this app alone, `catalog.list` and `orders.create` return `dependency_not_configured`.
