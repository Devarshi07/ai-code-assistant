// The computer opponent and the puzzle checker.
//
// chooseMove() powers "Play the computer". solve() checks the daily puzzles
// ("Red to play and win in 5"): it finds how quickly the side to move can force
// a win. Distances are counted in plies. A ply is one disc dropped by either
// player, so a win in 5 plies means three discs from the winner and two from
// the defender, the last of the three completing the four.
import { other } from './board.ts';
import type { Board, Player } from './board.ts';
import { AXES } from './rules.ts';

export const DEFAULT_DEPTH = 4;
export const WIN_SCORE = 1000000; // far above anything evaluate() can return

// Heuristic points for a window of four cells that holds discs of one player
// only, keyed by how many of that player's discs it holds.
const WINDOW_POINTS: Record<number, number> = { 2: 2, 3: 5 };
const CENTRE_POINTS = 3;

/**
 * A forced win found by solve(): move is the 0-based column to play now; plies
 * counts both sides' discs until the four is completed, so 1 means the move
 * wins at once.
 */
export interface ForcedWin {
  move: number;
  plies: number;
}

/** Columns from the centre outwards, left before right: 7 -> [3, 2, 4, 1, 5, 0, 6]. */
export function centreOrder(columns: number): number[] {
  const middle = (columns - 1) / 2;
  return Array.from({ length: columns }, (_, col) => col)
    .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle) || a - b);
}

const windowCache = new Map<string, [number, number][][]>();

/** Every straight line of four cells on a board of this size, as [col, row] lists. */
export function windows(columns: number, rows: number): [number, number][][] {
  const key = `${columns}x${rows}`;
  let found = windowCache.get(key);
  if (!found) {
    found = [];
    for (const [dc, dr] of AXES) {
      for (let col = 0; col < columns; col++) {
        for (let row = 0; row < rows; row++) {
          const endCol = col + 3 * dc;
          const endRow = row + 3 * dr;
          if (endCol >= 0 && endCol < columns && endRow >= 0 && endRow < rows) {
            found.push([0, 1, 2, 3].map((i): [number, number] => [col + i * dc, row + i * dr]));
          }
        }
      }
    }
    windowCache.set(key, found);
  }
  return found;
}

/**
 * Static score of a position from player's point of view. Positive is good.
 *
 * Rewards windows of four that only player could still complete, penalises the
 * opponent's in the same way, and prefers discs in the centre column.
 * Symmetric by construction: evaluate(b, p) === -evaluate(b, other(p)).
 * Only meaningful for positions that do not already contain a four.
 */
export function evaluate(board: Board, player: Player): number {
  const opponent = other(player);
  let score = 0;
  for (const window of windows(board.columns, board.rows)) {
    let mine = 0;
    let theirs = 0;
    for (const [col, row] of window) {
      const disc = board.cell(col, row);
      if (disc === player) mine += 1;
      else if (disc === opponent) theirs += 1;
    }
    if (theirs === 0) score += WINDOW_POINTS[mine] || 0;
    else if (mine === 0) score -= WINDOW_POINTS[theirs] || 0;
  }
  if (board.columns % 2) {
    const centre = Math.floor(board.columns / 2);
    for (let row = 0; row < board.height(centre); row++) {
      score += board.cell(centre, row) === player ? CENTRE_POINTS : -CENTRE_POINTS;
    }
  }
  return score;
}

/**
 * Pick a 0-based column for the side to move.
 *
 * Wins at once if it can, otherwise blocks a column where the opponent would
 * win next turn, otherwise looks depth plies ahead with minimax and scores the
 * positions it reaches with evaluate().
 */
export function chooseMove(board: Board, depth: number = DEFAULT_DEPTH): number {
  throw new Error('Not implemented: chooseMove (Phase 2)');
}

/** Fastest forced win for the side to move within maxPlies plies, or null. */
export function solve(board: Board, maxPlies: number): ForcedWin | null {
  throw new Error('Not implemented: solve (Phase 2)');
}
