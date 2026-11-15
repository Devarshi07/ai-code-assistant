// Deterministic wholesale orders for the scale tests.
const { Item } = require('../src/catalog');

/** Park-Miller "minimal standard" generator. The Python tests use the same one. */
class Lcg {
  constructor(seed) {
    this.state = seed % 2147483647 || 1;
  }

  below(n) {
    this.state = (this.state * 48271) % 2147483647;
    return this.state % n;
  }
}

/** count units of a restock order: random catalogue lines, each ordered in bulk. */
function wholesaleUnits(seed, count, { catalogueSize = 400, maxG = 4900, fragileMaxG = 3400 } = {}) {
  const rng = new Lcg(seed);
  const catalogue = [];
  for (let n = 0; n < catalogueSize; n++) {
    const roll = rng.below(100);
    const hazmat = roll < 2;
    const fragile = roll >= 2 && roll < 20;
    const top = fragile ? fragileMaxG : maxG;
    const sku = `W${String(n).padStart(4, '0')}`;
    catalogue.push(new Item(sku, `wholesale line ${n}`, 60 + rng.below(top - 59), { fragile, hazmat }));
  }
  const units = [];
  while (units.length < count) {
    const item = catalogue[rng.below(catalogueSize)];
    const quantity = Math.min(1 + rng.below(40), count - units.length);
    for (let i = 0; i < quantity; i++) units.push(item);
  }
  return units;
}

module.exports = { Lcg, wholesaleUnits };
