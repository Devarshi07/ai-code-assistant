// Spelling suggestions: the dictionary words closest to a misspelling.
//
// Closeness is Levenshtein edit distance, the fewest single-character
// insertions, deletions and substitutions that turn one word into the other.
// Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").
const { normalize } = require('./dictionary');

const MAX_DISTANCE = 2; // anything further away is not a useful suggestion
const DEFAULT_LIMIT = 5; // entries shown in the editor's right-click menu

/** Levenshtein distance between strings a and b. */
function editDistance(a, b) {
  throw new Error('Not implemented: editDistance (Phase 2)');
}

/** Ranks dictionary words as replacements for a misspelled word. */
class Suggester {
  constructor(dictionary) {
    this.dictionary = dictionary;
  }

  /**
   * Up to `limit` dictionary words within MAX_DISTANCE edits of word.
   *
   * The word is compared in its normalized (lower-case) form and the results
   * are dictionary keys. Closest words come first; ties go to the more
   * frequent word, then to the alphabetically smaller one.
   */
  suggest(word, limit = DEFAULT_LIMIT) {
    throw new Error('Not implemented: Suggester#suggest (Phase 2)');
  }
}

module.exports = { MAX_DISTANCE, DEFAULT_LIMIT, editDistance, Suggester };
