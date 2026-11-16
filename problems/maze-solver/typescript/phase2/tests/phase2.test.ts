import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/level.ts';
import { collectAllGems, solve } from '../src/solver.ts';
import type { Run } from '../src/solver.ts';
import { TOWER, TREASURY, TUTORIAL } from '../src/levels.ts';

// Nearest-gem-first walks left, then all the way right, then back: 22 moves.
// Going right first is shorter.
const CORRIDOR = `
#############
#E$..S.....$#
#############
`;

// The gem is only reachable through the eastbound gate, and the only way back
// to the exit is the long loop through the westbound gate.
const ONE_WAY_LOOP = `
#########
#S.>.$..#
#.#####.#
#E..<...#
#########
`;

const SEALED_GEM = `
#######
#S..E.#
#####.#
#$#...#
#######
`;

const SEALED_EXIT = `
#######
#S.$#E#
#######
`;

const GATE_DELTAS: Record<string, number[]> = { '>': [0, 1], '<': [0, -1], '^': [-1, 0], v: [1, 0] };

/** A run starts at S, ends at E, takes legal steps and visits every gem. */
function assertValidRun(level: Level, run: Run): void {
  const path = run.path;
  assert.equal(run.moves, path.length - 1, 'moves must equal path.length - 1');
  assert.deepEqual(path[0], level.start, 'run must begin on the start tile');
  assert.deepEqual(path[path.length - 1], level.exit, 'run must end on the exit tile');
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const delta = [b.row - a.row, b.col - a.col];
    assert.equal(Math.abs(delta[0]) + Math.abs(delta[1]), 1, `(${a.row},${a.col}) -> (${b.row},${b.col}) is not a single step`);
    assert.ok(b.row >= 0 && b.row < level.height && b.col >= 0 && b.col < level.width, `(${b.row},${b.col}) is off the map`);
    const here = level.rows[a.row][a.col];
    const there = level.rows[b.row][b.col];
    assert.notEqual(there, '#', `(${b.row},${b.col}) is a wall`);
    if (here in GATE_DELTAS) assert.deepEqual(delta, GATE_DELTAS[here], 'left a gate the wrong way');
    if (there in GATE_DELTAS) assert.deepEqual(delta, GATE_DELTAS[there], 'entered a gate the wrong way');
  }
  const visited = new Set(path.map(p => `${p.row},${p.col}`));
  for (const gem of level.gems) assert.ok(visited.has(`${gem.row},${gem.col}`), `gem at (${gem.row},${gem.col}) was never collected`);
}

describe('collectAllGems', () => {
  test('level without gems matches plain solve', () => {
    const level = Level.parse(TUTORIAL);
    const run = collectAllGems(level);
    assert.ok(run);
    assert.equal(run.moves, solve(level)!.moves);
    assertValidRun(level, run);
  });

  test('single gem detour', () => {
    const level = Level.parse(TOWER);
    const run = collectAllGems(level)!;
    assert.equal(run.moves, 13);
    assertValidRun(level, run);
  });

  test('order matters', () => {
    const level = Level.parse(CORRIDOR);
    const run = collectAllGems(level)!;
    assert.equal(run.moves, 16, 'collect the far gem first');
    assertValidRun(level, run);
  });

  test('legs are directional', () => {
    const level = Level.parse(ONE_WAY_LOOP);
    const run = collectAllGems(level);
    assert.ok(run);
    assert.equal(run.moves, 14);
    assertValidRun(level, run);
  });

  test('treasury three gems', () => {
    const level = Level.parse(TREASURY);
    const run = collectAllGems(level)!;
    assert.equal(run.moves, 28);
    assertValidRun(level, run);
  });

  test('unreachable gem means no run', () => {
    assert.equal(collectAllGems(Level.parse(SEALED_GEM)), null);
  });

  test('unreachable exit means no run', () => {
    assert.equal(collectAllGems(Level.parse(SEALED_EXIT)), null);
  });
});
