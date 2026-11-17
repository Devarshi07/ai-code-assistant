import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Order } from '../src/orders.ts';
import { simulate } from '../src/simulator.ts';
import type { KitchenRun } from '../src/simulator.ts';
import { STADIUM_MENU, fingerprint, generate, stadiumLine } from './generator.ts';

const readyOf = (run: KitchenRun) => Object.fromEntries([...run.ready].sort((a, b) => a[0] - b[0]));

describe('scale', () => {
  test('stadium afternoon matches reference', () => {
    const orders = generate(11, 4000, 16 * 60, 720);
    const run = simulate(orders, STADIUM_MENU, stadiumLine(8, 10, 3, 2));
    assert.deepEqual([1000, 1001, 1002, 4999].map(id => run.ready.get(id)), [1309, 2342, 2288, 1261]);
    assert.deepEqual(fingerprint(run), [4000, 7669837, 23035378252, 2918, 1099, 792208]);
  });

  test('burst of simultaneous orders', () => {
    // 60 one-burger orders land in the same minute; every 7th is an app order.
    // Four grill cooks plate them four at a time, strictly in rank order.
    const ids = Array.from({ length: 60 }, (_, k) => 60 - k);
    const orders = ids.map(id => new Order({ id, arrival: 1200, dishes: ['smash burger'], priority: id % 7 === 0 }));
    const run = simulate(orders, STADIUM_MENU, stadiumLine(4, 1, 1, 1));
    const ranked = [...ids].sort((a, b) => (a % 7 === 0 ? 0 : 1) - (b % 7 === 0 ? 0 : 1) || a - b);
    const expected = Object.fromEntries(ranked.map((id, k) => [id, 1200 + 6 * (Math.floor(k / 4) + 1)]));
    assert.deepEqual(readyOf(run), expected);
  });

  test('quiet service matches the quote', () => {
    // Orders 30 minutes apart never queue, so each is ready at its quote.
    const orders = generate(5, 500, 0, 1).map((o, k) =>
      new Order({ id: o.id, arrival: 600 + 30 * k, dishes: o.dishes, priority: o.priority, due: 600 + 30 * k + 5 }));
    const run = simulate(orders, STADIUM_MENU, stadiumLine(4, 4, 4, 4));
    assert.deepEqual(readyOf(run), Object.fromEntries(orders.map(o => [o.id, o.quote(STADIUM_MENU)])));
    const expectedLate = orders
      .filter(o => o.quote(STADIUM_MENU) > o.due!)
      .map(o => ({ id: o.id, minutesLate: o.quote(STADIUM_MENU) - o.due! }));
    assert.deepEqual(run.late, expectedLate);
  });

  test('game day rush is fast', () => {
    const orders = generate(7, 48000, 16 * 60, 3 * 24 * 60);
    const line = stadiumLine(28, 33, 9, 8);
    const start = performance.now();
    const run = simulate(orders, STADIUM_MENU, line);
    const elapsed = performance.now() - start;
    assert.deepEqual(fingerprint(run), [48000, 203373725, 5078165980802, 7655, 13299, 18011430]);
    assert.ok(elapsed < 900, `took ${elapsed.toFixed(0)}ms; a 48,000-order game day must simulate in under 900ms`);
  });
});
