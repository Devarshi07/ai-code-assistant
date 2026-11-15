// Finds the misspelled words in a note.
//
// The editor calls check() on every keystroke pause, so it only reports where
// the problems are. Suggestions are fetched separately, when the user opens
// the right-click menu on an underlined word.
const { normalize } = require('./dictionary');
const { DEFAULT_LIMIT, Suggester } = require('./suggest');
const { tokenize } = require('./tokenizer');

/**
 * @typedef {{ word: string, start: number, end: number }} Misspelling
 * word is as written in the note; start/end are offsets like a Token's.
 */

/** All capitals and longer than one letter: NASA, TODO, DON'T. */
function isShouting(word) {
  return word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
}

/** Give a suggestion the capitalisation of the word it would replace. */
function matchCase(template, word) {
  if (isShouting(template)) return word.toUpperCase();
  const first = template.charAt(0);
  if (first !== first.toLowerCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

class SpellChecker {
  constructor(dictionary, { ignoreUppercase = true } = {}) {
    this.dictionary = dictionary;
    this.ignoreUppercase = ignoreUppercase; // skip acronyms such as NASA
    this.ignored = new Set();
    this.suggester = null;
  }

  /** 'Ignore all' from the context menu: accept word for this session. */
  ignore(word) {
    this.ignored.add(normalize(word));
  }

  isKnown(word) {
    const key = normalize(word);
    if (this.ignored.has(key) || this.dictionary.has(key)) return true;
    // Possessives aren't listed separately: "team's" is fine if "team" is.
    return key.endsWith("'s") && this.dictionary.has(key.slice(0, -2));
  }

  /** Every misspelled word in text, in order of appearance. */
  check(text) {
    const found = [];
    for (const token of tokenize(text)) {
      if (this.ignoreUppercase && isShouting(token.text)) continue;
      if (!this.isKnown(token.text)) found.push({ word: token.text, start: token.start, end: token.end });
    }
    return found;
  }

  /** Replacements for word, capitalised the way the user wrote it. */
  suggest(word, limit = DEFAULT_LIMIT) {
    if (!this.suggester) this.suggester = new Suggester(this.dictionary);
    return this.suggester.suggest(word, limit).map(s => matchCase(word, s));
  }
}

module.exports = { SpellChecker, matchCase };
