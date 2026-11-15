// The ocean grid: coordinates, bounds and the A1-style labels used in logs.
//
// Rows are lettered from the top (A, B, C, ...) and columns are numbered from 1,
// so the corners of the standard 10x10 board are A1, A10, J1 and J10.
// Internally everything is zero-based: coord(0, 0) is A1 and coord(1, 6) is B7.
// Coordinates are plain {row, col} objects; key(c) turns one into a string so
// it can be used in Sets and Maps.

const MIN_SIZE = 4, MAX_SIZE = 26; // one letter per row
const LABEL = /^\s*([A-Za-z])\s*(\d{1,2})\s*$/;

/** Thrown when a shot or a lookup falls outside the ocean. */
class OffBoardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OffBoardError';
  }
}

function coord(row, col) {
  return { row, col };
}

/** Stable string key, e.g. '1,6'. */
function key(c) {
  return `${c.row},${c.col}`;
}

/** coord(1, 6) -> 'B7'. */
function label(c) {
  if (c.row < 0 || c.col < 0) return `(${c.row}, ${c.col})`;
  return String.fromCharCode(65 + c.row) + (c.col + 1);
}

/** 'B7' -> {row: 1, col: 6}. Case and surrounding spaces are ignored. */
function parseLabel(text) {
  const match = LABEL.exec(text);
  if (!match) throw new Error(`not a board label: '${text}'`);
  return coord(match[1].toUpperCase().charCodeAt(0) - 65, Number(match[2]) - 1);
}

/** Accept a {row, col} object, a [row, col] pair or a label such as 'B7'. */
function toCoord(value) {
  if (typeof value === 'string') return parseLabel(value);
  if (Array.isArray(value)) return coord(value[0], value[1]);
  return coord(value.row, value.col);
}

/** A square board of size x size cells. */
class Ocean {
  constructor(size = 10) {
    if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
      throw new RangeError(`board size must be between ${MIN_SIZE} and ${MAX_SIZE}, got ${size}`);
    }
    this.size = size;
  }

  inBounds(c) {
    return c.row >= 0 && c.row < this.size && c.col >= 0 && c.col < this.size;
  }

  /** Normalise value to a coord, throwing OffBoardError if it is not on this board. */
  require(value) {
    const c = toCoord(value);
    if (!this.inBounds(c)) throw new OffBoardError(`${label(c)} is off the ${this.size}x${this.size} board`);
    return c;
  }

  /** Every cell, row by row from A1. */
  cells() {
    const all = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) all.push(coord(row, col));
    }
    return all;
  }

  /** The on-board cells directly north, south, west and east of c. */
  neighbours(c) {
    const around = [coord(c.row - 1, c.col), coord(c.row + 1, c.col), coord(c.row, c.col - 1), coord(c.row, c.col + 1)];
    return around.filter(n => this.inBounds(n));
  }

  /** Draw the board as text, calling mark(c) for each cell's character. */
  render(mark) {
    let header = '   ';
    for (let col = 0; col < this.size; col++) header += String(col + 1).padStart(3);
    const lines = [header];
    for (let row = 0; row < this.size; row++) {
      let line = ` ${String.fromCharCode(65 + row)} `;
      for (let col = 0; col < this.size; col++) line += mark(coord(row, col)).padStart(3);
      lines.push(line);
    }
    return lines.join('\n');
  }
}

module.exports = { MIN_SIZE, MAX_SIZE, OffBoardError, Ocean, coord, key, label, parseLabel, toCoord };
