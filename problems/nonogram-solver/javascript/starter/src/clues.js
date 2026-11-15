// Clue derivation: turning a designer's drawing into the puzzle players see.
const { FILLED, Puzzle, columns, parseGrid } = require('./model');

/**
 * Run-length encode one line of a picture.
 *
 * Returns the lengths of the filled blocks in order, e.g. the line `.##.#..`
 * has the clue [2, 1]. An all-empty line has the clue [].
 */
function lineClue(cells) {
  const clue = [];
  let run = 0;
  for (const cell of cells) {
    if (cell === FILLED) {
      run++;
    } else if (run) {
      clue.push(run);
      run = 0;
    }
  }
  return clue;
}

/** Return [rowClues, colClues] for a complete grid. */
function cluesFromGrid(grid) {
  return [grid.map(lineClue), columns(grid).map(lineClue)];
}

/** Build the puzzle for a drawing, given as picture text or as a grid. */
function puzzleFromPicture(picture, options = {}) {
  const grid = typeof picture === 'string' ? parseGrid(picture) : picture;
  const [rowClues, colClues] = cluesFromGrid(grid);
  return new Puzzle(rowClues, colClues, options);
}

module.exports = { lineClue, cluesFromGrid, puzzleFromPicture };
