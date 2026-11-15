// Plans which carton each unit of an order goes into.
//
// Packing rules agreed with the carriers:
//
// 1. The contents of a carton weigh at most cartonType.maxWeightG.
// 2. Once a carton holds a fragile item, its contents weigh at most
//    cartonType.fragileMaxWeightG (the padding needs the headroom).
// 3. A hazmat item ships alone: nothing else goes in its carton.
const { Carton } = require('./cartons');
const { formatGrams } = require('./units');

const CLOSED = -1;   // room value for cartons nothing more may enter, and for unopened slots

/** An item cannot ship in the requested carton type at all. */
class PackingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PackingError';
  }
}

/**
 * Max segment tree over carton slots, answering "leftmost slot with room >= need".
 *
 * Slots are carton positions in opening order. Both set() and leftmost() are
 * O(log n), which keeps the bench rule's "earliest carton that fits" cheap
 * even with tens of thousands of open cartons.
 */
class RoomTree {
  constructor(slots) {
    let size = 1;
    while (size < Math.max(slots, 1)) size *= 2;
    this.size = size;
    this.best = new Array(2 * size).fill(CLOSED);
  }

  set(slot, room) {
    const best = this.best;
    let node = slot + this.size;
    best[node] = room;
    for (node >>= 1; node; node >>= 1) {
      const top = Math.max(best[2 * node], best[2 * node + 1]);
      if (best[node] === top) break;   // nothing above this node changes either
      best[node] = top;
    }
  }

  /** Index of the leftmost slot with room >= need, or -1 if none has. */
  leftmost(need) {
    const best = this.best;
    if (best[1] < need) return -1;
    let node = 1;
    while (node < this.size) {
      node *= 2;
      if (best[node] < need) node += 1;
    }
    return node - this.size;
  }
}

/**
 * Plan cartons of cartonType for items, following the bench rule.
 *
 * Bench rule (first-fit decreasing): take units heaviest first, keeping
 * order-line order between equal weights, and put each one into the
 * earliest-opened carton that may legally take it. Open a new carton only
 * when none can.
 *
 * Instead of scanning every open carton per unit, two segment trees track how
 * much more each carton may take: one for ordinary units (its current limit
 * minus its load) and one for fragile units (the fragile limit minus its
 * load). The leftmost slot with enough room is exactly the carton the scan
 * would have found, so the plan is identical, in O(n log n).
 *
 * Returns the cartons in the order they are opened, numbered from 1.
 * Throws PackingError if some item cannot ship in cartonType even on its own.
 */
function packItems(items, cartonType) {
  for (const item of items) checkShippable(item, cartonType);
  const fragileLimit = cartonType.fragileMaxWeightG;
  const ordinaryRoom = new RoomTree(items.length);
  const fragileRoom = new RoomTree(items.length);
  const cartons = [];
  const ordered = [...items].sort((a, b) => b.weightG - a.weightG);   // stable sort
  for (const item of ordered) {
    let slot = -1;
    if (!item.hazmat) slot = (item.fragile ? fragileRoom : ordinaryRoom).leftmost(item.weightG);
    if (slot < 0) {
      slot = cartons.length;
      cartons.push(new Carton(cartonType, slot + 1));
    }
    const carton = cartons[slot];
    carton.add(item);
    if (carton.hazmat) {
      ordinaryRoom.set(slot, CLOSED);
      fragileRoom.set(slot, CLOSED);
    } else {
      ordinaryRoom.set(slot, carton.limitG - carton.weightG);
      fragileRoom.set(slot, fragileLimit - carton.weightG);
    }
  }
  return cartons;
}

/** True if the packing rules allow item into carton as it stands. */
function canTake(carton, item) {
  if (carton.hazmat || item.hazmat) return false;
  const kind = carton.cartonType;
  const limit = carton.fragile || item.fragile ? kind.fragileMaxWeightG : kind.maxWeightG;
  return carton.weightG + item.weightG <= limit;
}

/** Throw PackingError if item is too heavy for cartonType even alone. */
function checkShippable(item, cartonType) {
  const limit = item.fragile ? cartonType.fragileMaxWeightG : cartonType.maxWeightG;
  if (item.weightG > limit) {
    throw new PackingError(`${item.sku} weighs ${formatGrams(item.weightG)}; a ${cartonType.name} `
      + `takes at most ${formatGrams(limit)}${item.fragile ? ' when fragile' : ''}`);
  }
}

/** Plan cartons for every unit of an order. */
function packOrder(order, cartonType) {
  return packItems(order.units(), cartonType);
}

module.exports = { PackingError, packItems, packOrder, canTake };
