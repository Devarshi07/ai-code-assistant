import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, ShotResult } from '../src/battle.ts';
import { ScriptedBot } from '../src/bots.ts';
import { playMatch } from '../src/match.ts';
import { Ocean, OffBoardError, coord, label, parseLabel } from '../src/ocean.ts';
import { randomFleet } from '../src/placer.ts';
import { Fleet, PlacementError } from '../src/ships.ts';
import type { Coord } from '../src/ocean.ts';

const { MISS, HIT, SUNK } = ShotResult;

// randomFleet(7) as recorded by QA. Every other harness produces the same chart.
const SEED_7_CHART = `
     1  2  3  4  5  6  7  8  9 10
 A   .  .  A  A  A  A  A  .  .  .
 B   .  .  .  .  .  .  .  .  .  .
 C   .  .  .  .  .  .  .  .  .  .
 D   .  .  .  C  .  .  .  .  .  .
 E   .  .  .  C  .  .  .  .  .  .
 F   .  .  E  C  .  .  B  B  B  B
 G   .  .  E  .  D  .  .  .  .  .
 H   .  .  .  .  D  .  .  .  .  .
 I   .  .  .  .  D  .  .  .  .  .
 J   .  .  .  .  .  .  .  .  .  .
`;

// QA ticket #212: an experimental bot that kept re-firing at the same squares.
const STUCK_BOT_SHOTS = ['C5', 'A3', 'A3', 'A3', 'A3', 'A3', 'F7', 'F7', 'F7', 'F7',
  'D4', 'D4', 'D4', 'G5', 'G5', 'G5', 'F3', 'F3'];

/** 6x6 board: a destroyer on A1-A2 and a vertical cruiser on C4-E4. */
function smallFleet(): Fleet {
  const fleet = new Fleet(new Ocean(6));
  fleet.place(2, 'A1');
  fleet.place(3, 'C4', true);
  return fleet;
}

