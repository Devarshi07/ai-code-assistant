const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ShotResult } = require('../src/battle');
const { SeekerBot } = require('../src/bots');
const { playMatch } = require('../src/match');
const { Ocean } = require('../src/ocean');
const { randomFleet } = require('../src/placer');
const { DEFAULT_FLEET, Fleet } = require('../src/ships');

/**
 * Play bot against fleet with an independent referee and return the shot count.
 *
 * Results are worked out from the ships' cells here, not by Battle. The bot
 * must stay on the board, never fire at a cell twice, and sink every ship
 * within one shot per cell.
 */
function referee(bot, fleet) {
  const size = fleet.ocean.size;
  const owner = new Map();
  fleet.ships.forEach((ship, i) => ship.cells.forEach(c => owner.set(`${c.row},${c.col}`, i)));
  const afloat = fleet.ships.map(ship => ship.cells.length);
  const fired = new Set();
  while (afloat.some(n => n > 0)) {
    assert.ok(fired.size < size * size, `the fleet is still afloat after ${size * size} shots`);
    const { row, col } = bot.nextShot();
    assert.ok(Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < size && col >= 0 && col < size,
      `shot (${row}, ${col}) is off the ${size}x${size} board`);
    const id = `${row},${col}`;
    assert.ok(!fired.has(id), `cell (${row}, ${col}) was fired at twice`);
    fired.add(id);
    let result = ShotResult.MISS;
    if (owner.has(id)) {
      const ship = owner.get(id);
      afloat[ship] -= 1;
      result = afloat[ship] === 0 ? ShotResult.SUNK : ShotResult.HIT;
    }
    bot.observe({ row, col }, result);
  }
  return fired.size;
}

describe('SeekerBot', () => {
  test('sinks standard fleets without repeats', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const shots = referee(new SeekerBot(10, DEFAULT_FLEET), randomFleet(seed));
      assert.ok(shots <= 100, `seed ${seed}: ${shots} shots`);
    }
  });

  test('ships hiding along the far edges', () => {
    const fleet = new Fleet(new Ocean(10));
    fleet.place(5, 'J6'); // J6-J10, the bottom row
    fleet.place(4, 'E10', true); // E10-H10, the right-hand column
    fleet.place(3, 'A8'); // A8-A10
    fleet.place(3, 'H1', true); // H1-J1
    fleet.place(2, 'J4'); // J4-J5
    referee(new SeekerBot(10, DEFAULT_FLEET), fleet);
  });

  test('small board', () => {
    for (let seed = 1; seed <= 20; seed++) referee(new SeekerBot(5, [3, 2]), randomFleet(seed, 5, [3, 2]));
  });

  test('crowded board', () => {
    for (let seed = 1; seed <= 10; seed++) referee(new SeekerBot(7, DEFAULT_FLEET), randomFleet(seed, 7, DEFAULT_FLEET));
  });

  test('large board', () => {
    const lengths = [5, 4, 4, 3, 3, 2];
    for (let seed = 1; seed <= 5; seed++) referee(new SeekerBot(20, lengths), randomFleet(seed, 20, lengths));
  });

  test('fleet with a one-cell patrol boat', () => {
    const lengths = [4, 3, 1];
    for (let seed = 1; seed <= 20; seed++) referee(new SeekerBot(8, lengths), randomFleet(seed, 8, lengths));
  });

  test('full match through the runner', () => {
    const report = playMatch(new SeekerBot(10, DEFAULT_FLEET), randomFleet(7));
    assert.equal(report.won, true);
    assert.equal(report.repeats, 0);
    assert.ok(report.shots <= 100);
  });
});
