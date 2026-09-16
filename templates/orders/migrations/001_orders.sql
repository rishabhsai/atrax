CREATE TABLE orders (
  order_id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  status TEXT NOT NULL CHECK(status IN ('pending','confirmed','rejected','cancelling','cancelled')),
  outcome TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
