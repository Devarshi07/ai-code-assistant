// Starts the API on a free port, sends the requests the mobile app sends at
// checkout, prints what comes back, and stops. Run it with: node demo.js
const {createApp} = require('./src/app');

const money = cents => (typeof cents === 'number' ? `$${(cents / 100).toFixed(2)}` : String(cents));

async function main() {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {...(body ? {'content-type': 'application/json'} : {}), ...headers},
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`${method} ${path} -> ${res.status}`);
    return {status: res.status, headers: res.headers, body: json};
  };

  try {
    const placed = await call('POST', '/orders', {customerId: 'cus_dana', items: [{sku: 'coffee-beans', quantity: 2}, {sku: 'basil', quantity: 1}]}, {'Idempotency-Key': 'demo-checkout-1'});
    if (placed.body && placed.body.id) {
      const o = placed.body;
      console.log(`  ${o.id} for ${o.customerId}: ${o.items.map(l => `${l.quantity} x ${l.name}`).join(', ')}`);
      console.log(`  subtotal ${money(o.subtotalCents)}, delivery ${money(o.deliveryCents)}, total ${money(o.totalCents)}`);
      await call('GET', `/orders/${o.id}`);
    } else {
      console.log('  ', JSON.stringify(placed.body));
    }

    const missing = await call('GET', '/orders/ord_99999');
    console.log('  ', JSON.stringify(missing.body));

    const page = await call('GET', '/orders?status=pending&sort=-totalCents&pageSize=2');
    if (page.body && Array.isArray(page.body.data)) {
      console.log(`  page ${page.body.page} of ${page.body.totalPages}, ${page.body.total} pending orders`);
      for (const o of page.body.data) console.log(`  ${o.id} ${o.customerId} ${money(o.totalCents)}`);
    } else {
      console.log('  ', JSON.stringify(page.body));
    }

    const coffee = await call('GET', '/products/coffee-beans');
    if (coffee.body) console.log(`  coffee beans in stock: ${coffee.body.stock}`);
  } finally {
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
