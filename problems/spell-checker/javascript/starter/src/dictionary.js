// The word list behind the spell checker, with usage frequencies.
//
// File format: one entry per line, a word and how often it appeared in the
// notes corpus, separated by whitespace. A missing count means 1. Blank lines
// and lines starting with # are ignored.
//
//     receive   215
//     don't     3020
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WORDS = path.join(__dirname, 'data', 'words.txt');

/** Lookup key for a word: lower case, typographic apostrophes as '. */
function normalize(word) {
  return word.replace(/’/g, "'").toLowerCase();
}

/** Known words and their frequencies, keyed by normalize(word). */
class Dictionary {
  constructor(counts = {}) {
    this.counts = new Map();
    for (const [word, count] of Object.entries(counts)) this.add(word, count);
  }

  static parse(text) {
    const dictionary = new Dictionary();
    text.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const parts = line.split(/\s+/);
      if (parts.length > 2 || (parts.length === 2 && !/^\d+$/.test(parts[1]))) {
        throw new Error(`line ${index + 1}: expected 'word count', got '${raw}'`);
      }
      dictionary.add(parts[0], parts.length === 2 ? Number(parts[1]) : 1);
    });
    return dictionary;
  }

  static load(file = DEFAULT_WORDS) {
    return Dictionary.parse(fs.readFileSync(file, 'utf8'));
  }

  /** Add word, or add count to it if it is already known. */
  add(word, count = 1) {
    const key = normalize(word);
    this.counts.set(key, (this.counts.get(key) || 0) + count);
  }

  has(word) {
    return this.counts.has(normalize(word));
  }

  /** How common word is; 0 when it isn't in the dictionary. */
  frequency(word) {
    return this.counts.get(normalize(word)) || 0;
  }

  /** Every entry's lookup key, in the order they were added. */
  words() {
    return [...this.counts.keys()];
  }

  get size() {
    return this.counts.size;
  }
}

module.exports = { Dictionary, normalize, DEFAULT_WORDS };
