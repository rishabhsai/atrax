const refresh = document.querySelector('#refresh');
const error = document.querySelector('#error');
const status = document.querySelector('#status');
async function load() {
  refresh.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch('/__atrax/actions/stock.list', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? 'Could not load inventory.');
    const body = document.querySelector('#stock');
    body.replaceChildren();
    for (const item of payload.result.items) {
      const row = document.createElement('tr');
      for (const value of [item.name, item.sku, item.available]) {
        const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
      }
      body.append(row);
    }
    status.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (cause) { error.textContent = cause.message; status.textContent = 'Stock could not be refreshed.'; }
  finally { refresh.disabled = false; }
}
refresh.addEventListener('click', load);
await load();
