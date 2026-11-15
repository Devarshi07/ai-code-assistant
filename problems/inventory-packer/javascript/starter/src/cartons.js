// Carton types stocked at the pack benches, and cartons being filled.

class CartonType {
  /**
   * maxWeightG: carrier limit for the contents of one carton.
   * fragileMaxWeightG: lower limit once fragile padding goes in.
   */
  constructor(code, name, maxWeightG, fragileMaxWeightG) {
    this.code = code;
    this.name = name;
    this.maxWeightG = maxWeightG;
    this.fragileMaxWeightG = fragileMaxWeightG;
    Object.freeze(this);
  }
}

const CARTON_TYPES = Object.freeze({
  S: new CartonType('S', 'Small box', 2000, 1500),
  M: new CartonType('M', 'Medium box', 5000, 3500),
  L: new CartonType('L', 'Large box', 10000, 7000),
});

function cartonType(code) {
  const kind = CARTON_TYPES[String(code).toUpperCase()];
  if (!kind) throw new Error(`unknown carton type '${code}'; stocked: ${Object.keys(CARTON_TYPES).join(', ')}`);
  return kind;
}

/** The smallest stocked carton type that holds weightG in one carton, or null. */
function smallestCartonFor(weightG, fragile = false) {
  const kinds = Object.values(CARTON_TYPES).sort((a, b) => a.maxWeightG - b.maxWeightG);
  for (const kind of kinds) {
    const limit = fragile ? kind.fragileMaxWeightG : kind.maxWeightG;
    if (weightG <= limit) return kind;
  }
  return null;
}

/**
 * A carton at the pack bench.
 *
 * Carton only keeps the books. Deciding what may go in which carton is the
 * packer's job (see packer.js).
 */
class Carton {
  constructor(kind, number) {
    this.cartonType = kind;
    this.number = number;   // 1-based position in the shipment
    this.items = [];        // in the order they were packed
    this.weightG = 0;
    this.fragile = false;   // holds at least one fragile item
    this.hazmat = false;    // holds a hazmat item
  }

  /** Most the contents may weigh, given what is already inside. */
  get limitG() {
    return this.fragile ? this.cartonType.fragileMaxWeightG : this.cartonType.maxWeightG;
  }

  get remainingG() {
    return this.limitG - this.weightG;
  }

  add(item) {
    this.items.push(item);
    this.weightG += item.weightG;
    this.fragile = this.fragile || item.fragile;
    this.hazmat = this.hazmat || item.hazmat;
  }

  toString() {
    return `Carton(${this.cartonType.code}#${this.number}, ${this.items.length} items, ${this.weightG} g)`;
  }
}

module.exports = { CartonType, CARTON_TYPES, cartonType, smallestCartonFor, Carton };
