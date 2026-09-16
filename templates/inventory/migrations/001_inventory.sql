CREATE TABLE stock (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  available INTEGER NOT NULL CHECK (available >= 0)
);
CREATE TABLE reservations (
  source_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('reserved','insufficient_stock','unknown_sku','cancelled')),
  released INTEGER NOT NULL DEFAULT 0 CHECK (released IN (0,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (source_id, order_id)
);
INSERT INTO stock (sku, name, available) VALUES ('paper-a4', 'A4 paper', 10), ('pens-black', 'Black pens', 20);
