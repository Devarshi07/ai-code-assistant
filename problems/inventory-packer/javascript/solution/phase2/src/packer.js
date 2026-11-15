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

/** An item cannot ship in the requested carton type at all. */
class PackingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PackingError';
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
 * Returns the cartons in the order they are opened, numbered from 1.
 * Throws PackingError if some item cannot ship in cartonType even on its own.
 */
function packItems(items, cartonType) {
  for (const item of items) checkShippable(item, cartonType);
  const cartons = [];
  const ordered = [...items].sort((a, b) => b.weightG - a.weightG);   // stable sort
  for (const item of ordered) {
    let carton = cartons.find(open => canTake(open, item));
    if (!carton) {
      carton = new Carton(cartonType, cartons.length + 1);
      cartons.push(carton);
    }
    carton.add(item);
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
