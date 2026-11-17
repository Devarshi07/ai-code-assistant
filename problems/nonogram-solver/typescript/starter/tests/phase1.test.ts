import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Puzzle, PuzzleError, parseGrid } from '../src/model.ts';
import { lineClue, puzzleFromPicture } from '../src/clues.ts';
import { parsePuzzle, formatPuzzle, loadPuzzle } from '../src/puzzleFile.ts';
import { findMismatches, isSolution } from '../src/verify.ts';
import { render } from '../src/render.ts';

const samplePath = (name: string): URL => new URL(`../samples/${name}`, import.meta.url);
const sample = (name: string): string => readFileSync(samplePath(name), 'utf8');

// A correct answer to samples/sailboat.non, checked by hand against every clue.
const SAILBOAT_ANSWER = `
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

describe('line clue', () => {
  test('blocks separated by gaps', () => {
    assert.deepEqual(lineClue([0, 1, 1, 0, 1, 0, 0]), [2, 1]);
  });

  test('empty line has empty clue', () => {
    assert.deepEqual(lineClue([0, 0, 0, 0]), []);
  });

  test('long and short blocks', () => {
    assert.deepEqual(lineClue([0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0]), [5, 1, 2]);
  });
});

describe('publishing', () => {
  test('mug drawing clues', () => {
    const puzzle = puzzleFromPicture(sample('mug.pic'), { title: 'Mug' });
    assert.deepEqual([puzzle.width, puzzle.height], [10, 10]);
    assert.deepEqual(puzzle.rowClues, [[1, 1], [1, 1], [1, 1], [], [7], [1, 3], [1, 1, 1], [1, 3], [5], []]);
    assert.deepEqual(puzzle.colClues, [[4], [1, 1, 1], [1, 1, 1, 1], [1, 1], [1, 1, 1], [1, 1, 1, 1], [4], [1, 1], [3], []]);
  });

  test('heart drawing publishes', () => {
    const puzzle = puzzleFromPicture(sample('heart.pic'), { title: 'Heart' });
    assert.deepEqual(puzzle.rowClues, [[1, 1], [5], [5], [3], [1]]);
    assert.deepEqual(puzzle.colClues, [[2], [4], [4], [4], [2]]);
  });

  test('lighthouse drawing publishes', () => {
    const puzzle = puzzleFromPicture(sample('lighthouse.pic'), { title: 'Lighthouse' });
    assert.deepEqual([puzzle.width, puzzle.height], [12, 13]);
    assert.deepEqual(puzzle.rowClues, [[2], [4, 3], [1, 2], [4, 3], [2], [4], [1, 1], [4], [1, 1], [4], [6], [1, 8, 1], [12]]);
    assert.deepEqual(puzzle.colClues, [[2], [1], [2], [3], [3, 8], [2, 3, 1, 4], [2, 3, 1, 4], [3, 8], [1, 3], [1, 1, 2], [1, 1, 1], [1, 1, 2]]);
    assert.equal(puzzle.filledCells, 65);
  });
});

describe('verifier', () => {
  test('accepts correct sailboat answer', () => {
    const puzzle = loadPuzzle(samplePath('sailboat.non'));
    const answer = parseGrid(SAILBOAT_ANSWER);
    assert.deepEqual(findMismatches(puzzle, answer).map(String), []);
    assert.equal(isSolution(puzzle, answer), true);
  });

  test('drawing solves its own puzzle', () => {
    const picture = parseGrid(sample('mug.pic'));
    assert.equal(isSolution(puzzleFromPicture(picture), picture), true);
  });

  test('reports exactly the wrong lines', () => {
    const picture = parseGrid(sample('mug.pic'));
    const puzzle = puzzleFromPicture(picture);
    picture[5][3] = 1;
    const problems = findMismatches(puzzle, picture);
    assert.deepEqual(problems.map(p => [p.kind, p.index]), [['row', 5], ['column', 3]]);
    assert.equal(isSolution(puzzle, picture), false);
  });

  test('rejects grid of the wrong shape', () => {
    const puzzle = puzzleFromPicture(sample('mug.pic'));
    assert.equal(isSolution(puzzle, parseGrid(sample('mug.pic')).slice(0, -1)), false);
  });
});

describe('puzzle file', () => {
  test('reads contributor file', () => {
    const puzzle = loadPuzzle(samplePath('sailboat.non'));
    assert.deepEqual([puzzle.title, puzzle.author], ['Sailboat', 'R. Okafor']);
    assert.deepEqual([puzzle.width, puzzle.height], [10, 10]);
    assert.deepEqual(puzzle.rowClues[6], [10]);
    assert.deepEqual(puzzle.rowClues[9], [1, 1, 1, 1, 1]);
    assert.deepEqual(puzzle.colClues[5], [4, 4]);
  });

  test('zero marks an empty line', () => {
    const puzzle = parsePuzzle('rows: 3 | 0 | 1 1\ncols: 2 | 1 | 2');
    assert.deepEqual(puzzle.rowClues, [[3], [], [1, 1]]);
  });

  test('format round trip', () => {
    const original = parsePuzzle('# draft\ntitle: Steps\nrows: 1 | 2 | 0\ncols: 2 | 1 | 0');
    const again = parsePuzzle(formatPuzzle(original));
    assert.deepEqual([again.title, again.rowClues, again.colClues], ['Steps', [[1], [2], []], [[2], [1], []]]);
  });

  test('clue totals must agree', () => {
    assert.throws(() => parsePuzzle('rows: 2 | 1\ncols: 1 | 1'), PuzzleError);
  });

  test('clue longer than its line is rejected', () => {
    assert.throws(() => new Puzzle([[2, 1]], [[1], [1], [1]]), PuzzleError);
  });
});

describe('render', () => {
  test('board with clues', () => {
    const puzzle = new Puzzle([[1, 1], [1], [1, 1]], [[1, 1], [], [3]], { title: 'Tiny' });
    const grid = [[1, 0, 1], [0, 0, 1], [1, 0, 1]];
    assert.equal(render(puzzle, grid), [
      '    1',
      '    1 0 3',
      '1 1 # . #',
      '  1 . . #',
      '1 1 # . #',
    ].join('\n'));
  });

  test('unsolved board shows question marks', () => {
    const puzzle = new Puzzle([[1], []], [[], [1]]);
    assert.deepEqual(render(puzzle).split('\n').slice(1), ['1 ? ?', '0 ? ?']);
  });
});
