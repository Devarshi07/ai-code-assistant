// Text rendering used by the level editor preview and the CLI.
import { directionBetween } from './geometry.ts';
import type { Position } from './geometry.ts';
import { FLOOR } from './level.ts';
import type { Level } from './level.ts';
import type { Run } from './solver.ts';

export const PATH_MARK = 'o';

/** The level as text with floor tiles on path marked. */
export function render(level: Level, path: readonly Position[] | null = []): string {
  const grid = level.rows.map(row => row.split(''));
  for (const pos of path ?? []) {
    if (grid[pos.row][pos.col] === FLOOR) grid[pos.row][pos.col] = PATH_MARK;
  }
  return grid.map(row => row.join('')).join('\n');
}

/** Describe a path as compass letters, e.g. 'EESSW'. */
export function toMoves(path: readonly Position[]): string {
  let moves = '';
  for (let i = 1; i < path.length; i++) moves += directionBetween(path[i - 1], path[i]);
  return moves;
}

export function summary(level: Level, run: Run | null): string {
  if (!run) return `${level.name}: no route`;
  return `${level.name}: ${run.moves} moves  ${toMoves(run.path)}`;
}
