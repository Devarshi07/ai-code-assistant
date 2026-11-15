// Data model: candidate words, solver selections and dated puzzles.
const { FULL_MASK, letterMask, maskLetters, normalizeWord, popcount } = require('./letters');

/**
 * One candidate from the designers' word list.
 *
 * `text` is always normalized (lower-case a-z). `mask` holds the word's
 * letters as a bitmask (see letters.js). `difficulty` runs from 1 (easy) to
 * 3 (hard) and `tags` names the themes the word belongs to.
 */
class Word {
  constructor(text, difficulty = 1, tags = []) {
    this.text = normalizeWord(text);
    this.difficulty = difficulty;
    this.tags = new Set(tags);
    this.mask = letterMask(this.text);
  }

  /** The word's distinct letters in alphabetical order ('otter' -> 'eort'). */
  get letters() {
    return maskLetters(this.mask);
  }

  /** How many tiles the word puts on the board. */
  get length() {
    return this.text.length;
  }

  /** True when some letter appears more than once in the word. */
  get hasRepeats() {
    return popcount(this.mask) !== this.length;
  }

  toString() {
    return `Word(${this.text})`;
  }
}

/** Accept Word objects or plain strings; return an array of Words. */
function asWords(items) {
  return [...items].map(item => (item instanceof Word ? item : new Word(item)));
}

/**
 * A solver answer.
 * @typedef {{ words: string[], total: number }} Selection
 * words are the chosen words in alphabetical order; total is the letters they cover.
 */

/** A dated, themed board. Every letter may appear on it at most once. */
class Puzzle {
  constructor(day, theme, words) {
    this.day = day;
    this.theme = theme;
    this.words = asWords(words);
  }

  /** Mask of every letter that appears on the board. */
  get covered() {
    return this.words.reduce((mask, word) => mask | word.mask, 0);
  }

  /** Tiles shown on the board; the header and the score use this. */
  get tileCount() {
    return this.words.reduce((sum, word) => sum + word.length, 0);
  }

  /** Letters of the alphabet that are not on the board. */
  get unusedLetters() {
    return maskLetters(FULL_MASK & ~this.covered);
  }
}

module.exports = { Word, asWords, Puzzle };
