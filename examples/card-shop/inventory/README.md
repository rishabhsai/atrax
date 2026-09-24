# card-inventory

Card Inventory tracks what a small trading-card resale shop has on hand: graded singles, sealed product, and supplies. The migration seeds nine demo items with a grade or condition, a list price, and a quantity. The seed data is sample data, and the prices are illustrative.

This app is the 0.2.1 `inventory` template with two added stock columns, `grade` and `price_cents`. `stock.list` also returns those columns. `stock.reserve`, `stock.release`, and `stock.lookup` are unchanged from the template: each takes `orderId` as its idempotency key, and a retry returns the original decision without taking more stock.

Run it with `atrax dev`. Deploy it with `atrax deploy` before Card Orders, then put the returned app ID in `../orders/atrax.json` under `dependencies.inventory.appId`.
