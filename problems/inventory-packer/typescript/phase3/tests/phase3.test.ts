import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Item } from '../src/catalog.ts';
import type { ItemFlags } from '../src/catalog.ts';
import { CARTON_TYPES } from '../src/cartons.ts';
import type { Carton, CartonType } from '../src/cartons.ts';
import { packItems } from '../src/packer.ts';
import { wholesaleUnits } from './generator.ts';

const MEDIUM = CARTON_TYPES.M;

const unit = (sku: string, grams: number, flags: ItemFlags = {}): Item => new Item(sku, `test unit ${sku}`, grams, flags);
const skus = (cartons: readonly Carton[]): string[][] => cartons.map(carton => carton.items.map(item => item.sku));

function tally(items: readonly Item[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.sku, (counts.get(item.sku) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Every unit packed exactly once, cartons numbered in order, every packing rule respected. */
function assertValidPlan(items: readonly Item[], cartons: readonly Carton[], kind: CartonType): void {
  assert.deepEqual(tally(cartons.flatMap(carton => carton.items)), tally(items), 'every unit must be packed exactly once');
  cartons.forEach((carton, index) => {
    const label = `carton ${index + 1}`;
    assert.equal(carton.number, index + 1, `${label} is numbered ${carton.number}`);
    assert.ok(carton.items.length, `${label} is empty`);
    const weight = carton.items.reduce((sum, item) => sum + item.weightG, 0);
    assert.equal(carton.weightG, weight, `${label}: weightG does not match its contents`);
    assert.ok(weight <= kind.maxWeightG, `${label} is over the carton limit`);
    if (carton.items.some(item => item.fragile)) {
      assert.ok(weight <= kind.fragileMaxWeightG, `${label} holds fragile goods and is over the padded limit`);
    }
    if (carton.items.some(item => item.hazmat)) assert.equal(carton.items.length, 1, `${label}: a hazmat item must ship alone`);
  });
}

describe('same plan', () => {
  test('bench rule on a tight order', () => {
    const items = [unit('P', 2500), unit('Q', 2000), unit('R', 2000), unit('S', 1500), unit('T', 1000), unit('U', 1000)];
    assert.deepEqual(skus(packItems(items, MEDIUM)), [['P', 'Q'], ['R', 'S', 'T'], ['U']]);
  });

  test('every rule on a mixed order', () => {
    const items = [unit('DSK', 4000), unit('MIR', 3200, { fragile: true }), unit('LMP', 1200, { fragile: true }), unit('CAB', 900),
      unit('BAT', 800, { hazmat: true }), unit('VAS', 500, { fragile: true }), unit('PLG', 300)];
    const cartons = packItems(items, MEDIUM);
    assert.deepEqual(skus(cartons), [['DSK', 'CAB'], ['MIR', 'PLG'], ['LMP', 'VAS'], ['BAT']]);
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('equal weights keep order-line order', () => {
    const items = [unit('Y', 3200), unit('X', 3000), unit('B', 1900), unit('A', 1900)];
    assert.deepEqual(skus(packItems(items, MEDIUM)), [['Y'], ['X', 'B'], ['A']]);
  });

  test('restock order matches the bench plan', () => {
    const items = wholesaleUnits(5, 2000);
    const cartons = packItems(items, MEDIUM);
    assertValidPlan(items, cartons, MEDIUM);
    assert.equal(cartons.length, 906);
    assert.deepEqual(cartons.filter((_, i) => i % 100 === 0).map(carton => carton.weightG),
      [4879, 4868, 4839, 3175, 4960, 3488, 4989, 3350, 4969, 3335]);
    assert.equal(cartons.filter(carton => carton.fragile).length, 205);
    assert.equal(cartons.filter(carton => carton.hazmat).length, 60);
    assert.deepEqual(skus(cartons.slice(-2)), [new Array(8).fill('W0308'), new Array(8).fill('W0011')]);
  });
});

describe('scale', () => {
  test('large restock order is fast', () => {
    const items = wholesaleUnits(11, 60000);
    const start = performance.now();
    const cartons = packItems(items, MEDIUM);
    const elapsed = performance.now() - start;
    assertValidPlan(items, cartons, MEDIUM);
    assert.equal(cartons.length, 33233);
    assert.ok(elapsed < 400, `took ${elapsed.toFixed(0)}ms; a 60,000-unit order must plan in under 400ms`);
  });
});
