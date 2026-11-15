// Core data model: puzzles, clues and grids.
//
// A *grid* is an array of rows, each an array of cells, where every cell is
// FILLED or EMPTY. A *clue* lists the lengths of the filled blocks in one
// line, in order (left to right for rows, top to bottom for columns). A line
// with no filled cells has the empty clue [], written `0` in puzzle files.

const FILLED = 1;
const EMPTY = 0;

// Characters used in picture files and previews.
const PICTURE_SYMBOLS = { '#': FILLED, '.': EMPTY };
const CELL_CHARS = { [FILLED]: '#', [EMPTY]: '.' };

class PuzzleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PuzzleError';
  }
}

const sum = numbers => numbers.reduce((total, n) => total + n, 0);

/** Fewest cells that can hold clue: every block plus one gap between blocks. */
function minLength(clue) {
  return sum(clue) + Math.max(clue.length - 1, 0);
}

/** Clue as designers write it: '3 1 2', or '0' for an empty line. */
function formatClue(clue) {
  return clue.length ? clue.join(' ') : '0';
}

/** Row and column clues for one nonogram, validated on construction. */
class Puzzle {
  constructor(rowClues, colClues, { title = 'Untitled', author = null } = {}) {
    this.title = title;
    this.author = author;
    this.rowClues = rowClues.map(clue => [...clue]);
    this.colClues = colClues.map(clue => [...clue]);
    this.height = this.rowClues.length;
    this.width = this.colClues.length;
    this.validate();
  }

  validate() {
    if (!this.width || !this.height) throw new PuzzleError(`${this.title}: a puzzle needs at least one row and one column`);
    const lines = [['row', this.rowClues, this.width], ['column', this.colClues, this.height]];
    for (const [kind, clues, length] of lines) {
      clues.forEach((clue, i) => {
        if (clue.some(n => !Number.isInteger(n) || n <= 0)) {
          throw new PuzzleError(`${this.title}: ${kind} ${i + 1} has a block that is not a positive whole number`);
        }
        if (minLength(clue) > length) {
          throw new PuzzleError(`${this.title}: ${kind} ${i + 1} clue ${formatClue(clue)} needs ${minLength(clue)} cells but the ${kind} has ${length}`);
        }
      });
    }
    const byRows = sum(this.rowClues.map(sum));
    const byCols = sum(this.colClues.map(sum));
    if (byRows !== byCols) throw new PuzzleError(`${this.title}: row clues fill ${byRows} cells but column clues fill ${byCols}`);
  }

  get filledCells() {
    return sum(this.rowClues.map(sum));
  }

  toString() {
    return `Puzzle(${this.title}, ${this.width}x${this.height})`;
  }
}

/** Read a picture drawn with '#' (filled) and '.' (empty), one row per line. */
function parseGrid(text) {
  const rows = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (!rows.length) throw new PuzzleError('picture is empty');
  const width = rows[0].length;
  return rows.map((line, i) => {
    if (line.length !== width) throw new PuzzleError(`picture row ${i + 1} has ${line.length} cells, expected ${width}`);
    const unknown = [...new Set(line)].filter(ch => !(ch in PICTURE_SYMBOLS));
    if (unknown.length) throw new PuzzleError(`picture row ${i + 1} has unknown symbols '${unknown.sort().join('')}'`);
    return [...line].map(ch => PICTURE_SYMBOLS[ch]);
  });
}

/** Inverse of parseGrid. */
function formatGrid(grid) {
  return grid.map(row => row.map(cell => CELL_CHARS[cell]).join('')).join('\n');
}

/** The grid's columns, top to bottom, as arrays of cells. */
function columns(grid) {
  if (!grid.length) return [];
  return grid[0].map((_, c) => grid.map(row => row[c]));
}

module.exports = { FILLED, EMPTY, CELL_CHARS, PuzzleError, Puzzle, minLength, formatClue, parseGrid, formatGrid, columns };
