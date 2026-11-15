// Catalogue items and customer orders.

/**
 * One sellable unit as listed in the catalogue.
 *
 * weightG is the packed weight of a single unit, in whole grams.
 * fragile items need padding, which lowers the load a carton may carry.
 * hazmat items (batteries, aerosols, solvents) ship in a carton of their own.
 */
class Item {
  constructor(sku, description, weightG, { fragile = false, hazmat = false } = {}) {
    if (!sku) throw new Error('an item needs a SKU');
    if (!Number.isInteger(weightG) || weightG < 1) {
      throw new Error(`${sku}: weight must be a whole number of grams, at least 1`);
    }
    this.sku = sku;
    this.description = description;
    this.weightG = weightG;
    this.fragile = fragile;
    this.hazmat = hazmat;
    Object.freeze(this);
  }

  get flags() {
    return [['fragile', this.fragile], ['hazmat', this.hazmat]].filter(([, on]) => on).map(([name]) => name);
  }
}

class OrderLine {
  constructor(item, quantity) {
    this.item = item;
    this.quantity = quantity;
  }

  get weightG() {
    return this.item.weightG * this.quantity;
  }
}

class Order {
  constructor(orderId, lines = []) {
    this.orderId = orderId;
    this.lines = lines;
  }

  /** One entry per physical unit to pack, in order-line order. */
  units() {
    const units = [];
    for (const line of this.lines) for (let i = 0; i < line.quantity; i++) units.push(line.item);
    return units;
  }

  get unitCount() {
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  get totalWeightG() {
    return this.lines.reduce((sum, line) => sum + line.weightG, 0);
  }

  get hasFragile() {
    return this.lines.some(line => line.item.fragile);
  }

  get hasHazmat() {
    return this.lines.some(line => line.item.hazmat);
  }
}

module.exports = { Item, OrderLine, Order };
