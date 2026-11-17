// Clue derivation: turning a designer's drawing into the puzzle players see.
import { FILLED, Puzzle, columns, parseGrid } from './model.ts';
import type { Cell, Clue, Grid, PuzzleOptions } from './model.ts';

/**
 * Run-length encode one line of a picture.
 *
 * Returns the lengths of the filled blocks in order, e.g. the line `.##.#..`
 * has the clue [2, 1]. An all-empty line has the clue [].
 */
export function lineClue(cells: Cell[]): Clue {
  const clue: Clue = [];
  let run = 0;
  for (const cell of cells) {
    if (cell === FILLED) {
      run++;
    } else if (run) {
      clue.push(run);
      run = 0;
    }
  }
  if (run) clue.push(run);
  return clue;
}

/** Return [rowClues, colClues] for a complete grid. */
export function cluesFromGrid(grid: Grid): [Clue[], Clue[]] {
  return [grid.map(lineClue), columns(grid).map(lineClue)];
}

/** Build the puzzle for a drawing, given as picture text or as a grid. */
export function puzzleFromPicture(picture: string | Grid, options: PuzzleOptions = {}): Puzzle {
  const grid = typeof picture === 'string' ? parseGrid(picture) : picture;
  const [rowClues, colClues] = cluesFromGrid(grid);
  return new Puzzle(rowClues, colClues, options);
}
