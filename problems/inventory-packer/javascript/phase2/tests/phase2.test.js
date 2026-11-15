const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Item } = require('../src/catalog');
const { CARTON_TYPES } = require('../src/cartons');
const { loadOrders } = require('../src/orders');
const { PackingError, packItems, packOrder } = require('../src/packer');

const { S: SMALL, M: MEDIUM, L: LARGE } = CARTON_TYPES;

const TABLEWARE_EXPORT = `order_id,sku,description,weight_kg,qty,flags
A1005,GLS-WIN-04,"Wine glasses, set of 4",1.12,3,fragile
A1005,BRD-OAK-40,Oak serving board,1.9,2,
A1005,DCN-GLS-01,Glass decanter,1.35,1,fragile
A1005,NAP-LIN-06,"Linen napkins, set of 6",0.31,2,
`;

const unit = (sku, grams, flags = {}) => new Item(sku, `test unit ${sku}`, grams, flags);
const skus = cartons => cartons.map(carton => carton.items.map(item => item.sku));

function tally(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.sku, (counts.get(item.sku) || 0) + 1);
  return [...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Every unit packed exactly once, cartons numbered in order, every packing rule respected. */
function assertValidPlan(items, cartons, kind) {
  assert.deepEqual(tally(cartons.flatMap(carton => carton.items)), tally(items), 'every unit must be packed exactly once');
  cartons.forEach((carton, index) => {
    const label = `carton ${index + 1}`;
    assert.equal(carton.number, index + 1, `${label} is numbered ${carton.number}`);
    assert.equal(carton.cartonType, kind, `${label} is the wrong carton type`);
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

/** Exhaustive search: the fewest cartons ANY legal plan needs. Small inputs only. */
function fewestCartons(items, kind) {
  const groups = [];
  let best = items.length;
  const fits = (group, item) => {
    if (item.hazmat || group.some(other => other.hazmat)) return false;
    const everything = [...group, item];
    const limit = everything.some(i => i.fragile) ? kind.fragileMaxWeightG : kind.maxWeightG;
    return everything.reduce((sum, i) => sum + i.weightG, 0) <= limit;
  };
  const place = index => {
    if (groups.length >= best) return;
    if (index === items.length) { best = groups.length; return; }
    const item = items[index];
    for (const group of groups) {
      if (fits(group, item)) { group.push(item); place(index + 1); group.pop(); }
    }
    groups.push([item]);
    place(index + 1);
    groups.pop();
  };
  place(0);
  return best;
}

describe('bench rule', () => {
  test('empty order needs no cartons', () => {
    assert.deepEqual(packItems([], MEDIUM), []);
  });

  test('light order fits one carton', () => {
    const items = [unit('A', 1200), unit('B', 800), unit('C', 450)];
    const cartons = packItems(items, MEDIUM);
    assert.deepEqual(skus(cartons), [['A', 'B', 'C']]);
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('heaviest units are packed first', () => {
    const items = [unit('A', 1000), unit('B', 1000), unit('C', 1000), unit('D', 3000), unit('E', 3000), unit('F', 1000)];
    const cartons = packItems(items, MEDIUM);
    assert.equal(cartons.length, 2, 'packing in arrival order would need 3 cartons');
    assert.equal(cartons.length, fewestCartons(items, MEDIUM));
    assert.deepEqual(skus(cartons), [['D', 'A', 'B'], ['E', 'C', 'F']]);
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('a carton may be filled exactly', () => {
    assert.deepEqual(skus(packItems([unit('A', 2500), unit('B', 2500)], MEDIUM)), [['A', 'B']]);
    assert.deepEqual(skus(packItems([unit('X', 5000)], MEDIUM)), [['X']]);
  });

  test('each unit goes into the earliest carton that takes it', () => {
    const items = [unit('A', 3000), unit('B', 2600), unit('C', 2100), unit('D', 1500), unit('E', 250)];
    const cartons = packItems(items, MEDIUM);
    assert.deepEqual(skus(cartons), [['A', 'D', 'E'], ['B', 'C']], 'E fits both cartons; the bench uses the earliest one');
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('bench rule is followed even when a tighter plan exists', () => {
    const items = [unit('P', 2500), unit('Q', 2000), unit('R', 2000), unit('S', 1500), unit('T', 1000), unit('U', 1000)];
    const cartons = packItems(items, MEDIUM);
    assert.equal(fewestCartons(items, MEDIUM), 2);
    assert.deepEqual(skus(cartons), [['P', 'Q'], ['R', 'S', 'T'], ['U']], 'the bench follows its rule, so this order ships in 3 cartons');
  });

  test('equal weights keep order-line order', () => {
    assert.deepEqual(skus(packItems([unit('A', 2000), unit('B', 2000), unit('C', 2000)], MEDIUM)), [['A', 'B'], ['C']]);
    assert.deepEqual(skus(packItems([unit('C', 2000), unit('B', 2000), unit('A', 2000)], MEDIUM)), [['C', 'B'], ['A']]);
  });
});

describe('packing rules', () => {
  test('fragile unit lowers the carton limit', () => {
    const items = [unit('VAS', 2000, { fragile: true }), unit('BK1', 1500), unit('BK2', 1500)];
    const cartons = packItems(items, MEDIUM);
    assert.deepEqual(skus(cartons), [['VAS', 'BK1'], ['BK2']], 'a fragile carton takes at most 3,500 g');
    assert.equal(cartons.length, fewestCartons(items, MEDIUM));
    assert.equal(cartons[0].fragile, true);
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('fragile unit skips a carton that is already too heavy', () => {
    const items = [unit('A', 3000), unit('G', 1000, { fragile: true }), unit('B', 1000)];
    const cartons = packItems(items, MEDIUM);
    assert.deepEqual(skus(cartons), [['A', 'B'], ['G']]);
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('hazmat ships alone', () => {
    const items = [unit('BAT1', 300, { hazmat: true }), unit('A', 400), unit('B', 500), unit('BAT2', 200, { hazmat: true })];
    const cartons = packItems(items, MEDIUM);
    assert.deepEqual(skus(cartons), [['B', 'A'], ['BAT1'], ['BAT2']]);
    assert.equal(cartons.length, fewestCartons(items, MEDIUM));
    assertValidPlan(items, cartons, MEDIUM);
  });

  test('unit too heavy for the carton type is refused', () => {
    const refused = sku => error => error instanceof PackingError && error.message.includes(sku);
    assert.throws(() => packItems([unit('A', 400), unit('ANV-01', 5200)], MEDIUM), refused('ANV-01'));
    assert.throws(() => packItems([unit('MIR-01', 3600, { fragile: true })], MEDIUM), refused('MIR-01'));
    assert.equal(packItems([unit('MIR-02', 3500, { fragile: true })], MEDIUM).length, 1);
    assert.throws(() => packItems([unit('BAT', 2100, { hazmat: true })], SMALL), PackingError);
  });

  test("caller's list is left alone", () => {
    const items = [unit('A', 100), unit('B', 900), unit('C', 500)];
    packItems(items, MEDIUM);
    assert.deepEqual(items.map(item => item.sku), ['A', 'B', 'C']);
  });
});

describe('order packing', () => {
  test('whole order from the export', () => {
    const [order] = loadOrders(TABLEWARE_EXPORT);
    const cartons = packOrder(order, LARGE);
    assert.deepEqual(skus(cartons), [
      ['BRD-OAK-40', 'BRD-OAK-40', 'DCN-GLS-01', 'GLS-WIN-04', 'NAP-LIN-06', 'NAP-LIN-06'],
      ['GLS-WIN-04', 'GLS-WIN-04'],
    ]);
    assert.deepEqual(cartons.map(carton => carton.weightG), [6890, 2240]);
    assertValidPlan(order.units(), cartons, LARGE);
  });

  test('random small orders are valid and repeatable', () => {
    let seed = 42;
    const below = n => { seed = (seed * 48271) % 2147483647; return seed % n; };
    for (let trial = 0; trial < 60; trial++) {
      const kind = [SMALL, MEDIUM, LARGE][below(3)];
      const items = [];
      const count = 1 + below(8);
      for (let n = 0; n < count; n++) {
        const hazmat = below(10) === 0;
        const fragile = !hazmat && below(10) < 3;
        const top = fragile ? kind.fragileMaxWeightG : kind.maxWeightG;
        items.push(unit(`T${trial}-${n}`, 100 * (1 + below(top / 100)), { fragile, hazmat }));
      }
      const cartons = packItems(items, kind);
      assertValidPlan(items, cartons, kind);
      assert.ok(cartons.length >= fewestCartons(items, kind));
      assert.deepEqual(skus(packItems(items, kind)), skus(cartons), 'same order, same plan');
    }
  });
});
