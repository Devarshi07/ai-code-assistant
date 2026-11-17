// The computer opponent and the puzzle checker.
//
// chooseMove() powers "Play the computer". solve() checks the daily puzzles
// ("Red to play and win in 5"): it finds how quickly the side to move can force
// a win. Distances are counted in plies. A ply is one disc dropped by either
// player, so a win in 5 plies means three discs from the winner and two from
// the defender, the last of the three completing the four.
import { RED, other } from './board.ts';
import type { Board, Player } from './board.ts';
import { AXES, isWinningDrop, winningColumns } from './rules.ts';

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

/** Legal columns, centre first. */
function orderedMoves(board: Board): number[] {
  return centreOrder(board.columns).filter(col => board.canPlay(col));
}

/**
 * Pick a 0-based column for the side to move.
 *
 * Wins at once if it can, otherwise blocks a column where the opponent would
 * win next turn, otherwise looks depth plies ahead with minimax and scores the
 * positions it reaches with evaluate().
 */
export function chooseMove(board: Board, depth: number = DEFAULT_DEPTH): number {
  const moves = orderedMoves(board);
  if (!moves.length) throw new Error('no legal moves: the board is full');
  const me = board.toMove;
  for (const col of moves) if (isWinningDrop(board, col, me)) return col;
  for (const col of moves) if (isWinningDrop(board, col, other(me))) return col;
  let bestCol = moves[0];
  let bestScore = -Infinity;
  for (const col of moves) {
    board.drop(col);
    const score = -minimax(board, depth - 1);
    board.undo();
    if (score > bestScore) {
      bestCol = col;
      bestScore = score;
    }
  }
  return bestCol;
}

/** Negamax: the score for the side to move, looking depth plies ahead. */
function minimax(board: Board, depth: number): number {
  const me = board.toMove;
  if (depth <= 0) return evaluate(board, me);
  const moves = orderedMoves(board);
  if (!moves.length) return 0;
  for (const col of moves) {
    if (isWinningDrop(board, col, me)) return WIN_SCORE + depth; // a sooner win leaves more depth
  }
  let best = -Infinity;
  for (const col of moves) {
    board.drop(col);
    const score = -minimax(board, depth - 1);
    board.undo();
    if (score > best) best = score;
  }
  return best;
}

/**
 * Fastest forced win for the side to move within maxPlies plies, or null.
 *
 * Iterative deepening over odd distances 1, 3, 5, ...: the first distance at
 * which a forced win exists is the exact answer. Each step is a yes/no search
 * ("can the side to move force a four within n plies?"), which is alpha-beta
 * with the narrowest possible window, plus a transposition table, centre-first
 * move ordering and forced replies to immediate threats.
 */
export function solve(board: Board, maxPlies: number): ForcedWin | null {
  if (maxPlies < 1 || !board.legalMoves().length) return null;
  const search = new WinSearch(board.copy());
  for (let plies = 1; plies <= maxPlies; plies += 2) {
    const move = search.winningMove(plies);
    if (move !== null) return { move, plies };
  }
  return null;
}

/** Yes/no forced-win search for the player to move on the given board. */
class WinSearch {
  board: Board;
  order: number[];
  packed: boolean;
  weights: number[][];
  key: number;
  proven: Map<number | string, number>; // key -> smallest n known to force a win
  refuted: Map<number | string, number>; // key -> largest n known not to

  constructor(board: Board) {
    this.board = board;
    this.order = centreOrder(board.columns);
    // Exact position key, updated as discs are dropped. Each column is a number
    // with a leading 1 bit above one bit per disc (1 = yellow), and the columns
    // are packed side by side. Larger boards fall back to the grid text.
    this.packed = (board.rows + 1) * board.columns <= 52;
    this.weights = [];
    this.key = 0;
    for (let col = 0; col < board.columns; col++) {
      const base = Math.pow(2, (board.rows + 1) * col);
      this.weights.push(Array.from({ length: board.rows }, (_, row) => base * Math.pow(2, row)));
      this.key += base;
      for (let row = 0; row < board.height(col); row++) this.key += this.weight(col, row, board.cell(col, row) as Player);
    }
    this.proven = new Map();
    this.refuted = new Map();
  }

  weight(col: number, row: number, player: Player): number {
    return this.weights[col][row] * (player === RED ? 1 : 2);
  }

  positionKey(): number | string {
    return this.packed ? this.key : this.board.toGrid();
  }

  drop(col: number): number {
    const player = this.board.toMove;
    const row = this.board.drop(col);
    const weight = this.weight(col, row, player);
    this.key += weight;
    return weight;
  }

  undo(weight: number): void {
    this.board.undo();
    this.key -= weight;
  }

  /** Can the side to move force a four within plies plies? */
  winsWithin(plies: number): boolean {
    const key = this.positionKey();
    const proven = this.proven.get(key);
    if (proven !== undefined && proven <= plies) return true;
    const refuted = this.refuted.get(key);
    if (refuted !== undefined && refuted >= plies) return false;
    const result = this.winningMove(plies) !== null;
    if (result) this.proven.set(key, plies);
    else this.refuted.set(key, plies);
    return result;
  }

  /** A column that forces a four within plies plies, or null. */
  winningMove(plies: number): number | null {
    const board = this.board;
    const moves = this.order.filter(col => board.canPlay(col));
    for (const col of moves) if (isWinningDrop(board, col)) return col;
    if (plies < 3) return null;
    const threats = winningColumns(board, other(board.toMove));
    if (threats.length > 1) return null; // only one of them can be blocked
    for (const col of threats.length ? threats : moves) {
      if (this.everyReplyLoses(col, plies)) return col;
    }
    return null;
  }

  /** After dropping into col, does every reply still lose within plies - 1? */
  everyReplyLoses(col: number, plies: number): boolean {
    const board = this.board;
    const weight = this.drop(col);
    try {
      const replies = this.order.filter(reply => board.canPlay(reply));
      if (!replies.length) return false; // the board filled up: a draw
      const defender = board.toMove;
      for (const reply of replies) if (isWinningDrop(board, reply, defender)) return false;
      const threats = winningColumns(board, other(defender));
      if (threats.length > 1) return true; // two threats: the defender cannot block both
      for (const reply of threats.length ? threats : replies) {
        const replyWeight = this.drop(reply);
        const stillWinning = this.winsWithin(plies - 2);
        this.undo(replyWeight);
        if (!stillWinning) return false;
      }
      return true;
    } finally {
      this.undo(weight);
    }
  }
}
