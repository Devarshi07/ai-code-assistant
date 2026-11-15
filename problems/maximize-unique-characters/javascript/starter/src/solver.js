// Suggests boards: the best set of candidate words for a puzzle.
const { asWords } = require('./models');

/**
 * Candidates that could appear on a board at all, one per spelling.
 *
 * Words that repeat a letter are dropped, and so are exact duplicates (the
 * same word often appears in several themes). Order is preserved.
 */
function playableWords(items) {
  const seen = new Set();
  const playable = [];
  for (const word of asWords(items)) {
    if (word.hasRepeats || seen.has(word.text)) continue;
    seen.add(word.text);
    playable.push(word);
  }
  return playable;
}

/**
 * The board that covers the most letters without repeating any.
 *
 * Returns { words, total }: the chosen words in alphabetical order and the
 * number of letters they cover. Ties go to the alphabetically first word list.
 */
function bestSelection(items) {
  throw new Error('Not implemented: bestSelection (Phase 2)');
}

module.exports = { playableWords, bestSelection };
