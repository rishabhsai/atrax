const form = document.querySelector('#create');
const fields = { sku: document.querySelector('#sku'), quantity: document.querySelector('#quantity'), buyer: document.querySelector('#buyer'), channel: document.querySelector('#channel') };
const submit = document.querySelector('#submit');
const error = document.querySelector('#error');
const status = document.querySelector('#status');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const pendingKey = 'card-orders-pending-create';
const statusLabels = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Rejected', cancelling: 'Cancelling', cancelled: 'Cancelled' };
let pending = JSON.parse(localStorage.getItem(pendingKey) ?? 'null');
let catalog = new Map();

const label = (sku) => {
  const item = catalog.get(sku);
  return item ? `${item.name} — ${item.grade}` : sku;
};
const units = (quantity, sku) => `${quantity} × ${label(sku)}`;

// Readable order numbers such as CS-7F3K-9Q2M. The full number is the idempotency key.
function newOrderNumber() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => alphabet[byte % 32]).join('');
  return `CS-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// What the Orders record says happened, in one sentence.
function orderSummary(order) {
  const what = units(order.quantity, order.sku);
  if (order.status === 'confirmed') return `Reserved ${what} from Card Inventory.`;
  if (order.status === 'pending') return 'Waiting for Card Inventory. Retry to finish this order.';
  if (order.status === 'cancelling') return 'Cancellation started. Retry to return the stock.';
  if (order.status === 'cancelled') return order.outcome === 'reserved' ? `Returned ${what} to Card Inventory.` : 'Cancelled. Nothing had been reserved.';
  if (order.outcome === 'insufficient_stock') return `Not reserved: Card Inventory had fewer than ${what} available.`;
  if (order.outcome === 'unknown_sku') return `Not reserved: Card Inventory does not stock ${order.sku}.`;
  return 'Not reserved.';
}

// What Card Inventory's own reservation record says right now.
function reservationSummary(reservation) {
  if (!reservation) return 'Card Inventory has no reservation for this order yet.';
  const what = units(reservation.quantity, reservation.sku);
  if (reservation.status === 'reserved') return reservation.released ? `Card Inventory reserved ${what}, then returned it to stock when the order was cancelled.` : `Reserved ${what} from Card Inventory.`;
  if (reservation.status === 'insufficient_stock') return `Card Inventory declined: fewer than ${what} were available. Nothing was reserved.`;
  if (reservation.status === 'unknown_sku') return `Card Inventory does not stock ${reservation.sku}. Nothing was reserved.`;
  if (reservation.status === 'cancelled') return 'Cancelled before Card Inventory reserved anything.';
  return `Card Inventory reports ${reservation.status.replaceAll('_', ' ')}.`;
}

function showPending() {
  for (const field of Object.values(fields)) field.disabled = !!pending;
  if (pending) for (const [name, field] of Object.entries(fields)) field.value = pending[name];
  submit.textContent = pending ? `Retry order ${pending.orderId}` : 'Create order';
}

async function call(name, input, key) {
  const response = await fetch(`/__atrax/actions/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(input) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? 'The action did not complete. Retry with the same order.');
  if (payload.result.status && payload.result.status !== 'ok') throw new Error(payload.result.status.replaceAll('_', ' '));
  return payload.result;
}

async function loadCatalog() {
  const { items } = await call('catalog.list', {});
  catalog = new Map(items.map((item) => [item.sku, item]));
  const chosen = pending?.sku ?? fields.sku.value;
  fields.sku.replaceChildren(...items.map((item) => {
    const option = document.createElement('option');
    option.value = item.sku;
    option.textContent = `${label(item.sku)} · ${money.format(item.priceCents / 100)} · ${item.available ? `${item.available} in stock` : 'sold out'}`;
    return option;
  }));
  if (catalog.has(chosen)) fields.sku.value = chosen;
}

async function inspect(orderId) {
  const current = await call('orders.get', { orderId });
  document.querySelector('#detail').textContent = `${orderId}: ${reservationSummary(current.reservation)} Checked ${new Date().toLocaleTimeString()}.`;
  document.querySelector('#raw').textContent = JSON.stringify(current, null, 2);
  document.querySelector('#technical').hidden = false;
}

function textCell(value, className) {
  const cell = document.createElement('td'); cell.textContent = String(value);
  if (className) cell.className = className;
  return cell;
}

async function loadOrders() {
  const { orders } = await call('orders.list', {});
  const body = document.querySelector('#orders'); body.replaceChildren();
  for (const order of orders) {
    const row = document.createElement('tr');
    const badge = document.createElement('span');
    badge.className = `badge ${order.status}`; badge.textContent = statusLabels[order.status];
    const statusCell = document.createElement('td'); statusCell.append(badge);
    const buyerCell = textCell(order.buyer);
    const channel = document.createElement('div'); channel.className = 'muted'; channel.textContent = order.channel; buyerCell.append(channel);
    row.append(textCell(order.orderId, 'order-id'), textCell(label(order.sku)), textCell(order.quantity, 'number'), buyerCell, statusCell, textCell(orderSummary(order)));
    const controls = document.createElement('td');
    const replay = { orderId: order.orderId, sku: order.sku, quantity: order.quantity, buyer: order.buyer, channel: order.channel };
    for (const [text, action] of [
      ['Check reservation', () => inspect(order.orderId)],
      ...(order.status === 'pending' ? [['Retry', () => call('orders.create', replay, order.orderId)]] : []),
      ...(['pending', 'confirmed', 'cancelling'].includes(order.status) ? [[order.status === 'cancelling' ? 'Retry cancellation' : 'Cancel', () => call('orders.cancel', { orderId: order.orderId }, order.orderId)]] : []),
    ]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
      button.addEventListener('click', async () => {
        button.disabled = true; error.textContent = '';
        try { await action(); if (text !== 'Check reservation') await refresh(); }
        catch (cause) { error.textContent = cause.message; }
        finally { button.disabled = false; }
      }); controls.append(button);
    }
    row.append(controls); body.append(row);
  }
  if (!orders.length) status.textContent = 'No orders yet.';
}

async function refresh() {
  // The catalog supplies item names for the order rows, so it loads first.
  let failure;
  try { await loadCatalog(); } catch (cause) { failure = cause; }
  try { await loadOrders(); } catch (cause) { failure ??= cause; }
  if (failure) throw failure;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.textContent = ''; submit.disabled = true;
  pending ??= { orderId: newOrderNumber(), sku: fields.sku.value, quantity: Number(fields.quantity.value), buyer: fields.buyer.value.trim(), channel: fields.channel.value };
  localStorage.setItem(pendingKey, JSON.stringify(pending)); showPending();
  try {
    const { order } = await call('orders.create', pending, pending.orderId);
    status.textContent = `Order ${order.orderId} ${statusLabels[order.status].toLowerCase()}. ${orderSummary(order)}`;
    localStorage.removeItem(pendingKey); pending = null; showPending(); fields.buyer.value = '';
    await refresh();
  } catch (cause) { error.textContent = `${cause.message} Retry this order to check or finish it.`; }
  finally { submit.disabled = false; }
});
document.querySelector('#refresh').addEventListener('click', () => refresh().catch((cause) => { error.textContent = cause.message; }));
showPending();
await refresh().catch((cause) => { error.textContent = cause.message; });
