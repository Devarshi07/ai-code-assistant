// Answer checking: is a player's (or the solver's) grid a solution?
const { lineClue } = require('./clues');
const { FILLED, EMPTY, PuzzleError, columns, formatClue } = require('./model');

const sameClue = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

/**
 * One line whose cells do not produce its clue.
 * kind is 'row' or 'column', index is 0-based, expected is the puzzle's clue
 * and actual is the clue the grid's cells produce.
 */
class Mismatch {
  constructor(kind, index, expected, actual) {
    Object.assign(this, { kind, index, expected, actual });
  }

  toString() {
    return `${this.kind} ${this.index + 1}: clue is ${formatClue(this.expected)}, grid gives ${formatClue(this.actual)}`;
  }
}

/** Throw PuzzleError unless grid is height x width and every cell is FILLED or EMPTY. */
function checkShape(puzzle, grid) {
  if (!Array.isArray(grid) || grid.length !== puzzle.height || grid.some(row => !Array.isArray(row) || row.length !== puzzle.width)) {
    throw new PuzzleError(`${puzzle.title}: grid must be ${puzzle.width}x${puzzle.height}`);
  }
  grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell !== FILLED && cell !== EMPTY) throw new PuzzleError(`${puzzle.title}: cell (${r}, ${c}) is ${cell}, not filled or empty`);
  }));
}

/** Every row and column of grid that disagrees with puzzle's clues. */
function findMismatches(puzzle, grid) {
  checkShape(puzzle, grid);
  const problems = [];
  grid.forEach((row, r) => {
    const actual = lineClue(row);
    if (!sameClue(actual, puzzle.rowClues[r])) problems.push(new Mismatch('row', r, puzzle.rowClues[r], actual));
  });
  columns(grid).forEach((col, c) => {
    const actual = lineClue(col);
    if (!sameClue(actual, puzzle.colClues[c])) problems.push(new Mismatch('column', c, puzzle.colClues[c], actual));
  });
  return problems;
}

/** True when grid has the puzzle's shape and matches every clue. */
function isSolution(puzzle, grid) {
  try {
    return findMismatches(puzzle, grid).length === 0;
  } catch (error) {
    if (error instanceof PuzzleError) return false;
    throw error;
  }
}

module.exports = { Mismatch, checkShape, findMismatches, isSolution };
