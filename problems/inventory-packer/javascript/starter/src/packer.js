// Plans which carton each unit of an order goes into.
//
// Packing rules agreed with the carriers:
//
// 1. The contents of a carton weigh at most cartonType.maxWeightG.
// 2. Once a carton holds a fragile item, its contents weigh at most
//    cartonType.fragileMaxWeightG (the padding needs the headroom).
// 3. A hazmat item ships alone: nothing else goes in its carton.
const { Carton } = require('./cartons');

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
 * Returns the cartons in the order they are opened, numbered from 1.
 * Throws PackingError if some item cannot ship in cartonType even on its own.
 */
function packItems(items, cartonType) {
  throw new Error('Not implemented: packItems (Phase 2)');
}

/** Plan cartons for every unit of an order. */
function packOrder(order, cartonType) {
  return packItems(order.units(), cartonType);
}

module.exports = { PackingError, packItems, packOrder };
