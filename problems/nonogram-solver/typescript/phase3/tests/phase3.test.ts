import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Puzzle } from '../src/model.ts';
import type { Grid } from '../src/model.ts';
import { puzzleFromPicture } from '../src/clues.ts';
import { loadPuzzle } from '../src/puzzleFile.ts';
import { solve } from '../src/solver.ts';
import { randomPicture } from './generator.ts';

const samplePath = (name: string): URL => new URL(`../samples/${name}`, import.meta.url);
const LIMIT_MS = 250; // per large puzzle

/** Independent run-length check, so these tests don't trust the verifier. */
function runs(cells: number[]): number[] {
  const out: number[] = [];
  let length = 0;
  for (const cell of [...cells, 0]) {
    if (cell === 1) length++;
    else if (length) { out.push(length); length = 0; }
  }
  return out;
}

function assertSatisfies(puzzle: Puzzle, grid: Grid | null): void {
  assert.ok(grid, 'expected a solution');
  assert.equal(grid.length, puzzle.height, 'wrong number of rows');
  grid.forEach((row, r) => {
    assert.equal(row.length, puzzle.width, `row ${r} has the wrong length`);
    assert.ok(row.every(cell => cell === 0 || cell === 1), `row ${r} has cells that are not FILLED/EMPTY`);
    assert.deepEqual(runs(row), puzzle.rowClues[r], `row ${r} does not match its clue`);
  });
  for (let c = 0; c < puzzle.width; c++) {
    assert.deepEqual(runs(grid.map(row => row[c])), puzzle.colClues[c], `column ${c} does not match its clue`);
  }
}

function timedSolve(puzzle: Puzzle): [Grid | null, number] {
  const started = performance.now();
  const grid = solve(puzzle);
  return [grid, performance.now() - started];
}

describe('correctness', () => {
  test('contributor samples still solve', () => {
    for (const name of ['sailboat.non', 'starfield.non']) {
      const puzzle = loadPuzzle(samplePath(name));
      assertSatisfies(puzzle, solve(puzzle));
    }
  });

  test('puzzle where line logic stalls', () => {
    // Row-and-column deduction alone leaves most of this board unknown.
    const picture = randomPicture(66, 20, 20, 0.55);
    const puzzle = puzzleFromPicture(picture);
    const grid = solve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, picture);
  });

  test('contradiction found deep in the search', () => {
    // Two row clues swapped by a contributor: the totals still agree, but no grid fits.
    const puzzle = puzzleFromPicture(randomPicture(66, 20, 20, 0.55));
    const rows = puzzle.rowClues.map(clue => [...clue]);
    [rows[6], rows[7]] = [rows[7], rows[6]];
    assert.equal(solve(new Puzzle(rows, puzzle.colClues)), null);
  });

  test('ambiguous puzzle returns a valid grid', () => {
    const puzzle = new Puzzle([[1, 1], [1, 1], [1, 1], [1, 1]], [[2], [2], [2], [2]]);
    assertSatisfies(puzzle, solve(puzzle));
  });
});

describe('scale', () => {
  test('25x25 community puzzle is fast', () => {
    const picture = randomPicture(11, 25, 25, 0.58);
    const puzzle = puzzleFromPicture(picture);
    const [grid, elapsed] = timedSolve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, picture);
    assert.ok(elapsed < LIMIT_MS, `took ${elapsed.toFixed(0)}ms; a 25x25 puzzle must solve in under ${LIMIT_MS}ms`);
  });

  test('30x30 community puzzle is fast', () => {
    const picture = randomPicture(53, 30, 30, 0.6);
    const puzzle = puzzleFromPicture(picture);
    const [grid, elapsed] = timedSolve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, picture);
    assert.ok(elapsed < LIMIT_MS, `took ${elapsed.toFixed(0)}ms; a 30x30 puzzle must solve in under ${LIMIT_MS}ms`);
  });
});
