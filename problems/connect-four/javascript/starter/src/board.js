// Board model for Connect Four.
//
// The board is stored column by column with row 0 at the bottom, because discs
// fall: each column is a stack. In code, columns are numbered from 0 (leftmost).
// Players see them numbered from 1, and move strings use the players' numbers:
// "4453" means the 4th, 4th, 5th and 3rd columns from the left.
//
// The board knows nothing about winning; see rules.js for that. It will happily
// keep accepting discs after someone has connected four, which is what the
// search code wants when it plays moves out and takes them back.

const EMPTY = '.';
const RED = 'R'; // Red always moves first
const YELLOW = 'Y';
const NAMES = { [RED]: 'Red', [YELLOW]: 'Yellow' };

/** The opponent of player. */
function other(player) {
  return player === RED ? YELLOW : RED;
}

class BoardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BoardError';
  }
}

class Board {
  constructor(columns = 7, rows = 6) {
    if (columns < 4 || rows < 4) throw new BoardError(`a ${columns}x${rows} board is too small for four in a row`);
    this.columns = columns;
    this.rows = rows;
    this._cells = Array.from({ length: columns }, () => new Array(rows).fill(EMPTY));
    this._heights = new Array(columns).fill(0);
    this._history = [];
    this._discs = 0;
  }

  // -- construction and serialisation ----------------------------------------

  /** Replay a move string such as "4453" (1-based columns, Red first). */
  static fromMoves(moves, columns = 7, rows = 6) {
    const board = new Board(columns, rows);
    [...moves.replace(/ /g, '')].forEach((symbol, index) => {
      const col = Number(symbol);
      if (!/^\d$/.test(symbol) || col < 1 || col > columns) {
        throw new BoardError(`move ${index + 1}: '${symbol}' is not a column from 1 to ${columns}`);
      }
      board.drop(col - 1);
    });
    return board;
  }

  /**
   * Parse a position drawn top row first, as in puzzle files and bug reports.
   *
   * Each non-blank line is one row; spaces and '|' borders are ignored.
   * The side to move follows from the disc counts (Red moves first).
   * Loaded boards have no history, so undo() stops at the loaded position.
   */
  static fromGrid(text) {
    const grid = text.split('\n')
      .map(line => line.replace(/ /g, '').replace(/^\|+|\|+$/g, ''))
      .filter(Boolean);
    if (!grid.length) throw new BoardError('grid is empty');
    const width = grid[0].length;
    if (grid.some(line => line.length !== width)) throw new BoardError('every row of the grid must have the same width');
    const board = new Board(width, grid.length);
    let reds = 0;
    for (let col = 0; col < board.columns; col++) {
      for (let row = 0; row < board.rows; row++) {
        const symbol = grid[board.rows - 1 - row][col];
        if (symbol !== EMPTY && symbol !== RED && symbol !== YELLOW) throw new BoardError(`unknown symbol '${symbol}' in the grid`);
        if (symbol === EMPTY) continue;
        if (board._heights[col] !== row) throw new BoardError(`column ${col + 1} has a floating disc`);
        board._cells[col][row] = symbol;
        board._heights[col] += 1;
        board._discs += 1;
        if (symbol === RED) reds += 1;
      }
    }
    const yellows = board._discs - reds;
    if (reds - yellows !== 0 && reds - yellows !== 1) {
      throw new BoardError(`impossible position: ${reds} red discs and ${yellows} yellow`);
    }
    return board;
  }

  /** The moves played on this board object, as a 1-based move string. */
  toMoves() {
    return this._history.map(col => String(col + 1)).join('');
  }

  /** The position as text, top row first: the format fromGrid reads. */
  toGrid() {
    const lines = [];
    for (let row = this.rows - 1; row >= 0; row--) {
      let line = '';
      for (let col = 0; col < this.columns; col++) line += this._cells[col][row];
      lines.push(line);
    }
    return lines.join('\n');
  }

  copy() {
    const clone = new Board(this.columns, this.rows);
    clone._cells = this._cells.map(column => [...column]);
    clone._heights = [...this._heights];
    clone._history = [...this._history];
    clone._discs = this._discs;
    return clone;
  }

  // -- queries ---------------------------------------------------------------

  /** The player whose disc goes in next. */
  get toMove() {
    return this._discs % 2 === 0 ? RED : YELLOW;
  }

  /** Discs on the board. */
  get moveCount() {
    return this._discs;
  }

  inBounds(col, row) {
    return col >= 0 && col < this.columns && row >= 0 && row < this.rows;
  }

  cell(col, row) {
    return this._cells[col][row];
  }

  /** Number of discs in a column; also the row the next disc lands on. */
  height(col) {
    return this._heights[col];
  }

  canPlay(col) {
    return col >= 0 && col < this.columns && this._heights[col] < this.rows;
  }

  legalMoves() {
    const moves = [];
    for (let col = 0; col < this.columns; col++) if (this._heights[col] < this.rows) moves.push(col);
    return moves;
  }

  isFull() {
    return this._discs === this.columns * this.rows;
  }

  // -- changes ---------------------------------------------------------------

  /** Drop the side to move's disc into col and return the row it lands on. */
  drop(col) {
    if (!Number.isInteger(col) || col < 0 || col >= this.columns) throw new BoardError(`there is no column ${col}`);
    const row = this._heights[col];
    if (row >= this.rows) throw new BoardError(`column ${col + 1} is full`);
    this._cells[col][row] = this.toMove;
    this._heights[col] = row + 1;
    this._discs += 1;
    this._history.push(col);
    return row;
  }

  /** Take back the most recent drop and return its column. */
  undo() {
    if (!this._history.length) throw new BoardError('there is no move to undo');
    const col = this._history.pop();
    this._heights[col] -= 1;
    this._cells[col][this._heights[col]] = EMPTY;
    this._discs -= 1;
    return col;
  }

  toString() {
    return `Board(${this.columns}x${this.rows}, ${this._discs} discs, ${this.toMove} to move)`;
  }
}

module.exports = { Board, BoardError, EMPTY, RED, YELLOW, NAMES, other };
