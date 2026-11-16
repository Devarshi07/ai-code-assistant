const {NotFoundError, ValidationError, ConflictError} = require('../errors');
const {parseOrderInput, parseListQuery, STATUSES} = require('../validation');
const {priceLines, orderTotals} = require('./pricing');

// Business rules for orders. The store is the only state; `now` is injectable
// so tests can control timestamps.
function createOrderService({store, now = () => new Date()}) {
  // POST /orders. Fails the whole order if any line is unknown or short on
  // stock; otherwise takes the stock and saves a pending order.
  async function createOrder(body) {
    const input = parseOrderInput(body);

    const products = new Map();
    const unknown = {};
    for (const [i, item] of input.items.entries()) {
      const product = await store.getProduct(item.sku);
      if (!product) unknown[`items[${i}].sku`] = `no product with sku ${item.sku}`;
      else products.set(item.sku, product);
    }
    if (Object.keys(unknown).length) throw new ValidationError(unknown);

    for (const item of input.items) {
      const product = products.get(item.sku);
      if (product.stock < item.quantity) {
        throw new ConflictError('out_of_stock', `Only ${product.stock} of ${item.sku} left.`);
      }
    }
    for (const item of input.items) {
      await store.setStock(item.sku, products.get(item.sku).stock - item.quantity);
    }

    const lines = priceLines(input.items, products);
    return store.insertOrder({
      id: store.nextOrderId(),
      customerId: input.customerId,
      status: 'pending',
      items: lines,
      ...orderTotals(lines),
      createdAt: now().toISOString()
    });
  }

  async function getOrder(id) {
    const order = await store.getOrder(id);
    if (!order) throw new NotFoundError('Order', id);
    return order;
  }

  // POST /orders/:id/cancel. Puts the stock back. Cancelling twice is a no-op.
  async function cancelOrder(id) {
    const order = await getOrder(id);
    if (order.status === 'cancelled') return order;
    if (order.status === 'shipped') throw new ConflictError('already_shipped', `Order ${id} has already shipped.`);
    for (const line of order.items) {
      const product = await store.getProduct(line.sku);
      if (product) await store.setStock(line.sku, product.stock + line.quantity);
    }
    return store.updateOrder(id, {status: 'cancelled'});
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
