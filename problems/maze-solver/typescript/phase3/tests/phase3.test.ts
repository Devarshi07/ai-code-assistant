import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../src/level.ts';
import { collectAllGems } from '../src/solver.ts';
import type { Run } from '../src/solver.ts';
import { generate } from './generator.ts';

const VAULT = `
###############
#S..#...$...>.#
#.#.#.#####.#.#
#.#$..#...#.#.#
#.#####.#.#.#.#
#...$...#..$#E#
#####v#######.#
#.....$.......#
###############
`;

const GATE_DELTAS: Record<string, number[]> = { '>': [0, 1], '<': [0, -1], '^': [-1, 0], v: [1, 0] };

function assertValidRun(level: Level, run: Run): void {
  const path = run.path;
  assert.equal(run.moves, path.length - 1);
  assert.deepEqual(path[0], level.start);
  assert.deepEqual(path[path.length - 1], level.exit);
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

describe('scale', () => {
  test('vault with gates and five gems', () => {
    const level = Level.parse(VAULT);
    const run = collectAllGems(level)!;
    assert.equal(run.moves, 42);
    assertValidRun(level, run);
  });

  test('generated level with eight gems', () => {
    const level = Level.parse(generate(21, 31, 8));
    const run = collectAllGems(level)!;
    assert.equal(run.moves, 121);
    assertValidRun(level, run);
  });

  test('eleven gems on a large level is fast', () => {
    const level = Level.parse(generate(7, 61, 11));
    const start = performance.now();
    const run = collectAllGems(level);
    const elapsed = performance.now() - start;
    assert.ok(run);
    assert.equal(run.moves, 450);
    assertValidRun(level, run);
    assert.ok(elapsed < 400, `took ${elapsed.toFixed(0)}ms; an 11-gem level must solve in under 400ms`);
  });
});
