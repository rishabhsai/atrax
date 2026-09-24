CREATE TABLE stock (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
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
-- Demo data: sample stock for a small trading-card resale shop. Prices are illustrative.
INSERT INTO stock (sku, name, grade, price_cents, available) VALUES
  ('sv151-199-psa10', 'Charizard ex 199/165', 'PSA 10', 44900, 3),
  ('sv151-205-cgc95', 'Mew ex 205/165', 'CGC 9.5', 13900, 1),
  ('swsh7-215-psa9', 'Umbreon VMAX 215/203', 'PSA 9', 89900, 1),
  ('sv8-238-raw-nm', 'Pikachu ex 238/191', 'Raw, near mint', 22900, 2),
  ('sv151-bundle', 'Scarlet & Violet 151 Booster Bundle', 'Sealed', 5900, 6),
  ('sv-pre-etb', 'Prismatic Evolutions Elite Trainer Box', 'Sealed', 8900, 4),
  ('op05-box', 'One Piece OP-05 Booster Box', 'Sealed', 19900, 3),
  ('supply-toploader-100', 'Top loaders (100 ct)', 'Supplies', 799, 40),
  ('supply-sleeves-100', 'Penny sleeves (100 ct)', 'Supplies', 299, 60);
