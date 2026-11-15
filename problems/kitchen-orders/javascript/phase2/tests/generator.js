// Seeded service generator for the larger simulation tests.
//
// It uses a Park-Miller LCG, so the Python and JavaScript suites build exactly
// the same services from the same seed.
const { Menu, MenuItem, Station } = require('../src/menu');
const { Order } = require('../src/orders');

const STADIUM_MENU = new Menu([
  new MenuItem('smash burger', 'grill', 6),
  new MenuItem('bratwurst', 'grill', 4),
  new MenuItem('chicken wrap', 'grill', 5),
  new MenuItem('fries', 'fryer', 4),
  new MenuItem('wings', 'fryer', 8),
  new MenuItem('tenders', 'fryer', 6),
  new MenuItem('pretzel', 'oven', 3),
  new MenuItem('pizza slice', 'oven', 2),
  new MenuItem('caesar salad', 'salad', 3),
  new MenuItem('fruit cup', 'salad', 1),
]);
const DISHES = [...STADIUM_MENU].map(item => item.name);

function stadiumLine(grill, fryer, oven, salad) {
  return [new Station('grill', grill), new Station('fryer', fryer), new Station('oven', oven), new Station('salad', salad)];
}

/** Park-Miller "minimal standard" generator; below(n) returns 0..n-1. */
function lcg(seed) {
  const MOD = 2147483647;
  let state = seed % MOD || 1;
  return n => {
    state = (state * 48271) % MOD;
    return state % n;
  };
}

/**
 * `count` orders rung in uniformly over `minutes` minutes from minute `opens`.
 * Ids are unique but unrelated to arrival, and the list is not sorted.
 */
function generate(seed, count, opens, minutes, appPercent = 20, duePercent = 35) {
  const below = lcg(seed);
  const orders = [];
  for (let k = 0; k < count; k++) {
    const arrival = opens + below(minutes);
    const size = 1 + below(4);
    const dishes = [];
    for (let d = 0; d < size; d++) dishes.push(DISHES[below(DISHES.length)]);
    const priority = below(100) < appPercent;
    const promised = below(100) < duePercent;
    const wait = 12 + below(30);
    const due = priority || promised ? arrival + wait : null;
    orders.push(new Order({ id: 1000 + k, arrival, dishes, priority, due }));
  }
  return orders;
}

/** Summary of a run that any correct simulation reproduces exactly. */
function fingerprint(run) {
  let total = 0;
  let weighted = 0;
  let last = -Infinity;
  for (const [id, minute] of run.ready) {
    total += minute;
    weighted += id * minute;
    if (minute > last) last = minute;
  }
  const lateMinutes = run.late.reduce((sum, entry) => sum + entry.minutesLate, 0);
  return [run.ready.size, total, weighted, last, run.late.length, lateMinutes];
}

module.exports = { STADIUM_MENU, DISHES, stadiumLine, lcg, generate, fingerprint };
