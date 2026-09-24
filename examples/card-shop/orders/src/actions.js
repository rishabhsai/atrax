const text = { type: 'string', minLength: 1, maxLength: 120 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const channels = ['eBay', 'Whatnot', 'TCGplayer', 'Local show'];
const orderInput = object({ orderId: text, sku: text, quantity: { type: 'integer', minimum: 1, maximum: 1000000 }, buyer: text, channel: { enum: channels } });
const orderSchema = object({ ...orderInput.properties, status: { enum: ['pending', 'confirmed', 'rejected', 'cancelling', 'cancelled'] }, outcome: { type: ['string', 'null'] }, createdAt: { type: 'integer' } });
const itemSchema = object({ sku: text, name: text, grade: text, priceCents: { type: 'integer', minimum: 0 }, available: { type: 'integer', minimum: 0 } });
const resultSchema = object({ status: { enum: ['ok', 'not_found', 'idempotency_conflict', 'idempotency_key_mismatch'] }, order: { anyOf: [orderSchema, { type: 'null' }] } });
const columns = 'order_id AS orderId,sku,quantity,buyer,channel,status,outcome,created_at AS createdAt';
const rowFor = (db, orderId) => db.prepare(`SELECT ${columns} FROM orders WHERE order_id=?`).bind(orderId).first();
const sameIntent = (order, input) => order.sku === input.sku && order.quantity === input.quantity && order.buyer === input.buyer && order.channel === input.channel;
const result = (order, status = 'ok') => ({ status, order });
const reservationInput = ({ orderId, sku, quantity }) => ({ orderId, sku, quantity });

export const actions = {
  'orders.create': {
    description: 'Create or resume one order for a buyer on a sales channel. Use orderId as the idempotency key; retry with identical input. Current employee permissions also apply to Inventory.',
    effect: 'write', inputSchema: orderInput, outputSchema: resultSchema,
    async handler(input, { db, actor, actions }) {
      if (actor.idempotencyKey !== input.orderId) return result(null, 'idempotency_key_mismatch');
      await db.prepare(`INSERT INTO orders(order_id,sku,quantity,buyer,channel,status,created_by,created_at) VALUES(?,?,?,?,?,'pending',?,?)
        ON CONFLICT(order_id) DO NOTHING`).bind(input.orderId, input.sku, input.quantity, input.buyer, input.channel, actor.person.id, Date.now()).run();
      const order = await rowFor(db, input.orderId);
      if (!sameIntent(order, input)) return result(null, 'idempotency_conflict');
      // Re-enter Inventory on every replay. Its receipt is authoritative, and its
      // gateway must check current permission even when the business work committed.
      const reservation = await actions.call('inventory', 'stock.reserve', reservationInput(input), { key: input.orderId });
      if (['idempotency_conflict', 'idempotency_key_mismatch'].includes(reservation.status)) return result(order, reservation.status);
      const status = reservation.status === 'reserved' ? 'confirmed' : reservation.status === 'cancelled' ? 'cancelled' : 'rejected';
      await db.prepare("UPDATE orders SET status=?,outcome=? WHERE order_id=? AND status='pending'").bind(status, reservation.status, input.orderId).run();
      return result(await rowFor(db, input.orderId));
    },
  },
  'orders.cancel': {
    description: 'Cancel an order and release its stock once. Use orderId as the key. Retry an interrupted cancellation with the same key.',
    effect: 'write', inputSchema: object({ orderId: text }), outputSchema: resultSchema,
    async handler({ orderId }, { db, actor, actions }) {
      if (actor.idempotencyKey !== orderId) return result(null, 'idempotency_key_mismatch');
      const order = await rowFor(db, orderId);
      if (!order) return result(null, 'not_found');
      // Record intent before the cross-app call. A racing create cannot overwrite it.
      await db.prepare("UPDATE orders SET status='cancelling' WHERE order_id=? AND status NOT IN ('cancelling','cancelled')").bind(orderId).run();
      const released = await actions.call('inventory', 'stock.release', reservationInput(order), { key: orderId });
      if (released.status !== 'released') return result(await rowFor(db, orderId), released.status);
      await db.prepare("UPDATE orders SET status='cancelled' WHERE order_id=? AND status='cancelling'").bind(orderId).run();
      return result(await rowFor(db, orderId));
    },
  },
  'orders.get': {
    description: 'Read an order with a fresh reservation lookup from Inventory. Reading an order never mutates stock.',
    effect: 'read', inputSchema: object({ orderId: text }),
    outputSchema: object({ order: { anyOf: [orderSchema, { type: 'null' }] }, reservation: { type: ['object', 'null'] } }),
    async handler({ orderId }, { db, actions }) {
      const order = await rowFor(db, orderId);
      if (!order) return { order: null, reservation: null };
      const { reservation } = await actions.call('inventory', 'stock.lookup', { orderId });
      return { order, reservation };
    },
  },
  'orders.list': {
    description: 'Read recent orders. Open one order for its current Inventory reservation.',
    effect: 'read', inputSchema: object({}), outputSchema: object({ orders: { type: 'array', items: orderSchema } }),
    async handler(_input, { db }) { return { orders: (await db.prepare(`SELECT ${columns} FROM orders ORDER BY created_at DESC,order_id LIMIT 100`).all()).results }; },
  },
  'catalog.list': {
    description: 'Read the items Card Inventory currently stocks, for choosing what to order. Reading never reserves stock.',
    effect: 'read', inputSchema: object({}), outputSchema: object({ items: { type: 'array', items: itemSchema } }),
    async handler(_input, { actions }) { return { items: (await actions.call('inventory', 'stock.list', {})).items }; },
  },
};
