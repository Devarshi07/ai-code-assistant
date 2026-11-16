// Packing manifests (printed at the pack bench) and carrier labels.
import type { Carton } from './cartons.ts';
import type { Item } from './catalog.ts';
import { formatGrams, formatKg } from './units.ts';

/** The bench sheet: one block per carton, identical units grouped. */
export function formatManifest(orderId: string, cartons: readonly Carton[]): string {
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
export function carrierLabels(orderId: string, cartons: readonly Carton[]): string[] {
  const count = cartons.length;
  return cartons.map(carton => `${orderId}-${carton.number}/${count} ${carton.cartonType.code} ${formatKg(carton.weightG)}`);
}

/** [item, quantity] pairs with units of the same SKU merged, in first-packed order. */
export function groupUnits(items: readonly Item[]): [Item, number][] {
  const groups = new Map<string, [Item, number]>();
  for (const item of items) {
    const [first, quantity] = groups.get(item.sku) ?? [item, 0];
    groups.set(item.sku, [first, quantity + 1]);
  }
  return [...groups.values()];
}

function heading(carton: Carton, count: number): string {
  let marks = '';
  if (carton.fragile) marks += '  FRAGILE';
  if (carton.hazmat) marks += '  HAZMAT';
  return `  Carton ${carton.number}/${count}  ${carton.cartonType.name.padEnd(10)} `
    + `${formatGrams(carton.weightG).padStart(9)} of ${formatGrams(carton.limitG)}${marks}`;
}

function plural(n: number, word: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}
