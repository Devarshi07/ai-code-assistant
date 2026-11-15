// Solver used by the import pipeline to build answer keys for contributor puzzles.
const { FILLED, EMPTY } = require('./model');

/** Every way to lay out clue's blocks in a line of `length` cells. */
function linePlacements(clue, length) {
  if (!clue.length) return [new Array(length).fill(EMPTY)];
  const [first, ...rest] = clue;
  const tailMin = rest.reduce((total, n) => total + n, 0) + rest.length; // later blocks plus the gap before each
  const placements = [];
  for (let start = 0; start + first + tailMin <= length; start++) {
    const head = [...new Array(start).fill(EMPTY), ...new Array(first).fill(FILLED)];
    if (rest.length) {
      for (const tail of linePlacements(rest, length - head.length - 1)) placements.push([...head, EMPTY, ...tail]);
    } else {
      placements.push([...head, ...new Array(length - head.length).fill(EMPTY)]);
    }
  }
  return placements;
}

/** needed[b]: cells required to fit blocks b.. of clue, with gaps between them. */
function roomNeeded(clue) {
  const needed = new Array(clue.length + 1).fill(0);
  for (let b = clue.length - 1; b >= 0; b--) needed[b] = clue[b] + needed[b + 1] + (b + 1 < clue.length ? 1 : 0);
  return needed;
}

/**
 * Return a grid that satisfies every row and column clue of puzzle.
 *
 * The grid is an array of puzzle.height rows, each an array of puzzle.width
 * cells (FILLED or EMPTY). Returns null when no grid fits the clues.
 *
 * Row-by-row backtracking: try every placement of each row's clue and keep a
 * running state per column (blocks finished, length of the open block) so a
 * row is rejected as soon as some column prefix can no longer match.
 */
function solve(puzzle) {
  const { width, height, colClues } = puzzle;
  const options = puzzle.rowClues.map(clue => linePlacements(clue, width));
  const needed = colClues.map(roomNeeded);
  const grid = [];

  // Column states after adding row, or null if a column is now impossible.
  function advance(blocks, runs, row, rowsLeft) {
    blocks = blocks.slice();
    runs = runs.slice();
    for (let c = 0; c < width; c++) {
      const clue = colClues[c];
      let b = blocks[c];
      let run = runs[c];
      if (row[c] === FILLED) {
        run++;
        if (b >= clue.length || run > clue[b]) return null;
      } else if (run) {
        if (run !== clue[b]) return null;
        b++;
        run = 0;
      }
      if (needed[c][b] - run > rowsLeft) return null; // not enough rows left for this column
      blocks[c] = b;
      runs[c] = run;
    }
    return [blocks, runs];
  }

  function place(r, blocks, runs) {
    if (r === height) return true;
    for (const row of options[r]) {
      const state = advance(blocks, runs, row, height - r - 1);
      if (!state) continue;
      grid.push(row);
      if (place(r + 1, state[0], state[1])) return true;
      grid.pop();
    }
    return false;
  }

  return place(0, new Array(width).fill(0), new Array(width).fill(0)) ? grid.map(row => row.slice()) : null;
}

module.exports = { solve, linePlacements };
