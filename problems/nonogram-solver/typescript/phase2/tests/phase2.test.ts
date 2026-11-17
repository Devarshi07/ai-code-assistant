import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Puzzle, parseGrid } from '../src/model.ts';
import type { Grid } from '../src/model.ts';
import { puzzleFromPicture } from '../src/clues.ts';
import { loadPuzzle } from '../src/puzzleFile.ts';
import { solve } from '../src/solver.ts';

const samplePath = (name: string): URL => new URL(`../samples/${name}`, import.meta.url);
const sample = (name: string): string => readFileSync(samplePath(name), 'utf8');

const SAILBOAT = `
....#.....
....##....
....###...
....####..
....#####.
....#.....
##########
.########.
..######..
.#.#.#.#.#
`;

// Line-by-line logic stalls on this one almost immediately: a solver has to
// commit to a guess and back out of the wrong ones.
const STARFIELD = `
#.....#.#.
#..#..##..
...#.#.###
#..#.#.##.
...#..#.##
....####.#
#..#..#...
.#.#...#.#
.#..###..#
###.#....#
`;

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

describe('solve', () => {
  test('heart', () => {
    const puzzle = new Puzzle([[1, 1], [5], [5], [3], [1]], [[2], [4], [4], [4], [2]], { title: 'Heart' });
    const grid = solve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, parseGrid(sample('heart.pic')));
  });

  test('sailboat answer key', () => {
    const puzzle = loadPuzzle(samplePath('sailboat.non'));
    const grid = solve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, parseGrid(SAILBOAT));
  });

  test('starfield needs more than line logic', () => {
    const puzzle = loadPuzzle(samplePath('starfield.non'));
    const grid = solve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, parseGrid(STARFIELD));
  });

  test('published drawings solve back to the drawing', () => {
    for (const name of ['mug.pic', 'lighthouse.pic']) {
      const picture = parseGrid(sample(name));
      const puzzle = puzzleFromPicture(picture);
      const grid = solve(puzzle);
      assertSatisfies(puzzle, grid);
      assert.deepEqual(grid, picture, `${name} should solve back to the drawing`);
    }
  });

  test('single cell puzzles', () => {
    assert.deepEqual(solve(new Puzzle([[1]], [[1]])), [[1]]);
    assert.deepEqual(solve(new Puzzle([[]], [[]])), [[0]]);
  });

  test('full and empty lines', () => {
    const puzzle = new Puzzle([[4], [], [1, 1], [4]], [[1, 2], [1, 1], [1, 1], [1, 2]]);
    const grid = solve(puzzle);
    assertSatisfies(puzzle, grid);
    assert.deepEqual(grid, [[1, 1, 1, 1], [0, 0, 0, 0], [1, 0, 0, 1], [1, 1, 1, 1]]);
  });

  test('ambiguous puzzle returns a valid grid', () => {
    // Two diagonals both fit; either answer is acceptable.
    const puzzle = new Puzzle([[1], [1]], [[1], [1]]);
    assertSatisfies(puzzle, solve(puzzle));
  });

  test('contradictory clues have no solution', () => {
    // Totals agree, but each outer column needs two stacked cells while row 2 is empty.
    assert.equal(solve(new Puzzle([[1, 1], [], [1, 1]], [[2], [], [2]])), null);
  });

  test('solving does not change the puzzle', () => {
    const puzzle = loadPuzzle(samplePath('sailboat.non'));
    const before = JSON.stringify([puzzle.rowClues, puzzle.colClues]);
    solve(puzzle);
    assert.equal(JSON.stringify([puzzle.rowClues, puzzle.colClues]), before);
  });
});
