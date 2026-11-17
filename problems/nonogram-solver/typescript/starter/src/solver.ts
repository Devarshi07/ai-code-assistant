// Solver used by the import pipeline to build answer keys for contributor puzzles.
import type { Grid, Puzzle } from './model.ts';

/**
 * Return a grid that satisfies every row and column clue of puzzle.
 *
 * The grid is an array of puzzle.height rows, each an array of puzzle.width
 * cells (FILLED or EMPTY). Returns null when no grid fits the clues.
 */
export function solve(puzzle: Puzzle): Grid | null {
  throw new Error('Not implemented: solve (Phase 2)');
}
