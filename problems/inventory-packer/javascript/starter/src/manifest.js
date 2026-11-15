// Packing manifests (printed at the pack bench) and carrier labels.
const { formatGrams, formatKg } = require('./units');

/** The bench sheet: one block per carton, identical units grouped. */
function formatManifest(orderId, cartons) {
  const count = cartons.length;
  const total = cartons.reduce((sum, carton) => sum + carton.weightG, 0);
  const lines = [`Order ${orderId}: ${plural(count, 'carton')}, ${formatGrams(total)}`];
  for (const carton of cartons) {
    lines.push(heading(carton, count));
    for (const [item, quantity] of groupUnits(carton.items)) {
      lines.push(`    ${String(quantity).padStart(3)} x ${item.sku.padEnd(12)} ${item.description.slice(0, 30).padEnd(30)} `
        + formatGrams(item.weightG * quantity).padStart(9));
    }
  }
  return lines.join('\n');
}

/** Declared weight for each carton, as printed on the carrier label. */
function carrierLabels(orderId, cartons) {
  const count = cartons.length;
  return cartons.map(carton => `${orderId}-${carton.number}/${count} ${carton.cartonType.code} ${formatKg(carton.weightG)}`);
}

/** [[item, quantity]] with units of the same SKU merged, in first-packed order. */
function groupUnits(items) {
  const groups = new Map();
  for (const item of items) {
    const [first, quantity] = groups.get(item.sku) || [item, 0];
    groups.set(item.sku, [first, quantity + 1]);
  }
  return [...groups.values()];
}

function heading(carton, count) {
  const marks = [['FRAGILE', carton.fragile], ['HAZMAT', carton.hazmat]]
    .filter(([, on]) => on).map(([flag]) => `  ${flag}`).join('');
  return `  Carton ${carton.number}/${count}  ${carton.cartonType.name.padEnd(10)} `
    + `${formatGrams(carton.weightG).padStart(9)} of ${formatGrams(carton.limitG)}${marks}`;
}

function plural(n, word) {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

module.exports = { formatManifest, carrierLabels, groupUnits };