/** Ships are straight, unbroken, on the board and never share a cell. */
function assertValidFleet(fleet: Fleet, size: number, lengths: readonly number[]): void {
  assert.deepEqual(fleet.ships.map(ship => ship.cells.length).sort((a, b) => a - b), [...lengths].sort((a, b) => a - b));
  const seen = new Set<string>();
  for (const ship of fleet.ships) {
    const cells = ship.cells.map((c): [number, number] => [c.row, c.col]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const [r0, c0] = cells[0];
    const across = cells.map((_, i) => [r0, c0 + i]);
    const down = cells.map((_, i) => [r0 + i, c0]);
    assert.ok(JSON.stringify(cells) === JSON.stringify(across) || JSON.stringify(cells) === JSON.stringify(down),
      `${ship.name} is not a straight unbroken line: ${JSON.stringify(cells)}`);
    for (const [r, c] of cells) {
      assert.ok(r >= 0 && r < size && c >= 0 && c < size, `${ship.name} hangs off the board at (${r}, ${c})`);
      assert.ok(!seen.has(`${r},${c}`), `${ship.name} overlaps another ship at (${r}, ${c})`);
      seen.add(`${r},${c}`);
    }
  }
}

describe('shots', () => {
  test('fresh shots report miss, hit and sunk', () => {
    const battle = new Battle(smallFleet());
    assert.deepEqual(['A3', 'A1', 'A2'].map(c => battle.fire(c)), [MISS, HIT, SUNK]);
    assert.equal(battle.shotsFired, 3);
    assert.equal(battle.fleetSunk, false);
  });

  test('repeat shot into water is a wasted miss', () => {
    const battle = new Battle(smallFleet());
    assert.deepEqual([battle.fire('B5'), battle.fire('B5')], [MISS, MISS]);
    assert.equal(battle.shotsFired, 2);
    assert.equal(battle.log[1].repeat, true);
    assert.equal(battle.repeats, 1);
  });

  test('repeat shot at a hit is a wasted miss', () => {
    const battle = new Battle(smallFleet());
    assert.equal(battle.fire('D4'), HIT);
    assert.equal(battle.fire('D4'), MISS, 'a second shot at a cell that was already hit must be a MISS');
    assert.equal(battle.shotsFired, 2);
    assert.equal(battle.log[1].repeat, true, 'the second shot must be logged as a repeat');
  });

  test('double tap does not sink a destroyer', () => {
    const fleet = smallFleet();
    const battle = new Battle(fleet);
    assert.deepEqual([battle.fire('A1'), battle.fire('A1')], [HIT, MISS]);
    assert.equal(fleet.shipAt('A1')?.isSunk, false, "only one of the destroyer's two cells has been hit");
    assert.equal(battle.fire('A2'), SUNK);
  });

  test('firing at a sunk ship again is a miss', () => {
    const battle = new Battle(smallFleet());
    for (const cell of ['C4', 'D4', 'E4']) battle.fire(cell);
    assert.equal(battle.fire('E4'), MISS);
    assert.equal(battle.repeats, 1);
  });

  test('fleet is sunk only when every ship is', () => {
    const battle = new Battle(smallFleet());
    for (const cell of ['A1', 'A2', 'C4', 'D4']) battle.fire(cell);
    assert.equal(battle.fleetSunk, false);
    assert.equal(battle.fire('E4'), SUNK);
    assert.equal(battle.fleetSunk, true);
  });

  test('off-board shot throws and is not counted', () => {
    const battle = new Battle(smallFleet());
    assert.throws(() => battle.fire('G1'), OffBoardError);
    assert.throws(() => battle.fire(coord(0, 6)), OffBoardError);
    assert.equal(battle.shotsFired, 0);
  });
});

describe('matches', () => {
  test('stuck bot cannot win by repeating', () => {
    const bot = new ScriptedBot(10, STUCK_BOT_SHOTS);
    const report = playMatch(bot, randomFleet(7), STUCK_BOT_SHOTS.length);
    assert.equal(report.shots, 18);
    assert.equal(report.won, false, 'the bot only ever hit five distinct cells');
    assert.equal(report.repeats, 12);
  });

  test('row-by-row replay wins without repeats', () => {
    const shots: Coord[] = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) shots.push(coord(r, c));
    const report = playMatch(new ScriptedBot(10, shots), randomFleet(7));
    assert.equal(report.won, true);
    assert.equal(report.shots, 85, 'the last ship cell in row order is I5');
    assert.equal(report.repeats, 0);
  });
});

describe('placement', () => {
  test('overlapping ship is rejected', () => {
    const fleet = smallFleet();
    assert.throws(() => fleet.place(3, 'D3'), PlacementError);
    assert.equal(fleet.ships.length, 2);
  });

  test('ship running off the board is rejected', () => {
    const fleet = new Fleet(new Ocean(6));
    assert.throws(() => fleet.place(4, 'A4'), PlacementError);
    assert.throws(() => fleet.place(3, 'E2', true), PlacementError);
  });

  test('seeded fleets are valid and reproducible', () => {
    const cases: [number, number[]][] = [[10, [5, 4, 3, 3, 2]], [6, [4, 3, 2]], [15, [5, 4, 4, 3, 3, 2, 1]]];
    for (const [size, lengths] of cases) {
      for (let seed = 1; seed <= 40; seed++) {
        const fleet = randomFleet(seed, size, lengths);
        assertValidFleet(fleet, size, lengths);
        assert.deepEqual(fleet.ships.map(s => s.cells), randomFleet(seed, size, lengths).ships.map(s => s.cells));
      }
    }
  });

  test('seed 7 matches the recorded chart', () => {
    assert.equal(randomFleet(7).render(), SEED_7_CHART.replace(/^\n+|\n+$/g, ''));
  });

  test('labels', () => {
    assert.deepEqual(parseLabel('B7'), coord(1, 6));
    assert.deepEqual(parseLabel(' j10 '), coord(9, 9));
    assert.equal(label(coord(0, 0)), 'A1');
  });
});
