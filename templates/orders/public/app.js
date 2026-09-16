const form = document.querySelector('#create');
const sku = document.querySelector('#sku');
const quantity = document.querySelector('#quantity');
const submit = document.querySelector('#submit');
const error = document.querySelector('#error');
const status = document.querySelector('#status');
const pendingKey = 'atrax-orders-pending-create';
let pending = JSON.parse(localStorage.getItem(pendingKey) ?? 'null');
function showPending() {
  sku.disabled = !!pending; quantity.disabled = !!pending;
  if (pending) { sku.value = pending.sku; quantity.value = pending.quantity; }
  submit.textContent = pending ? 'Retry this order' : 'Create order';
}
async function call(name, input, key) {
  const response = await fetch(`/__atrax/actions/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(input) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? 'The action did not complete. Retry with the same order.');
  if (payload.result.status && payload.result.status !== 'ok') throw new Error(payload.result.status.replaceAll('_', ' '));
  return payload.result;
}
async function inspect(orderId) {
  const current = await call('orders.get', { orderId });
  document.querySelector('#detail').textContent = JSON.stringify(current, null, 2);
}
async function load() {
  const { orders } = await call('orders.list', {});
  const body = document.querySelector('#orders'); body.replaceChildren();
  for (const order of orders) {
    const row = document.createElement('tr');
    for (const value of [order.orderId.slice(0, 8), order.sku, order.quantity, order.status]) {
      const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
    }
    const controls = document.createElement('td');
    for (const [label, action] of [
      ['Details', () => inspect(order.orderId)],
      ...(order.status === 'pending' ? [['Retry', () => call('orders.create', { orderId: order.orderId, sku: order.sku, quantity: order.quantity }, order.orderId)]] : []),
      ...(order.status !== 'cancelled' ? [[order.status === 'cancelling' ? 'Retry cancellation' : 'Cancel', () => call('orders.cancel', { orderId: order.orderId }, order.orderId)]] : []),
    ]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', async () => {
        button.disabled = true; error.textContent = '';
        try { await action(); if (label !== 'Details') await load(); }
        catch (cause) { error.textContent = cause.message; }
        finally { button.disabled = false; }
      }); controls.append(button);
    }
    row.append(controls); body.append(row);
  }
  if (!orders.length) status.textContent = 'No orders yet.';
}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.textContent = ''; submit.disabled = true;
  pending ??= { orderId: crypto.randomUUID(), sku: sku.value, quantity: Number(quantity.value) };
  localStorage.setItem(pendingKey, JSON.stringify(pending)); showPending();
  try {
    const { order } = await call('orders.create', pending, pending.orderId);
    status.textContent = `Order ${order.orderId.slice(0, 8)}: ${order.status}${order.outcome ? ` (${order.outcome.replaceAll('_', ' ')})` : ''}.`;
    localStorage.removeItem(pendingKey); pending = null; showPending(); await load();
  } catch (cause) { error.textContent = `${cause.message} Retry this order to check or finish it.`; }
  finally { submit.disabled = false; }
});
document.querySelector('#refresh').addEventListener('click', () => load().catch((cause) => { error.textContent = cause.message; }));
showPending();
await load().catch((cause) => { error.textContent = cause.message; });
