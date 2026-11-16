// Carton types stocked at the pack benches, and cartons being filled.
import type { Item } from './catalog.ts';

export class CartonType {
  readonly code: string;
  readonly name: string;
  /** Carrier limit for the contents of one carton. */
  readonly maxWeightG: number;
  /** Lower limit once fragile padding goes in. */
  readonly fragileMaxWeightG: number;

  constructor(code: string, name: string, maxWeightG: number, fragileMaxWeightG: number) {
    this.code = code;
    this.name = name;
    this.maxWeightG = maxWeightG;
    this.fragileMaxWeightG = fragileMaxWeightG;
    Object.freeze(this);
  }
}

export const CARTON_TYPES = Object.freeze({
  S: new CartonType('S', 'Small box', 2000, 1500),
  M: new CartonType('M', 'Medium box', 5000, 3500),
  L: new CartonType('L', 'Large box', 10000, 7000),
});

export type CartonCode = keyof typeof CARTON_TYPES;

export function cartonType(code: string): CartonType {
  const key = String(code).toUpperCase();
  if (!Object.hasOwn(CARTON_TYPES, key)) {
    throw new Error(`unknown carton type '${code}'; stocked: ${Object.keys(CARTON_TYPES).join(', ')}`);
  }
  return CARTON_TYPES[key as CartonCode];
}

/** The smallest stocked carton type that holds weightG in one carton, or null. */
export function smallestCartonFor(weightG: number, fragile = false): CartonType | null {
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
 * packer's job (see packer.ts).
 */
export class Carton {
  readonly cartonType: CartonType;
  readonly number: number;     // 1-based position in the shipment
  readonly items: Item[] = []; // in the order they were packed
  weightG = 0;
  fragile = false;             // holds at least one fragile item
  hazmat = false;              // holds a hazmat item

  constructor(kind: CartonType, number: number) {
    this.cartonType = kind;
    this.number = number;
  }

  /** Most the contents may weigh, given what is already inside. */
  get limitG(): number {
    return this.fragile ? this.cartonType.fragileMaxWeightG : this.cartonType.maxWeightG;
  }

  get remainingG(): number {
    return this.limitG - this.weightG;
  }

  add(item: Item): void {
    this.items.push(item);
    this.weightG += item.weightG;
    this.fragile = this.fragile || item.fragile;
    this.hazmat = this.hazmat || item.hazmat;
  }

  toString(): string {
    return `Carton(${this.cartonType.code}#${this.number}, ${this.items.length} items, ${this.weightG} g)`;
  }
}
