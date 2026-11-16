// An in-memory stand-in for the database. Like a real database client, every
// call is asynchronous and takes a little time (latencyMs per round trip), and
// records come back as copies: changing a returned object changes nothing in
// the store until you write it back.

const clone = value => structuredClone(value);

class MemoryStore {
  constructor({products = [], orders = [], latencyMs = 1} = {}) {
    this.products = new Map(products.map(product => [product.sku, clone(product)]));
    this.orders = new Map(orders.map(order => [order.id, clone(order)]));
    this.latencyMs = latencyMs;
    this.sequence = orders.reduce((max, order) => Math.max(max, Number(order.id.slice(4)) || 0), 0);
  }

  roundTrip() {
    return new Promise(resolve => setTimeout(resolve, this.latencyMs));
  }

  // Products

  async getProduct(sku) {
    await this.roundTrip();
    const product = this.products.get(sku);
    return product ? clone(product) : null;
  }

  async listProducts() {
    await this.roundTrip();
    return [...this.products.values()].map(clone);
  }

  async setStock(sku, stock) {
    await this.roundTrip();
    const product = this.products.get(sku);
    if (!product) throw new Error(`Unknown product ${sku}`);
    product.stock = stock;
  }

  // Orders

  nextOrderId() {
    this.sequence += 1;
    return `ord_${String(this.sequence).padStart(5, '0')}`;
  }

  async insertOrder(order) {
    await this.roundTrip();
    if (this.orders.has(order.id)) throw new Error(`Duplicate order id ${order.id}`);
    this.orders.set(order.id, clone(order));
    return clone(order);
  }

  async getOrder(id) {
    await this.roundTrip();
    const order = this.orders.get(id);
    return order ? clone(order) : null;
  }

  async updateOrder(id, changes) {
    await this.roundTrip();
    const order = this.orders.get(id);
    if (!order) return null;
    Object.assign(order, clone(changes));
    return clone(order);
  }

  // Every order, in insertion order. Fine for this service's size.
  async listOrders() {
    await this.roundTrip();
    return [...this.orders.values()].map(clone);
  }
}

const createStore = options => new MemoryStore(options);

module.exports = {MemoryStore, createStore};
