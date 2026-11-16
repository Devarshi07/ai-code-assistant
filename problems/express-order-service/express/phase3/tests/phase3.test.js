const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

// Each store call takes a few milliseconds, like a database round trip, so
// requests sent together really do overlap.
const LATENCY_MS = 5;

async function withApi(products, fn) {
  const store = createStore({products, orders: [], latencyMs: LATENCY_MS});
  const server = createApp({store}).listen(0);
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
    return {status: res.status, headers: res.headers, body: json};
  };
  try {
    return await fn(call);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const stockOf = async (call, sku) => (await call('GET', `/products/${sku}`)).body.stock;
const count = (responses, status) => responses.filter(r => r.status === status).length;
const allOrders = async (call, query = '') => (await call('GET', `/orders?pageSize=100${query}`)).body;

test('parallel orders never sell more than is in stock', () => withApi(
  [{sku: 'cold-brew', name: 'Cold brew, 1 l', priceCents: 699, stock: 10}],
  async call => {
    const responses = await Promise.all(Array.from({length: 25}, (_, i) =>
      call('POST', '/orders', {customerId: `cus_buyer_${i}`, items: [{sku: 'cold-brew', quantity: 1}]})));
    assert.equal(count(responses, 201), 10, 'exactly the 10 in stock are sold');
    assert.equal(count(responses, 409), 15);
    assert.ok(responses.filter(r => r.status === 409).every(r => r.body.error.code === 'out_of_stock'));
    assert.equal(await stockOf(call, 'cold-brew'), 0);
    assert.equal((await allOrders(call)).total, 10);
  }));

test('parallel multi-line orders take all of their lines or none', () => withApi(
  [
    {sku: 'flour', name: 'Flour, 1 kg', priceCents: 199, stock: 7},
    {sku: 'yeast', name: 'Yeast', priceCents: 149, stock: 9},
    {sku: 'salt', name: 'Sea salt', priceCents: 249, stock: 4}
  ],
  async call => {
    const baskets = [
      [['flour', 2], ['yeast', 1]], [['yeast', 3], ['salt', 1]], [['flour', 1], ['salt', 2]],
      [['flour', 3], ['yeast', 2], ['salt', 1]], [['yeast', 2]], [['salt', 2], ['flour', 2]]
    ];
    const responses = await Promise.all(Array.from({length: 18}, (_, i) => call('POST', '/orders', {
      customerId: `cus_baker_${i}`,
      items: baskets[i % baskets.length].map(([sku, quantity]) => ({sku, quantity}))
    })));
    assert.ok(count(responses, 201) > 0, 'some orders go through');
    assert.ok(count(responses, 409) > 0, 'some run out');
    assert.equal(count(responses, 201) + count(responses, 409), 18);
    const sold = {flour: 0, yeast: 0, salt: 0};
    for (const r of responses.filter(r => r.status === 201)) for (const line of r.body.items) sold[line.sku] += line.quantity;
    for (const [sku, start] of [['flour', 7], ['yeast', 9], ['salt', 4]]) {
      assert.ok(sold[sku] <= start, `${sku}: sold ${sold[sku]} of ${start}`);
      assert.equal(await stockOf(call, sku), start - sold[sku], `${sku}: stock left matches the orders placed`);
    }
  }));

test('cancelling and ordering at the same time keeps stock consistent', () => withApi(
  [{sku: 'jam', name: 'Strawberry jam', priceCents: 425, stock: 10}],
  async call => {
    const first = [];
    for (let i = 0; i < 5; i++) first.push((await call('POST', '/orders', {customerId: 'cus_early', items: [{sku: 'jam', quantity: 2}]})).body);
    assert.equal(await stockOf(call, 'jam'), 0);
    await Promise.all([
      ...first.map(o => call('POST', `/orders/${o.id}/cancel`)),
      ...first.map(o => call('POST', `/orders/${o.id}/cancel`)), // double taps
      ...Array.from({length: 6}, (_, i) => call('POST', '/orders', {customerId: `cus_late_${i}`, items: [{sku: 'jam', quantity: 2}]}))
    ]);
    const live = (await allOrders(call)).data.filter(o => o.status !== 'cancelled');
    const held = live.reduce((sum, o) => sum + o.items[0].quantity, 0);
    assert.equal(await stockOf(call, 'jam') + held, 10, 'stock on the shelf plus stock in live orders is always 10');
    assert.ok(await stockOf(call, 'jam') >= 0);
  }));

test('a retried request with the same Idempotency-Key returns the first order', () => withApi(
  [{sku: 'honey', name: 'Raw honey', priceCents: 899, stock: 20}],
  async call => {
    const body = {customerId: 'cus_ana', items: [{sku: 'honey', quantity: 2}]};
    const first = await call('POST', '/orders', body, {'Idempotency-Key': 'checkout-7f3a'});
    assert.equal(first.status, 201);
    assert.equal(first.headers.get('idempotent-replayed'), null);
    const retry = await call('POST', '/orders', body, {'Idempotency-Key': 'checkout-7f3a'});
    assert.equal(retry.status, 201);
    assert.equal(retry.headers.get('idempotent-replayed'), 'true');
    assert.deepEqual(retry.body, first.body);
    assert.equal(retry.headers.get('location'), `/orders/${first.body.id}`);
    assert.equal(await stockOf(call, 'honey'), 18, 'stock is taken once');
    assert.equal((await allOrders(call, '&customerId=cus_ana')).total, 1);
    const other = await call('POST', '/orders', body, {'Idempotency-Key': 'checkout-8b21'});
    assert.notEqual(other.body.id, first.body.id, 'a different key is a different order');
    const noKey = await call('POST', '/orders', body);
    assert.equal(noKey.status, 201);
    assert.equal((await allOrders(call, '&customerId=cus_ana')).total, 3, 'requests without a key are never deduplicated');
  }));

test('the same key sent many times at once places one order', () => withApi(
  [{sku: 'honey', name: 'Raw honey', priceCents: 899, stock: 20}],
  async call => {
    const body = {customerId: 'cus_ben', items: [{sku: 'honey', quantity: 3}]};
    const responses = await Promise.all(Array.from({length: 8}, () => call('POST', '/orders', body, {'Idempotency-Key': 'double-tap-1'})));
    assert.deepEqual(responses.map(r => r.status), Array(8).fill(201));
    assert.equal(new Set(responses.map(r => r.body.id)).size, 1, 'every response is the same order');
    assert.equal(responses.filter(r => r.headers.get('idempotent-replayed') !== 'true').length, 1, 'exactly one response is the original');
    assert.equal(await stockOf(call, 'honey'), 17);
    assert.equal((await allOrders(call)).total, 1);
  }));

test('reusing a key for a different order is a 409', () => withApi(
  [{sku: 'honey', name: 'Raw honey', priceCents: 899, stock: 20}],
  async call => {
    await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'honey', quantity: 1}]}, {'Idempotency-Key': 'k-1'});
    const changed = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'honey', quantity: 5}]}, {'Idempotency-Key': 'k-1'});
    assert.equal(changed.status, 409);
    assert.equal(changed.body.error.code, 'idempotency_key_reused');
    assert.equal(await stockOf(call, 'honey'), 19);
  }));

test('a failed attempt does not use up its key', () => withApi(
  [{sku: 'honey', name: 'Raw honey', priceCents: 899, stock: 2}],
  async call => {
    const tooMany = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'honey', quantity: 5}]}, {'Idempotency-Key': 'retry-me'});
    assert.equal(tooMany.status, 409);
    assert.equal(tooMany.body.error.code, 'out_of_stock');
    const fixed = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'honey', quantity: 2}]}, {'Idempotency-Key': 'retry-me'});
    assert.equal(fixed.status, 201);
    assert.equal(fixed.headers.get('idempotent-replayed'), null);
  }));

test('a malformed Idempotency-Key is a 422', () => withApi(
  [{sku: 'honey', name: 'Raw honey', priceCents: 899, stock: 2}],
  async call => {
    const res = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'honey', quantity: 1}]}, {'Idempotency-Key': 'x'.repeat(300)});
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'validation_error');
    assert.ok('Idempotency-Key' in res.body.error.fields);
    assert.equal(await stockOf(call, 'honey'), 2);
  }));
