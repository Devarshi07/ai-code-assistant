const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const PRODUCTS = [
  {sku: 'sourdough', name: 'Sourdough loaf', priceCents: 525, stock: 12},
  {sku: 'eggs-12', name: 'Free-range eggs, 12', priceCents: 499, stock: 30},
  {sku: 'coffee-beans', name: 'Coffee beans, 250 g', priceCents: 1150, stock: 8},
  {sku: 'basil', name: 'Basil plant', priceCents: 275, stock: 1}
];
const SHIPPED = {
  id: 'ord_00001', customerId: 'cus_ana', status: 'shipped', createdAt: '2026-03-02T08:15:00.000Z',
  items: [{sku: 'sourdough', name: 'Sourdough loaf', quantity: 1, unitPriceCents: 525, lineTotalCents: 525}],
  subtotalCents: 525, deliveryCents: 399, totalCents: 924
};
const clock = () => new Date('2026-03-05T10:00:00.000Z');

// Starts a fresh app on a free port, runs fn(call, store), then stops it.
async function withApi(fn) {
  const store = createStore({products: PRODUCTS, orders: [SHIPPED], latencyMs: 0});
  const server = createApp({store, now: clock}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : {'content-type': 'application/json'},
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {status: res.status, headers: res.headers, body: json};
  };
  try {
    return await fn(call, store);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('placing an order returns 201 Created with a Location header', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'eggs-12', quantity: 1}]});
  assert.equal(res.status, 201);
  assert.match(res.body.id, /^ord_\d{5}$/);
  assert.equal(res.headers.get('location'), `/orders/${res.body.id}`);
  assert.equal(res.body.status, 'pending');
  assert.equal(res.body.createdAt, '2026-03-05T10:00:00.000Z');
}));

test('a single item is priced correctly', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'sourdough', quantity: 1}]});
  assert.equal(res.body.subtotalCents, 525);
  assert.equal(res.body.deliveryCents, 399);
  assert.equal(res.body.totalCents, 924);
}));

test('quantities multiply the price on every line and in the totals', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'cus_ben', items: [{sku: 'coffee-beans', quantity: 2}, {sku: 'eggs-12', quantity: 3}]});
  assert.deepEqual(res.body.items.map(l => [l.sku, l.quantity, l.unitPriceCents, l.lineTotalCents]), [
    ['coffee-beans', 2, 1150, 2300],
    ['eggs-12', 3, 499, 1497]
  ]);
  assert.equal(res.body.subtotalCents, 3797);
  assert.equal(res.body.deliveryCents, 0, 'delivery is free from 3500 cents');
  assert.equal(res.body.totalCents, 3797);
}));

test('a subtotal just under the threshold still pays delivery', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'cus_ben', items: [{sku: 'coffee-beans', quantity: 3}]});
  assert.equal(res.body.subtotalCents, 3450);
  assert.equal(res.body.deliveryCents, 399);
  assert.equal(res.body.totalCents, 3849);
}));

test('the saved order matches the one returned at checkout', () => withApi(async call => {
  const placed = await call('POST', '/orders', {customerId: 'cus_chen', items: [{sku: 'sourdough', quantity: 4}]});
  const fetched = await call('GET', `/orders/${placed.body.id}`);
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body, placed.body);
  assert.equal(fetched.body.totalCents, 2499);
}));

test('an existing order can be fetched', () => withApi(async call => {
  const res = await call('GET', '/orders/ord_00001');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, SHIPPED);
}));

test('an unknown order id is a 404, not a 500', () => withApi(async call => {
  const res = await call('GET', '/orders/ord_99999');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
  assert.match(res.body.error.message, /ord_99999/);
}));

test('an unknown product sku is a 404', () => withApi(async call => {
  const res = await call('GET', '/products/dragon-fruit');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
}));

test('cancelling an unknown order is a 404', () => withApi(async call => {
  const res = await call('POST', '/orders/ord_04040/cancel');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
}));

test('an unknown route is a 404', () => withApi(async call => {
  const res = await call('GET', '/baskets');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
}));

test('invalid order bodies are 422 with every field listed', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'ana', items: [{sku: 'eggs-12', quantity: 0}, {sku: 'eggs-12', quantity: 2}]});
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['customerId', 'items[0].quantity', 'items[1].sku']);
}));

test('an unknown sku in an order is a 422 on that line', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'eggs-12', quantity: 1}, {sku: 'kale', quantity: 1}]});
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys(res.body.error.fields), ['items[1].sku']);
}));

test('malformed JSON is a 400', () => withApi(async call => {
  const res = await call('POST', '/orders', '{"customerId": "cus_ana", ');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'invalid_json');
}));

test('an order short on stock is a 409 and takes no stock at all', () => withApi(async call => {
  const res = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'eggs-12', quantity: 2}, {sku: 'basil', quantity: 2}]});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'out_of_stock');
  assert.equal((await call('GET', '/products/eggs-12')).body.stock, 30);
  assert.equal((await call('GET', '/products/basil')).body.stock, 1);
}));

test('cancelling returns the stock; a shipped order cannot be cancelled', () => withApi(async call => {
  const placed = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'coffee-beans', quantity: 5}]});
  assert.equal((await call('GET', '/products/coffee-beans')).body.stock, 3);
  const cancelled = await call('POST', `/orders/${placed.body.id}/cancel`);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, 'cancelled');
  assert.equal((await call('GET', '/products/coffee-beans')).body.stock, 8);
  const shipped = await call('POST', '/orders/ord_00001/cancel');
  assert.equal(shipped.status, 409);
  assert.equal(shipped.body.error.code, 'already_shipped');
}));
