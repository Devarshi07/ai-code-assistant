// Sample games and puzzles used by the demo and by the support team.
import { Board } from './board.ts';

// Move log attached to support ticket #4127. The player says Yellow's last disc
// completed a diagonal running from column 2 down to column 5.
export const REPORTED_GAME = '453421332272';

// A short opening for the computer-opponent demo.
export const OPENING = '4453';

/** moves: how the position arose (1-based); plies: the advertised forced-win distance. */
export const DAILY_PUZZLES = [
  { name: 'Monday', moves: '216646', plies: 3 },
  { name: 'Wednesday', moves: '36566312253', plies: 5 },
  { name: 'Friday', moves: '164773774571', plies: 7 },
].map(puzzle => ({ ...puzzle, board: () => Board.fromMoves(puzzle.moves) }));
