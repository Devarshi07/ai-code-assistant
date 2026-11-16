import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { ShotResult } from '../src/battle.ts';
import { SeekerBot } from '../src/bots.ts';
import { Ocean, coord } from '../src/ocean.ts';
import { randomFleet } from '../src/placer.ts';
import { DEFAULT_FLEET, Fleet } from '../src/ships.ts';
import type { Bot } from '../src/bots.ts';
import type { Coord } from '../src/ocean.ts';

// Hand-drawn QA fleets where ships touch. '.' is water; each letter is one ship.
const STACKED = `
AAAAA.....
BBBB......
CCC.......
DDD.......
EE........
..........
..........
..........
..........
..........
`;

const PALISADE = `
..........
..........
..........
..........
..........
.....A....
.....AB...
.....ABCD.
.....ABCDE
.....ABCDE
`;

const HARBOUR = `
..........
..........
..........
...AAAAA..
...BBBBE..
...CCCDE..
......D...
......D...
..........
..........
`;

const CORNER = `
AAA..
BB...
C....
D....
.....
`;

/** Build a Fleet from a hand-drawn chart (an independent parser, not the codebase's). */
function chartFleet(text: string): Fleet {
  const rows = text.split('\n').filter(line => line.length);
  const fleet = new Fleet(new Ocean(rows.length));
  const ships = new Map<string, Coord[]>();
  rows.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch === '.') return;
    if (!ships.has(ch)) ships.set(ch, []);
    ships.get(ch)?.push(coord(r, c));
  }));
  for (const letter of [...ships.keys()].sort()) {
    const cells = ships.get(letter) ?? [];
    const vertical = cells.length > 1 && cells[0].col === cells[1].col;
    fleet.place(cells.length, cells[0], vertical);
  }
  return fleet;
}

/**
 * Play bot against fleet with an independent referee and return the shot count.
 *
 * Results are worked out from the ships' cells here, not by Battle. The bot
 * must stay on the board, never fire at a cell twice, and sink every ship
 * within one shot per cell.
 */
function referee(bot: Bot, fleet: Fleet): number {
  const size = fleet.ocean.size;
  const owner = new Map<string, number>();
  fleet.ships.forEach((ship, i) => ship.cells.forEach(c => owner.set(`${c.row},${c.col}`, i)));
  const afloat = fleet.ships.map(ship => ship.cells.length);
  const fired = new Set<string>();
  while (afloat.some(n => n > 0)) {
    assert.ok(fired.size < size * size, `the fleet is still afloat after ${size * size} shots`);
    const { row, col } = bot.nextShot();
    assert.ok(Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < size && col >= 0 && col < size,
      `shot (${row}, ${col}) is off the ${size}x${size} board`);
    const id = `${row},${col}`;
    assert.ok(!fired.has(id), `cell (${row}, ${col}) was fired at twice`);
    fired.add(id);
    let result: ShotResult = ShotResult.MISS;
    const ship = owner.get(id);
    if (ship !== undefined) {
      afloat[ship] -= 1;
      result = afloat[ship] === 0 ? ShotResult.SUNK : ShotResult.HIT;
    }
    bot.observe({ row, col }, result);
  }
  return fired.size;
}

const average = (list: number[]): number => list.reduce((a, b) => a + b, 0) / list.length;
const seeds = (first: number, last: number): number[] => Array.from({ length: last - first + 1 }, (_, i) => first + i);

describe('efficiency', () => {
  test('standard board averages under 70 shots', () => {
    const start = performance.now();
    const shots = seeds(1, 60).map(seed => referee(new SeekerBot(10, DEFAULT_FLEET), randomFleet(seed)));
    const elapsed = performance.now() - start;
    const mean = average(shots);
    assert.ok(mean < 70, `averaged ${mean.toFixed(1)} shots over 60 standard fleets; must be under 70`);
    assert.ok(elapsed < 1000, `60 matches took ${elapsed.toFixed(0)}ms; the benchmark must finish in under 1000ms`);
  });

  test('large board averages under 135 shots', () => {
    const shots = seeds(1, 30).map(seed => referee(new SeekerBot(15, DEFAULT_FLEET), randomFleet(seed, 15)));
    const mean = average(shots);
    assert.ok(mean < 135, `averaged ${mean.toFixed(1)} shots over 30 fleets on 15x15; must be under 135`);
  });
});

describe('robustness', () => {
  test('touching ships are all sunk', () => {
    const charts: [string, string][] = [['stacked', STACKED], ['palisade', PALISADE], ['harbour', HARBOUR], ['corner', CORNER]];
    for (const [name, chart] of charts) {
      const fleet = chartFleet(chart);
      try {
        referee(new SeekerBot(fleet.ocean.size, fleet.shipSizes), fleet);
      } catch (error) {
        (error as Error).message = `${name} fleet: ${(error as Error).message}`;
        throw error;
      }
    }
  });

  test('one-cell ships are found', () => {
    const cases: [number, readonly number[]][] = [[6, [3, 2, 1, 1]], [9, [4, 3, 1, 1, 1]], [12, [...DEFAULT_FLEET, 1]]];
    for (const [size, lengths] of cases) {
      for (let seed = 1; seed <= 15; seed++) referee(new SeekerBot(size, lengths), randomFleet(seed, size, lengths));
    }
  });

  test('many board sizes', () => {
    for (let size = 5; size <= 16; size++) {
      const lengths = size < 7 ? [3, 2] : size < 10 ? [4, 3, 2, 2] : size < 14 ? DEFAULT_FLEET : [5, 4, 4, 3, 3, 2, 2];
      for (let seed = 1; seed <= 8; seed++) referee(new SeekerBot(size, lengths), randomFleet(seed, size, lengths));
    }
  });
});
