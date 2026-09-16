const text = { type: 'string', minLength: 1, maxLength: 120 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const orderInput = object({ orderId: text, sku: text, quantity: { type: 'integer', minimum: 1, maximum: 1000000 } });
const reservationSchema = object({ orderId: text, sku: text, quantity: { type: 'integer' }, status: { enum: ['reserved', 'insufficient_stock', 'unknown_sku', 'cancelled', 'released', 'idempotency_conflict', 'idempotency_key_mismatch'] } });
const sourceId = (actor) => actor.chain.sourceAppId ?? `person:${actor.person.id}`;
const rowFor = (db, source, orderId) => db.prepare('SELECT * FROM reservations WHERE source_id=? AND order_id=?').bind(source, orderId).first();
const matches = (row, input) => row.sku === input.sku && row.quantity === input.quantity;
const response = (input, status) => ({ orderId: input.orderId ?? input.order_id, sku: input.sku, quantity: input.quantity, status });

async function reserve(input, { db, actor }) {
  if (actor.idempotencyKey !== input.orderId) return response(input, 'idempotency_key_mismatch');
  const source = sourceId(actor);
  const prior = await rowFor(db, source, input.orderId);
  if (prior) return response(input, matches(prior, input) ? prior.outcome : 'idempotency_conflict');
  try {
    // D1 commits the decision, receipt, and stock decrement together. A competing
    // duplicate insert fails and rolls back its entire batch before the read below.
    await db.batch([
      db.prepare(`INSERT INTO reservations(source_id,order_id,sku,quantity,outcome,created_at)
        VALUES(?,?,?,?,CASE
          WHEN EXISTS(SELECT 1 FROM stock WHERE sku=? AND available>=?) THEN 'reserved'
          WHEN EXISTS(SELECT 1 FROM stock WHERE sku=?) THEN 'insufficient_stock'
          ELSE 'unknown_sku' END,?)`).bind(source, input.orderId, input.sku, input.quantity, input.sku, input.quantity, input.sku, Date.now()),
      db.prepare(`UPDATE stock SET available=available-? WHERE sku=? AND EXISTS(
        SELECT 1 FROM reservations WHERE source_id=? AND order_id=? AND outcome='reserved')`).bind(input.quantity, input.sku, source, input.orderId),
    ]);
  } catch (error) {
    const committed = await rowFor(db, source, input.orderId);
    if (!committed) throw error;
    return response(input, matches(committed, input) ? committed.outcome : 'idempotency_conflict');
  }
  const committed = await rowFor(db, source, input.orderId);
  return response(input, committed.outcome);
}

async function release(input, { db, actor }) {
  if (actor.idempotencyKey !== input.orderId) return response(input, 'idempotency_key_mismatch');
  const source = sourceId(actor);
  await db.batch([
    // The tombstone also handles cancellation racing ahead of the original reserve.
    db.prepare(`INSERT INTO reservations(source_id,order_id,sku,quantity,outcome,released,created_at)
      VALUES(?,?,?,?,'cancelled',1,?) ON CONFLICT(source_id,order_id) DO NOTHING`).bind(source, input.orderId, input.sku, input.quantity, Date.now()),
    db.prepare(`UPDATE stock SET available=available+? WHERE sku=? AND EXISTS(
      SELECT 1 FROM reservations WHERE source_id=? AND order_id=? AND sku=? AND quantity=? AND outcome='reserved' AND released=0)`).bind(input.quantity, input.sku, source, input.orderId, input.sku, input.quantity),
    db.prepare(`UPDATE reservations SET released=1 WHERE source_id=? AND order_id=? AND sku=? AND quantity=? AND released=0`).bind(source, input.orderId, input.sku, input.quantity),
  ]);
  const committed = await rowFor(db, source, input.orderId);
  return response(input, matches(committed, input) ? 'released' : 'idempotency_conflict');
}

export const actions = {
  'stock.list': {
    description: 'Read current available stock from Inventory.', effect: 'read', inputSchema: object({}),
    outputSchema: object({ items: { type: 'array', items: object({ sku: text, name: text, available: { type: 'integer', minimum: 0 } }) } }),
    async handler(_input, { db }) { return { items: (await db.prepare('SELECT sku,name,available FROM stock ORDER BY sku').all()).results }; },
  },
  'stock.reserve': {
    description: 'Reserve stock once for an order. Use the orderId as the idempotency key; retries preserve the original decision.',
    effect: 'write', inputSchema: orderInput, outputSchema: reservationSchema, handler: reserve,
  },
  'stock.release': {
    description: 'Release an order reservation once. Use orderId as the key. A cancellation arriving before reservation prevents a later reserve.',
    effect: 'write', inputSchema: orderInput, outputSchema: reservationSchema, handler: release,
  },
  'stock.lookup': {
    description: 'Read the current reservation for this source app and order, including whether it was released.',
    effect: 'read', inputSchema: object({ orderId: text }),
    outputSchema: object({ reservation: { anyOf: [{ type: 'null' }, object({ ...reservationSchema.properties, released: { type: 'boolean' } })] } }),
    async handler({ orderId }, { db, actor }) {
      const row = await rowFor(db, sourceId(actor), orderId);
      return { reservation: row ? { ...response(row, row.outcome), released: !!row.released } : null };
    },
  },
};
