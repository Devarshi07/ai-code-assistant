const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Level, LevelError } = require('../src/level');
const { shortestPath, solve } = require('../src/solver');
const { toMoves } = require('../src/render');
const { CANYON, SPIRE, TUTORIAL } = require('../src/levels');

const GATED_SQUARE = `
#######
#S..>E#
#.###.#
#.....#
#.###.#
#.....#
#######
`;

const WALLED_OFF = `
#####
#S#E#
#.#.#
#.#.#
#####
`;

const GATE_DELTAS = { '>': [0, 1], '<': [0, -1], '^': [-1, 0], v: [1, 0] };

/** Every step must stay on the map, avoid walls and respect gates. */
function assertRoute(level, path) {
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const delta = [b.row - a.row, b.col - a.col];
    assert.equal(Math.abs(delta[0]) + Math.abs(delta[1]), 1, `(${a.row},${a.col}) -> (${b.row},${b.col}) is not a single step`);
    assert.ok(b.row >= 0 && b.row < level.height && b.col >= 0 && b.col < level.width, `(${b.row},${b.col}) is off the map`);
    const here = level.rows[a.row][a.col];
    const there = level.rows[b.row][b.col];
    assert.notEqual(there, '#', `(${b.row},${b.col}) is a wall`);
    if (here in GATE_DELTAS) assert.deepEqual(delta, GATE_DELTAS[here], `left gate ${here} the wrong way`);
    if (there in GATE_DELTAS) assert.deepEqual(delta, GATE_DELTAS[there], `entered gate ${there} the wrong way`);
  }
}

describe('solver', () => {
  test('square level shortest route', () => {
    const run = solve(Level.parse(GATED_SQUARE));
    assert.ok(run);
    assert.equal(run.moves, 4);
    assert.equal(toMoves(run.path), 'EEEE');
  });

  test('gates only open one way', () => {
    const level = Level.parse(GATED_SQUARE);
    const back = shortestPath(level, level.exit, level.start);
    assert.equal(back.length - 1, 8, 'the way back must go around the gate');
    assertRoute(level, back);
  });

  test('unreachable exit returns null', () => {
    assert.equal(solve(Level.parse(WALLED_OFF)), null);
  });

  test('wide level is solvable', () => {
    const level = Level.parse(TUTORIAL, 'tutorial');
    const run = solve(level);
    assert.ok(run, 'the tutorial level has a route to the exit');
    assert.equal(run.moves, 12);
    assertRoute(level, run.path);
  });

  test('wide canyon route', () => {
    const level = Level.parse(CANYON, 'canyon');
    const run = solve(level);
    assert.ok(run, 'the canyon level has a route to the exit');
    assert.equal(run.moves, 20);
    assertRoute(level, run.path);
  });

  test('tall level stays on the map', () => {
    const level = Level.parse(SPIRE, 'spire');
    const run = solve(level);
    assert.ok(run);
    assertRoute(level, run.path);
    assert.equal(run.moves, 22);
  });
});

describe('level', () => {
  test('parse reads dimensions and markers', () => {
    const level = Level.parse(TUTORIAL);
    assert.deepEqual([level.width, level.height], [9, 5]);
    assert.deepEqual(level.start, { row: 1, col: 1 });
    assert.deepEqual(level.exit, { row: 3, col: 7 });
  });

  test('ragged rows are rejected', () => {
    assert.throws(() => Level.parse('#####\n#S.E#\n###'), LevelError);
  });

  test('exactly one start required', () => {
    assert.throws(() => Level.parse('######\n#SS.E#\n######'), LevelError);
  });
});
