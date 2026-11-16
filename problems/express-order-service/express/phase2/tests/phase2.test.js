const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const PRODUCTS = [
  {sku: 'sourdough', name: 'Sourdough loaf', priceCents: 525, stock: 500},
  {sku: 'eggs-12', name: 'Free-range eggs, 12', priceCents: 499, stock: 500}
];
const CUSTOMERS = ['cus_ana', 'cus_ben', 'cus_chen', 'cus_dana'];
const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

// 47 orders with a fixed pseudo-random mix of customers, statuses and totals.
// Some share a createdAt or a totalCents, so tie-breaking matters.
function sampleOrders() {
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const orders = [];
  let time = Date.parse('2026-02-01T08:00:00.000Z');
  for (let i = 1; i <= 47; i++) {
    if (i % 6 !== 0) time += Math.floor(next() * 90 + 1) * 60000; // every 6th shares the previous timestamp
    const quantity = 1 + Math.floor(next() * 4);
    const sku = next() < 0.5 ? 'sourdough' : 'eggs-12';
    const unit = sku === 'sourdough' ? 525 : 499;
    const subtotal = unit * quantity;
    orders.push({
      id: `ord_${String(i).padStart(5, '0')}`,
      customerId: CUSTOMERS[Math.floor(next() * CUSTOMERS.length)],
      status: STATUSES[Math.floor(next() * STATUSES.length)],
      items: [{sku, name: sku, quantity, unitPriceCents: unit, lineTotalCents: subtotal}],
      subtotalCents: subtotal, deliveryCents: 399, totalCents: subtotal + 399,
      createdAt: new Date(time).toISOString()
    });
  }
  // Shuffle the insertion order so "the order the store returns" is not the answer.
  for (let i = orders.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [orders[i], orders[j]] = [orders[j], orders[i]];
  }
  return orders;
}
const ORDERS = sampleOrders();

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const expected = ({status, customerId, field = 'createdAt', descending = true} = {}) => ORDERS
  .filter(o => (!status || o.status === status) && (!customerId || o.customerId === customerId))
  .sort((a, b) => (descending ? -1 : 1) * (cmp(a[field], b[field]) || cmp(a.id, b.id)))
  .map(o => o.id);

async function withApi(fn) {
  const store = createStore({products: PRODUCTS, orders: ORDERS, latencyMs: 0});
  const server = createApp({store, now: () => new Date('2026-04-01T09:00:00.000Z')}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {method, headers: body ? {'content-type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {status: res.status, body: json};
  };
  try {
    return await fn(call);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const ids = res => res.body.data.map(o => o.id);

test('the default list is newest first, 20 per page, in the documented envelope', () => withApi(async call => {
  const res = await call('GET', '/orders');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ['data', 'page', 'pageSize', 'total', 'totalPages']);
  assert.equal(res.body.page, 1);
  assert.equal(res.body.pageSize, 20);
  assert.equal(res.body.total, 47);
  assert.equal(res.body.totalPages, 3);
  assert.deepEqual(ids(res), expected().slice(0, 20));
  assert.equal(res.body.data[0].customerId, ORDERS.find(o => o.id === res.body.data[0].id).customerId, 'items are full orders');
}));

test('orders with the same timestamp are ordered by id, newest id first', () => withApi(async call => {
  const res = await call('GET', '/orders?pageSize=100');
  assert.deepEqual(ids(res), expected());
}));

test('filtering by status', () => withApi(async call => {
  for (const status of STATUSES) {
    const res = await call('GET', `/orders?status=${status}&pageSize=100`);
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res), expected({status}), status);
    assert.equal(res.body.total, expected({status}).length);
  }
}));

test('filtering by customer, and by customer and status together', () => withApi(async call => {
  const byCustomer = await call('GET', '/orders?customerId=cus_ben&pageSize=100');
  assert.deepEqual(ids(byCustomer), expected({customerId: 'cus_ben'}));
  const both = await call('GET', '/orders?customerId=cus_ana&status=paid&pageSize=100');
  assert.deepEqual(ids(both), expected({customerId: 'cus_ana', status: 'paid'}));
  const nobody = await call('GET', '/orders?customerId=cus_nobody');
  assert.deepEqual(nobody.body, {data: [], page: 1, pageSize: 20, total: 0, totalPages: 0});
}));

test('sorting by total, both directions, ties by id', () => withApi(async call => {
  const up = await call('GET', '/orders?sort=totalCents&pageSize=100');
  assert.deepEqual(ids(up), expected({field: 'totalCents', descending: false}));
  const down = await call('GET', '/orders?sort=-totalCents&pageSize=100');
  assert.deepEqual(ids(down), expected({field: 'totalCents', descending: true}));
  const oldest = await call('GET', '/orders?sort=createdAt&pageSize=5');
  assert.deepEqual(ids(oldest), expected({descending: false}).slice(0, 5));
}));

test('pages cover every match exactly once', () => withApi(async call => {
  const seen = [];
  for (let page = 1; page <= 7; page++) {
    const res = await call('GET', `/orders?pageSize=7&page=${page}&sort=-totalCents`);
    assert.equal(res.body.page, page);
    assert.equal(res.body.totalPages, 7);
    seen.push(...ids(res));
  }
  assert.deepEqual(seen, expected({field: 'totalCents'}));
}));

test('a page past the end is empty but still reports the total', () => withApi(async call => {
  const res = await call('GET', '/orders?status=paid&page=50');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
  assert.equal(res.body.total, expected({status: 'paid'}).length);
}));

test('a new order shows up first in the default list', () => withApi(async call => {
  const placed = await call('POST', '/orders', {customerId: 'cus_ana', items: [{sku: 'eggs-12', quantity: 1}]});
  const res = await call('GET', '/orders?pageSize=3');
  assert.equal(res.body.data[0].id, placed.body.id);
  assert.equal(res.body.total, 48);
}));

test('bad query parameters are a 422 naming each one', () => withApi(async call => {
  const res = await call('GET', '/orders?status=lost&sort=price&page=0&pageSize=101');
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['page', 'pageSize', 'sort', 'status']);
  for (const bad of ['page=abc', 'page=1.5', 'pageSize=0', 'pageSize=-3', 'sort=-', 'status=PAID', 'page=1&page=2']) {
    const r = await call('GET', `/orders?${bad}`);
    assert.equal(r.status, 422, bad);
    assert.equal(r.body.error.code, 'validation_error', bad);
  }
}));

test('page sizes from 1 to 100 are accepted', () => withApi(async call => {
  assert.equal((await call('GET', '/orders?pageSize=1')).body.data.length, 1);
  const all = await call('GET', '/orders?pageSize=100');
  assert.equal(all.body.data.length, 47);
  assert.equal(all.body.totalPages, 1);
}));
