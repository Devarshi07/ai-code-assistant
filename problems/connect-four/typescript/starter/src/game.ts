// Game flow: turns, results and replaying the move logs the app stores.
import { Board, BoardError, NAMES } from './board.ts';
import type { Player } from './board.ts';
import { findWinner, winningLine } from './rules.ts';
import type { Cell } from './rules.ts';

export const DRAW = 'Draw';

/** Raised for moves the game does not allow, such as playing after a win. */
export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}

/** One game of Connect Four: a board plus the result so far. */
export class Game {
  board: Board;
  winner: Player | null;
  winningCells: Cell[] | null;

  constructor(board: Board = new Board()) {
    this.board = board;
    const found = findWinner(board);
    this.winner = found ? found.player : null;
    this.winningCells = found ? found.cells : null;
  }

  /** Replay a stored move log, e.g. "4453". Fails if a move is illegal. */
  static fromMoves(moves: string, columns = 7, rows = 6): Game {
    const game = new Game(new Board(columns, rows));
    [...moves.replace(/ /g, '')].forEach((symbol, index) => {
      if (!/^\d$/.test(symbol)) throw new GameError(`move ${index + 1}: '${symbol}' is not a column number`);
      try {
        game.play(Number(symbol) - 1);
      } catch (error) {
        if (error instanceof BoardError || error instanceof GameError) {
          throw new GameError(`move ${index + 1} (column ${symbol}): ${error.message}`);
        }
        throw error;
      }
    });
    return game;
  }

  /** Load a saved position, e.g. from a puzzle file or a bug report. */
  static fromGrid(text: string): Game {
    return new Game(Board.fromGrid(text));
  }

  get isOver(): boolean {
    return this.winner !== null || this.board.isFull();
  }

  /** The player to move, or null once the game is over. */
  get toMove(): Player | null {
    return this.isOver ? null : this.board.toMove;
  }

  get status(): string {
    if (this.winner !== null) return `${NAMES[this.winner]} wins`;
    if (this.board.isFull()) return DRAW;
    return `${NAMES[this.board.toMove]} to move`;
  }

  legalMoves(): number[] {
    return this.isOver ? [] : this.board.legalMoves();
  }

  /** Drop the current player's disc into col (0-based). Returns the row. */
  play(col: number): number {
    if (this.isOver) throw new GameError(`the game is over: ${this.status}`);
    const player = this.board.toMove;
    const row = this.board.drop(col);
    const cells = winningLine(this.board, col, row);
    if (cells) {
      this.winner = player;
      this.winningCells = cells;
    }
    return row;
  }

  /** Take back the last move, reopening the game if it had just been won. */
  undo(): number {
    const col = this.board.undo();
    this.winner = null;
    this.winningCells = null;
    return col;
  }

  toString(): string {
    return `Game('${this.board.toMoves()}', ${this.status})`;
  }
}
