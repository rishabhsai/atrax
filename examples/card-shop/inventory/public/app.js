const refresh = document.querySelector('#refresh');
const error = document.querySelector('#error');
const status = document.querySelector('#status');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
function cell(value, className) {
  const td = document.createElement('td'); td.textContent = String(value);
  if (className) td.className = className;
  return td;
}
async function load() {
  refresh.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch('/__atrax/actions/stock.list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? 'Could not load inventory.');
    const { items } = payload.result;
    const body = document.querySelector('#stock');
    body.replaceChildren();
    for (const item of items) {
      const row = document.createElement('tr');
      if (item.available === 0) row.className = 'sold-out';
      row.append(cell(item.name), cell(item.grade), cell(item.sku, 'sku'), cell(money.format(item.priceCents / 100), 'number'),
        cell(item.available === 0 ? 'Sold out' : item.available, 'number'));
      body.append(row);
    }
    const units = items.reduce((sum, item) => sum + item.available, 0);
    const value = items.reduce((sum, item) => sum + item.available * item.priceCents, 0);
    status.textContent = `${items.length} listings · ${units} units · ${money.format(value / 100)} at list price · Updated ${new Date().toLocaleTimeString()}`;
  } catch (cause) { error.textContent = cause.message; status.textContent = 'Stock could not be refreshed.'; }
  finally { refresh.disabled = false; }
}
refresh.addEventListener('click', load);
await load();
