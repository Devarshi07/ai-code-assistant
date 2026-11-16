const {NotFoundError, ValidationError, ConflictError} = require('../errors');
const {parseOrderInput, parseListQuery, STATUSES} = require('../validation');
const {priceLines, orderTotals} = require('./pricing');

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/; // visible ASCII, no spaces
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Business rules for orders. The store is the only state; `now` is injectable
// so tests can control timestamps.
function createOrderService({store, now = () => new Date()}) {
  // Idempotency-Key -> {fingerprint, result (a promise), expiresAt}. The
  // promise is stored before the first await, so a second request with the
  // same key that arrives while the first is still running waits for it
  // instead of placing a second order.
  const remembered = new Map();

  // Places a validated order. Stock is taken atomically for all lines at
  // once, so concurrent orders can never take more than there is.
  async function placeOrder(input) {
    const products = new Map();
    const unknown = {};
    for (const [i, item] of input.items.entries()) {
      const product = await store.getProduct(item.sku);
      if (!product) unknown[`items[${i}].sku`] = `no product with sku ${item.sku}`;
      else products.set(item.sku, product);
    }
    if (Object.keys(unknown).length) throw new ValidationError(unknown);

    const reserved = await store.reserveStock(input.items);
    if (!reserved.ok) throw new ConflictError('out_of_stock', `Only ${reserved.available} of ${reserved.sku} left.`);

    const lines = priceLines(input.items, products);
    try {
      return await store.insertOrder({
        id: store.nextOrderId(),
        customerId: input.customerId,
        status: 'pending',
        items: lines,
        ...orderTotals(lines),
        createdAt: now().toISOString()
      });
    } catch (error) {
      await store.releaseStock(input.items); // never strand reserved stock
      throw error;
    }
  }

  // POST /orders. Returns {order, replayed}. With an idempotency key, the
  // same request sent again (a retry after a timeout, a double tap) returns
  // the first order instead of placing another one. Failed attempts are not
  // remembered, so the client can fix the request and retry with the key.
  async function createOrder(body, {idempotencyKey} = {}) {
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new ValidationError({'Idempotency-Key': 'must be 1 to 255 visible ASCII characters'});
    }
    const input = parseOrderInput(body);
    if (idempotencyKey === undefined) return {order: await placeOrder(input), replayed: false};

    const time = now().getTime();
    const fingerprint = JSON.stringify(input);
    const previous = remembered.get(idempotencyKey);
    if (previous && previous.expiresAt > time) {
      if (previous.fingerprint !== fingerprint) {
        throw new ConflictError('idempotency_key_reused', 'This Idempotency-Key was already used for a different order.');
      }
      return {order: await previous.result, replayed: true};
    }

    const entry = {fingerprint, expiresAt: time + KEY_LIFETIME_MS, result: placeOrder(input)};
    remembered.set(idempotencyKey, entry);
    try {
      return {order: await entry.result, replayed: false};
    } catch (error) {
      if (remembered.get(idempotencyKey) === entry) remembered.delete(idempotencyKey);
      throw error;
    } finally {
      for (const [key, value] of remembered) if (value.expiresAt <= time) remembered.delete(key);
    }
  }

  async function getOrder(id) {
    const order = await store.getOrder(id);
    if (!order) throw new NotFoundError('Order', id);
    return order;
  }

  // POST /orders/:id/cancel. Puts the stock back. Cancelling twice is a no-op.
  // The status change is a compare-and-set, so two concurrent cancels release
  // the stock once, and the release is a single atomic increment.
  async function cancelOrder(id) {
    const result = await store.transitionOrder(id, ['pending', 'paid'], {status: 'cancelled'});
    if (!result) throw new NotFoundError('Order', id);
    if (result.previousStatus === 'shipped') throw new ConflictError('already_shipped', `Order ${id} has already shipped.`);
    if (result.changed) await store.releaseStock(result.order.items);
    return result.order;
  }

  // GET /orders: filter, sort (ties broken by id in the same direction), then
  // cut out one page. total counts every match, not just this page.
  async function listOrders(query) {
    const {status, customerId, sort, page, pageSize} = parseListQuery(query);
    const matches = (await store.listOrders()).filter(order =>
      (status === undefined || order.status === status) &&
      (customerId === undefined || order.customerId === customerId));
    const direction = sort.descending ? -1 : 1;
    const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    matches.sort((a, b) => direction * (compare(a[sort.field], b[sort.field]) || compare(a.id, b.id)));
    const start = (page - 1) * pageSize;
    return {
      data: matches.slice(start, start + pageSize),
      page,
      pageSize,
      total: matches.length,
      totalPages: Math.ceil(matches.length / pageSize)
    };
  }

  return {createOrder, getOrder, cancelOrder, listOrders};
}

module.exports = {createOrderService, STATUSES};
