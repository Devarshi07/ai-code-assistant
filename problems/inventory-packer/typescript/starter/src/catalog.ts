// Catalogue items and customer orders.

export interface ItemFlags {
  fragile?: boolean;
  hazmat?: boolean;
}

/**
 * One sellable unit as listed in the catalogue.
 *
 * weightG is the packed weight of a single unit, in whole grams.
 * fragile items need padding, which lowers the load a carton may carry.
 * hazmat items (batteries, aerosols, solvents) ship in a carton of their own.
 */
export class Item {
  readonly sku: string;
  readonly description: string;
  readonly weightG: number;
  readonly fragile: boolean;
  readonly hazmat: boolean;

  constructor(sku: string, description: string, weightG: number, { fragile = false, hazmat = false }: ItemFlags = {}) {
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

  get flags(): string[] {
    const flags: string[] = [];
    if (this.fragile) flags.push('fragile');
    if (this.hazmat) flags.push('hazmat');
    return flags;
  }
}

export class OrderLine {
  readonly item: Item;
  readonly quantity: number;

  constructor(item: Item, quantity: number) {
    this.item = item;
    this.quantity = quantity;
  }

  get weightG(): number {
    return this.item.weightG * this.quantity;
  }
}

export class Order {
  readonly orderId: string;
  readonly lines: OrderLine[];

  constructor(orderId: string, lines: OrderLine[] = []) {
    this.orderId = orderId;
    this.lines = lines;
  }

  /** One entry per physical unit to pack, in order-line order. */
  units(): Item[] {
    const units: Item[] = [];
    for (const line of this.lines) for (let i = 0; i < line.quantity; i++) units.push(line.item);
    return units;
  }

  get unitCount(): number {
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }

  get totalWeightG(): number {
    return this.lines.reduce((sum, line) => sum + line.weightG, 0);
  }

  get hasFragile(): boolean {
    return this.lines.some(line => line.item.fragile);
  }

  get hasHazmat(): boolean {
    return this.lines.some(line => line.item.hazmat);
  }
}
