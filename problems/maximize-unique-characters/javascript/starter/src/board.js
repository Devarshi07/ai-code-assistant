// Text previews of a board for the puzzle desk and the CLI.
const { ALPHABET } = require('./letters');

/** 'AB.D..' style strip: upper-case letters are on the board, dots are unused. */
function alphabetStrip(mask) {
  return [...ALPHABET].map((ch, i) => (mask & (1 << i) ? ch.toUpperCase() : '.')).join('');
}

/** Header, word row and alphabet strip for one puzzle. */
function render(puzzle) {
  const words = puzzle.words.map(word => word.text.toUpperCase()).join('  ') || '(empty board)';
  return [
    `${puzzle.day}  ${puzzle.theme}: ${puzzle.tileCount} tiles`,
    `  ${words}`,
    `  [${alphabetStrip(puzzle.covered)}]  ${puzzle.unusedLetters.length} letters unused`
  ].join('\n');
}

module.exports = { alphabetStrip, render };
