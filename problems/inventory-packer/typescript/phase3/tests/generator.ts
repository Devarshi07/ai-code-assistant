// Deterministic wholesale orders for the scale tests.
import { Item } from '../src/catalog.ts';

/** Park-Miller "minimal standard" generator. The other language versions use the same one. */
export class Lcg {
  state: number;

  constructor(seed: number) {
    this.state = seed % 2147483647 || 1;
  }

  below(n: number): number {
    this.state = (this.state * 48271) % 2147483647;
    return this.state % n;
  }
}

export interface WholesaleOptions {
  catalogueSize?: number;
  maxG?: number;
  fragileMaxG?: number;
}

/** count units of a restock order: random catalogue lines, each ordered in bulk. */
export function wholesaleUnits(seed: number, count: number, { catalogueSize = 400, maxG = 4900, fragileMaxG = 3400 }: WholesaleOptions = {}): Item[] {
  const rng = new Lcg(seed);
  const catalogue: Item[] = [];
  for (let n = 0; n < catalogueSize; n++) {
    const roll = rng.below(100);
    const hazmat = roll < 2;
    const fragile = roll >= 2 && roll < 20;
    const top = fragile ? fragileMaxG : maxG;
    const sku = `W${String(n).padStart(4, '0')}`;
    catalogue.push(new Item(sku, `wholesale line ${n}`, 60 + rng.below(top - 59), { fragile, hazmat }));
  }
  const units: Item[] = [];
  while (units.length < count) {
    const item = catalogue[rng.below(catalogueSize)];
    const quantity = Math.min(1 + rng.below(40), count - units.length);
    for (let i = 0; i < quantity; i++) units.push(item);
  }
  return units;
}
