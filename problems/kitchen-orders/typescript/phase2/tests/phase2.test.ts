import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOUSE_LINE, HOUSE_MENU, Menu, MenuError, MenuItem, Station } from '../src/menu.ts';
import { Order } from '../src/orders.ts';
import { parseLog } from '../src/tickets.ts';
import { simulate } from '../src/simulator.ts';
import type { KitchenRun } from '../src/simulator.ts';
import { STADIUM_MENU, fingerprint, generate, stadiumLine } from './generator.ts';

const LUNCH_LOG = new URL('../data/saturday_lunch.txt', import.meta.url);

const MENU = new Menu([
  new MenuItem('burger', 'grill', 6),
  new MenuItem('steak', 'grill', 10),
  new MenuItem('fries', 'fryer', 4),
  new MenuItem('rings', 'fryer', 5),
  new MenuItem('salad', 'salad', 3),
]);
const ONE_EACH = [new Station('grill', 1), new Station('fryer', 1), new Station('salad', 1)];
const NOON = 12 * 60;

const order = (id: number, arrival: number, dishes: string[], { app = false, due = null }: { app?: boolean; due?: number | null } = {}) =>
  new Order({ id, arrival, dishes, priority: app, due });
const readyOf = (run: KitchenRun) => Object.fromEntries([...run.ready].sort((a, b) => a[0] - b[0]));

describe('simulation', () => {
  test('single order is ready when its last dish finishes', () => {
    const run = simulate([order(1, NOON, ['burger', 'fries', 'salad'])], MENU, ONE_EACH);
    assert.deepEqual(readyOf(run), { 1: NOON + 6 });
    assert.deepEqual(run.late, []);
  });

  test('one cook works through the queue in arrival order', () => {
    const orders = [order(1, NOON, ['steak']), order(2, NOON + 1, ['burger']), order(3, NOON + 2, ['burger'])];
    assert.deepEqual(readyOf(simulate(orders, MENU, ONE_EACH)), { 1: NOON + 10, 2: NOON + 16, 3: NOON + 22 });
  });

  test('app orders jump the queue', () => {
    const orders = [order(1, NOON, ['steak']), order(2, NOON + 1, ['burger']), order(3, NOON + 5, ['burger'], { app: true })];
    assert.deepEqual(readyOf(simulate(orders, MENU, ONE_EACH)), { 1: NOON + 10, 2: NOON + 22, 3: NOON + 16 });
  });

  test('same-minute ties go to the lower order id', () => {
    const orders = [order(7, NOON, ['burger']), order(4, NOON, ['steak'])];
    assert.deepEqual(readyOf(simulate(orders, MENU, ONE_EACH)), { 4: NOON + 10, 7: NOON + 16 });
  });

  test('dishes on one ticket cook in ticket order', () => {
    const orders = [order(7, NOON, ['steak', 'burger']), order(8, NOON + 5, ['burger'], { app: true })];
    assert.deepEqual(readyOf(simulate(orders, MENU, ONE_EACH)), { 7: NOON + 22, 8: NOON + 16 });
  });

  test('cook who finishes can take a dish arriving that minute', () => {
    const orders = [order(1, NOON, ['steak']), order(2, NOON + 2, ['burger']), order(3, NOON + 10, ['burger'], { app: true })];
    assert.deepEqual(readyOf(simulate(orders, MENU, ONE_EACH)), { 1: NOON + 10, 2: NOON + 22, 3: NOON + 16 });
  });

  test('cooks on a station work side by side', () => {
    const line = [new Station('grill', 2), new Station('fryer', 1), new Station('salad', 1)];
    const orders = [order(1, NOON, ['steak', 'burger', 'burger']), order(2, NOON + 1, ['burger'])];
    assert.deepEqual(readyOf(simulate(orders, MENU, line)), { 1: NOON + 12, 2: NOON + 16 });
  });

  test('kitchen idles until the next order', () => {
    const orders = [order(3, 23 * 60 + 55, ['steak']), order(1, NOON, ['burger']), order(2, NOON + 30, ['burger', 'salad'])];
    assert.deepEqual(readyOf(simulate(orders, MENU, ONE_EACH)), { 1: NOON + 6, 2: NOON + 36, 3: 24 * 60 + 5 });
  });

  test('late orders report minutes late', () => {
    const orders = [
      order(1, NOON, ['steak'], { due: NOON + 10 }),
      order(3, NOON + 1, ['fries'], { due: NOON + 3 }),
      order(2, NOON, ['burger'], { due: NOON + 12 }),
      order(4, NOON + 2, ['burger']),
    ];
    const run = simulate(orders, MENU, ONE_EACH);
    assert.deepEqual(readyOf(run), { 1: NOON + 10, 2: NOON + 16, 3: NOON + 5, 4: NOON + 22 });
    assert.deepEqual(run.late, [{ id: 2, minutesLate: 4 }, { id: 3, minutesLate: 2 }], 'finishing exactly on the due minute is on time');
  });

  test('unknown dish is rejected', () => {
    assert.throws(() => simulate([order(1, NOON, ['lobster'])], MENU, ONE_EACH), MenuError);
  });
});

describe('services', () => {
  test('saturday lunch', () => {
    const orders = parseLog(readFileSync(LUNCH_LOG, 'utf8'));
    const run = simulate(orders, HOUSE_MENU, HOUSE_LINE);
    assert.deepEqual(readyOf(run), {
      101: 707, 102: 709, 103: 715, 104: 721, 105: 749, 106: 728, 107: 736, 108: 753, 109: 736,
      110: 732, 111: 762, 112: 745, 113: 745, 114: 767, 115: 778, 116: 790, 117: 798, 118: 811,
    });
    assert.deepEqual(run.late, [{ id: 108, minutesLate: 13 }, { id: 111, minutesLate: 7 }]);
  });

  test('busy dinner service', () => {
    const orders = generate(3, 300, 18 * 60, 240);
    const run = simulate(orders, STADIUM_MENU, stadiumLine(3, 3, 1, 1));
    assert.deepEqual([1000, 1001, 1002, 1299].map(id => run.ready.get(id)), [1267, 1438, 1174, 1085]);
    assert.deepEqual(fingerprint(run), [300, 390664, 448924524, 1556, 63, 7199]);
  });
});
