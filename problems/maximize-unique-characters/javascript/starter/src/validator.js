// Checks a board against the puzzle rules before it is published.
//
// The rules of One of Each:
//   1. a word may not use any letter twice ('otter' is out);
//   2. no letter may appear in more than one word on the board.
const { maskLetters } = require('./letters');
const { asWords } = require('./models');

/** Human-readable rule violations for a board; empty when it is valid. */
function selectionProblems(items) {
  const words = asWords(items);
  const problems = [];
  const placed = [];
  let used = 0;
  for (const word of words) {
    if (word.hasRepeats) {
      const doubled = [...word.letters].filter(ch => word.text.split(ch).length > 2).join('');
      problems.push(`'${word.text}' uses '${doubled}' more than once`);
    }
    const clash = used & word.mask;
    if (clash) {
      const others = placed.filter(other => other.mask & clash).map(other => `'${other.text}'`).join(', ');
      problems.push(`'${word.text}' shares '${maskLetters(clash)}' with ${others}`);
    }
    used |= word.mask;
    placed.push(word);
  }
  return problems;
}

function isValidSelection(items) {
  return selectionProblems(items).length === 0;
}

module.exports = { selectionProblems, isValidSelection };
