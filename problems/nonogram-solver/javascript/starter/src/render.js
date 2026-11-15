// ASCII previews of puzzles, used by the CLI and in review e-mails.
//
// Column clues are stacked above the board and row clues sit to its left:
//
//           1
//         2 4 1 4 2
//     1 1 . # . # .
//       5 # # # # #
const { CELL_CHARS, formatClue } = require('./model');

const UNKNOWN_CHAR = '?';

/** Board with clues. Without a grid every cell shows as '?'. */
function render(puzzle, grid = null) {
  const rowLabels = puzzle.rowClues.map(formatClue);
  const margin = Math.max(...rowLabels.map(label => label.length));
  const stacks = puzzle.colClues.map(clue => (clue.length ? clue.map(String) : ['0']));
  const depth = Math.max(...stacks.map(stack => stack.length));
  const cellWidth = Math.max(2, 1 + Math.max(...stacks.flat().map(n => n.length)));

  const lines = [];
  for (let level = 0; level < depth; level++) {
    const parts = stacks.map(stack => {
      const offset = depth - stack.length;
      return level >= offset ? stack[level - offset].padStart(cellWidth) : ' '.repeat(cellWidth);
    });
    lines.push(' '.repeat(margin) + parts.join(''));
  }
  rowLabels.forEach((label, r) => {
    const cells = [];
    for (let c = 0; c < puzzle.width; c++) {
      const ch = grid ? CELL_CHARS[grid[r][c]] ?? UNKNOWN_CHAR : UNKNOWN_CHAR;
      cells.push(ch.padStart(cellWidth));
    }
    lines.push(label.padStart(margin) + cells.join(''));
  });
  return lines.map(line => line.trimEnd()).join('\n');
}

module.exports = { render };
