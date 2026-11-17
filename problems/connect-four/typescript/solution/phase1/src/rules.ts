// Win detection.
//
// A player wins by connecting four or more of their discs in a straight line:
// across, up and down, or along either diagonal. Lines are found by walking
// outwards from a single disc, which is all the game needs after each drop.
import { EMPTY } from './board.ts';
import type { Board, Player } from './board.ts';

export type Axis = readonly [number, number];
export type Cell = [col: number, row: number];

// Every line a disc can belong to, as a [column step, row step] pair.
// runLength walks each axis in both directions from the disc.
export const AXES: Axis[] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal
  [1, -1], // other diagonal
];

/**
 * Discs of player in an unbroken line through (col, row) along axis.
 *
 * The cell (col, row) itself is counted as player's whether or not a disc is
 * there yet, so this also answers "what if player dropped here?".
 */
function runLength(board: Board, col: number, row: number, axis: Axis, player: Player): number {
  const [dc, dr] = axis;
  let length = 1;
  for (const sign of [1, -1]) {
    let c = col + sign * dc;
    let r = row + sign * dr;
    while (board.inBounds(c, r) && board.cell(c, r) === player) {
      length += 1;
      c += sign * dc;
      r += sign * dr;
    }
  }
  return length;
}

/** The cells of the unbroken line counted by runLength, as sorted [col, row] pairs. */
function lineCells(board: Board, col: number, row: number, axis: Axis, player: Player): Cell[] {
  const [dc, dr] = axis;
  const cells: Cell[] = [[col, row]];
  for (const sign of [1, -1]) {
    let c = col + sign * dc;
    let r = row + sign * dr;
    while (board.inBounds(c, r) && board.cell(c, r) === player) {
      cells.push([c, r]);
      c += sign * dc;
      r += sign * dr;
    }
  }
  return cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Cells of a four-or-longer line through the disc at (col, row), or null. */
export function winningLine(board: Board, col: number, row: number): Cell[] | null {
  const player = board.cell(col, row);
  if (player === EMPTY) return null;
  for (const axis of AXES) {
    if (runLength(board, col, row, axis, player) >= 4) return lineCells(board, col, row, axis, player);
  }
  return null;
}

/**
 * Would dropping player's disc (default: the side to move) into col connect four?
 * The board is not changed.
 */
export function isWinningDrop(board: Board, col: number, player: Player = board.toMove): boolean {
  if (!board.canPlay(col)) return false;
  const row = board.height(col);
  return AXES.some(axis => runLength(board, col, row, axis, player) >= 4);
}

/** Columns where player (default: the side to move) would connect four right now. */
export function winningColumns(board: Board, player: Player = board.toMove): number[] {
  const columns: number[] = [];
  for (let col = 0; col < board.columns; col++) if (isWinningDrop(board, col, player)) columns.push(col);
  return columns;
}

/**
 * Scan a whole position for a four. Returns { player, cells } or null.
 * Used when a position is loaded from a grid and has no move history.
 */
export function findWinner(board: Board): { player: Player; cells: Cell[] } | null {
  for (let col = 0; col < board.columns; col++) {
    for (let row = 0; row < board.height(col); row++) {
      const cells = winningLine(board, col, row);
      if (cells) return { player: board.cell(col, row) as Player, cells };
    }
  }
  return null;
}
