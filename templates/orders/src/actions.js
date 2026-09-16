const text = { type: 'string', minLength: 1, maxLength: 120 };
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const orderInput = object({ orderId: text, sku: text, quantity: { type: 'integer', minimum: 1, maximum: 1000000 } });
const orderSchema = object({ ...orderInput.properties, status: { enum: ['pending', 'confirmed', 'rejected', 'cancelling', 'cancelled'] }, outcome: { type: ['string', 'null'] } });
const resultSchema = object({ status: { enum: ['ok', 'not_found', 'idempotency_conflict', 'idempotency_key_mismatch'] }, order: { anyOf: [orderSchema, { type: 'null' }] } });
const rowFor = (db, orderId) => db.prepare('SELECT order_id AS orderId,sku,quantity,status,outcome FROM orders WHERE order_id=?').bind(orderId).first();
const result = (order, status = 'ok') => ({ status, order });
const reservationInput = ({ orderId, sku, quantity }) => ({ orderId, sku, quantity });

export const actions = {
  'orders.create': {
    description: 'Create or resume one order. Use orderId as the idempotency key. Current employee permissions also apply to Inventory.',
    effect: 'write', inputSchema: orderInput, outputSchema: resultSchema,
    async handler(input, { db, actor, actions }) {
      if (actor.idempotencyKey !== input.orderId) return result(null, 'idempotency_key_mismatch');
      await db.prepare(`INSERT INTO orders(order_id,sku,quantity,status,created_by,created_at) VALUES(?,?,?,'pending',?,?)
        ON CONFLICT(order_id) DO NOTHING`).bind(input.orderId, input.sku, input.quantity, actor.person.id, Date.now()).run();
      const order = await rowFor(db, input.orderId);
      if (order.sku !== input.sku || order.quantity !== input.quantity) return result(null, 'idempotency_conflict');
      // Re-enter Inventory on every replay. Its receipt is authoritative, and its
      // gateway must check current permission even when the business work committed.
      const reservation = await actions.call('inventory', 'stock.reserve', input, { key: input.orderId });
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
    async handler(_input, { db }) { return { orders: (await db.prepare('SELECT order_id AS orderId,sku,quantity,status,outcome FROM orders ORDER BY created_at DESC,order_id LIMIT 100').all()).results }; },
  },
};
