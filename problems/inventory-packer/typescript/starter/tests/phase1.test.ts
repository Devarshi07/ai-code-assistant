import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Item } from '../src/catalog.ts';
import type { Order } from '../src/catalog.ts';
import { CARTON_TYPES, Carton, smallestCartonFor } from '../src/cartons.ts';
import { OrderFormatError, loadOrders } from '../src/orders.ts';
import { carrierLabels, formatManifest } from '../src/manifest.ts';
import { formatGrams, formatKg, parseWeightKg } from '../src/units.ts';

const BENCH_EXPORT = `order_id,sku,description,weight_kg,qty,flags
B2001,TEA-BRK-80,Breakfast tea 80 bags,0.25,2,
B2001,MUG-STN-350,Stoneware mug 350 ml,0.38,2,fragile
B2002,BAT-LI-18,Lithium battery 18650,0.33,1,hazmat
B2001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,1,
`;

// Lines copied from orders the dispatch scale flagged this week.
const DISPATCH_EXPORT = `order_id,sku,description,weight_kg,qty,flags
C3001,PAN-CI-26,Cast iron skillet 26 cm,2.03,1,
C3001,TRV-CI-20,Cast iron trivet,1.015,3,
C3001,TWL-LIN-2,"Linen tea towels, set of 2",0.18,2,
C3002,KTL-ENM-15,Enamel kettle 1.5 l,1.005,1,
C3002,APR-LIN-01,Linen apron,0.42,1,
C3002,WRP-BEE-03,"Beeswax wraps, pack of 3",0.576,1,
`;

const byId = (orders: Order[]): Record<string, Order> => Object.fromEntries(orders.map(order => [order.orderId, order]));

describe('weight readings', () => {
  test('simple kilogram readings', () => {
    for (const [text, grams] of [['2', 2000], ['0.5', 500], ['0.25', 250], ['1.2', 1200], ['0.035', 35]] as const) {
      assert.equal(parseWeightKg(text), grams, `${text} kg`);
    }
  });

  test('malformed readings are rejected', () => {
    for (const text of ['', 'abc', '-1', '1,5', '1.2kg']) {
      assert.throws(() => parseWeightKg(text), Error, JSON.stringify(text));
    }
  });

  test('weight formatting', () => {
    assert.equal(formatGrams(5435), '5,435 g');
    assert.equal(formatGrams(800), '800 g');
    assert.equal(formatKg(5435), '5.435 kg');
    assert.equal(formatKg(35), '0.035 kg');
  });
});

describe('order export', () => {
  test('lines are grouped by order', () => {
    const orders = loadOrders(BENCH_EXPORT);
    assert.deepEqual(orders.map(order => order.orderId), ['B2001', 'B2002']);
    const first = orders[0];
    assert.deepEqual(first.lines.map(line => line.item.sku), ['TEA-BRK-80', 'MUG-STN-350', 'TWL-LIN-2']);
    assert.deepEqual(first.lines.map(line => line.quantity), [2, 2, 1]);
    assert.equal(first.unitCount, 5);
    assert.equal(first.lines[2].item.description, 'Linen tea towels, set of 2');
  });

  test('flags are read', () => {
    const orders = byId(loadOrders(BENCH_EXPORT));
    const [tea, mug] = orders.B2001.lines.map(line => line.item);
    const battery = orders.B2002.lines[0].item;
    assert.deepEqual([tea.fragile, tea.hazmat], [false, false]);
    assert.deepEqual([mug.fragile, mug.hazmat], [true, false]);
    assert.deepEqual([battery.fragile, battery.hazmat], [false, true]);
  });

  test('bad line is reported with its number', () => {
    const broken = BENCH_EXPORT.replace('0.33,1,hazmat', '0.33,1,explosive');
    assert.throws(() => loadOrders(broken), (error: unknown) => error instanceof OrderFormatError && /line 4/.test(error.message));
  });

  test('unit weights match the export', () => {
    const weights = loadOrders(DISPATCH_EXPORT).flatMap(order => order.lines.map(line => line.item.weightG));
    assert.deepEqual(weights, [2030, 1015, 180, 1005, 420, 576]);
  });

  test('order weight matches the dispatch scale', () => {
    const order = byId(loadOrders(DISPATCH_EXPORT)).C3001;
    assert.equal(order.totalWeightG, 5435, 'the dispatch scale weighed this order at 5,435 g');
  });
});

describe('carton choice', () => {
  test('smallest box that holds the weight', () => {
    assert.equal(smallestCartonFor(1800)?.code, 'S');
    assert.equal(smallestCartonFor(2000)?.code, 'S', 'a full Small box is still a Small box');
    assert.equal(smallestCartonFor(2001)?.code, 'M');
    assert.equal(smallestCartonFor(9000)?.code, 'L');
    assert.equal(smallestCartonFor(10001), null);
  });

  test('fragile orders use the padded limit', () => {
    assert.equal(smallestCartonFor(1500, true)?.code, 'S');
    assert.equal(smallestCartonFor(1800, true)?.code, 'M');
  });

  test('order just over the small box limit', () => {
    const order = byId(loadOrders(DISPATCH_EXPORT)).C3002;
    const kind = smallestCartonFor(order.totalWeightG, order.hasFragile);
    assert.equal(kind?.code, 'M', 'the carrier weighed this order at 2,001 g: too heavy for a Small box');
  });
});

describe('manifest', () => {
  function sampleCartons(): Carton[] {
    const mug = new Item('MUG-STN-350', 'Stoneware mug 350 ml', 380, { fragile: true });
    const tea = new Item('TEA-BRK-80', 'Breakfast tea 80 bags', 250);
    const battery = new Item('BAT-LI-18', 'Lithium battery 18650', 330, { hazmat: true });
    const first = new Carton(CARTON_TYPES.M, 1);
    const second = new Carton(CARTON_TYPES.M, 2);
    for (const item of [mug, tea, mug]) first.add(item);
    second.add(battery);
    return [first, second];
  }

  test('manifest groups units per carton', () => {
    const lines = formatManifest('B2001', sampleCartons()).split('\n');
    assert.match(lines[0], /2 cartons/);
    assert.match(lines[0], /1,340 g/);
    assert.match(lines[1], /Carton 1\/2/);
    assert.match(lines[1], /1,010 g of 3,500 g/, 'a fragile carton shows the padded limit');
    assert.match(lines[1], /FRAGILE/);
    assert.match(lines[2], /2 x MUG-STN-350/);
    assert.match(lines[2], /760 g/);
    assert.match(lines[3], /1 x TEA-BRK-80/);
    assert.match(lines[4], /HAZMAT/);
    assert.equal(lines.length, 6);
  });

  test('carrier labels declare each carton', () => {
    assert.deepEqual(carrierLabels('B2001', sampleCartons()), ['B2001-1/2 M 1.010 kg', 'B2001-2/2 M 0.330 kg']);
  });
});
