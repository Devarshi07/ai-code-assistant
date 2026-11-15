// Solver used by the import pipeline to build answer keys for contributor puzzles.
//
// Constraint propagation with a fallback search:
//
// 1. Line solving. For one row or column, a dynamic program finds every cell
//    that has the same value in *all* placements of the clue that agree with
//    the cells already known: O(length * blocks) per line instead of
//    enumerating placements.
// 2. Propagation. Lines are solved from a work queue; whenever a cell is
//    settled, the crossing line is queued again. This runs to a fixpoint.
// 3. Search. If cells are still unknown at the fixpoint, guess one,
//    propagate, and back out of the guess on contradiction.
const { FILLED, EMPTY } = require('./model');

const UNKNOWN = -1;

/**
 * Settle every forced cell of one line.
 *
 * cells holds FILLED, EMPTY or UNKNOWN. Returns a new array in which each
 * UNKNOWN cell that is the same in every consistent placement is set, or
 * null when no placement of clue agrees with the known cells.
 */
function solveLine(clue, cells) {
  const n = cells.length;
  const k = clue.length;
  const empties = new Array(n + 1).fill(0); // empties[i]: known-empty cells in cells[0, i)
  const fills = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    empties[i + 1] = empties[i] + (cells[i] === EMPTY ? 1 : 0);
    fills[i + 1] = fills[i] + (cells[i] === FILLED ? 1 : 0);
  }

  // fwd[j][i]: cells[0, i) can hold exactly the first j blocks.
  const fwd = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(false));
  for (let i = 0; i <= n && !fills[i]; i++) fwd[0][i] = true;
  for (let j = 1; j <= k; j++) {
    const size = clue[j - 1];
    const row = fwd[j];
    const prev = fwd[j - 1];
    for (let i = size; i <= n; i++) {
      let ok = row[i - 1] && cells[i - 1] !== FILLED; // cell i-1 left empty
      if (!ok && empties[i] === empties[i - size]) { // block j ends at i
        const s = i - size;
        ok = j === 1 ? prev[s] : s >= 1 && cells[s - 1] !== FILLED && prev[s - 1];
      }
      row[i] = ok;
    }
  }
  if (!fwd[k][n]) return null;

  // bwd[j][i]: cells[i, n) can hold exactly blocks j.. (last one included).
  const bwd = Array.from({ length: k + 1 }, () => new Array(n + 2).fill(false));
  for (let i = n; i >= 0 && fills[n] === fills[i]; i--) bwd[k][i] = true;
  for (let j = k - 1; j >= 0; j--) {
    const size = clue[j];
    const row = bwd[j];
    const next = bwd[j + 1];
    for (let i = n - size; i >= 0; i--) {
      let ok = row[i + 1] && cells[i] !== FILLED; // cell i left empty
      if (!ok && empties[i + size] === empties[i]) { // block j starts at i
        const e = i + size;
        ok = j === k - 1 ? next[e] : e < n && cells[e] !== FILLED && next[e + 1];
      }
      row[i] = ok;
    }
  }

  // A block can sit at [s, e) if the prefix fits the earlier blocks and the
  // suffix fits the later ones; mark the covered cells with a difference array.
  const cover = new Array(n + 1).fill(0);
  for (let j = 0; j < k; j++) {
    const size = clue[j];
    const left = fwd[j];
    const right = bwd[j + 1];
    for (let s = 0; s + size <= n; s++) {
      const e = s + size;
      if (empties[e] !== empties[s]) continue;
      if (j === 0 ? !left[s] : s < 1 || cells[s - 1] === FILLED || !left[s - 1]) continue;
      if (j === k - 1 ? !right[e] : e >= n || cells[e] === FILLED || !right[e + 1]) continue;
      cover[s]++;
      cover[e]--;
    }
  }

  const settled = cells.slice();
  let covered = 0;
  for (let i = 0; i < n; i++) {
    covered += cover[i];
    if (cells[i] !== UNKNOWN) continue;
    let canBeEmpty = false;
    for (let j = 0; j <= k && !canBeEmpty; j++) canBeEmpty = fwd[j][i] && bwd[j][i + 1];
    if (covered && !canBeEmpty) settled[i] = FILLED;
    else if (canBeEmpty && !covered) settled[i] = EMPTY;
    else if (!covered) return null;
  }
  return settled;
}

/** Solve lines until nothing changes. Returns false on a contradiction. */
function propagate(puzzle, grid, rows, cols) {
  const { width, height } = puzzle;
  const queue = [];
  const rowQueued = new Array(height).fill(false);
  const colQueued = new Array(width).fill(false);
  for (const r of rows) { rowQueued[r] = true; queue.push([true, r]); }
  for (const c of cols) { colQueued[c] = true; queue.push([false, c]); }
  for (let head = 0; head < queue.length; head++) {
    const [isRow, index] = queue[head];
    if (isRow) {
      rowQueued[index] = false;
      const line = grid[index];
      const settled = solveLine(puzzle.rowClues[index], line);
      if (!settled) return false;
      for (let c = 0; c < width; c++) {
        if (settled[c] === line[c]) continue;
        line[c] = settled[c];
        if (!colQueued[c]) { colQueued[c] = true; queue.push([false, c]); }
      }
    } else {
      colQueued[index] = false;
      const line = grid.map(row => row[index]);
      const settled = solveLine(puzzle.colClues[index], line);
      if (!settled) return false;
      for (let r = 0; r < height; r++) {
        if (settled[r] === line[r]) continue;
        grid[r][index] = settled[r];
        if (!rowQueued[r]) { rowQueued[r] = true; queue.push([true, r]); }
      }
    }
  }
  return true;
}

function search(puzzle, grid, rows, cols) {
  if (!propagate(puzzle, grid, rows, cols)) return null;
  for (let r = 0; r < puzzle.height; r++) {
    for (let c = 0; c < puzzle.width; c++) {
      if (grid[r][c] !== UNKNOWN) continue;
      for (const value of [FILLED, EMPTY]) {
        const trial = grid.map(line => line.slice());
        trial[r][c] = value;
        const found = search(puzzle, trial, [r], [c]);
        if (found) return found;
      }
      return null;
    }
  }
  return grid;
}

/**
 * Return a grid that satisfies every row and column clue of puzzle.
 *
 * The grid is an array of puzzle.height rows, each an array of puzzle.width
 * cells (FILLED or EMPTY). Returns null when no grid fits the clues.
 */
function solve(puzzle) {
  const grid = Array.from({ length: puzzle.height }, () => new Array(puzzle.width).fill(UNKNOWN));
  const indices = n => Array.from({ length: n }, (_, i) => i);
  return search(puzzle, grid, indices(puzzle.height), indices(puzzle.width));
}

module.exports = { solve, solveLine, UNKNOWN };
