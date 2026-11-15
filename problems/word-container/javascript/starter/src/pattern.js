// Crossword patterns: the syntax used by the solver panel and the grid filler.
//
// A pattern describes a whole entry, one symbol per square:
//
//   letter   that exact letter                    c?t   -> cat, cot, cut
//   ?        exactly one letter, any letter       ???   -> every 3-letter word
//   *        any run of letters, including none   c*t   -> cat, chart, cut, ...
//                                                 cat*  -> cat, cats, catalog, ...
//
// A pattern must match the *whole* word: "c?t" matches neither "scat" nor "cats".
//
// Setters often type blanks as "." or "_", so both are read as "?". Letters get
// the same clean-up as stored words (case, accents, spaces, hyphens and
// apostrophes are ignored), so "C.T", "ç?t" and "c-?-t" all mean "c?t".
// Runs of stars collapse: "c**t" is the same pattern as "c*t".
const { IGNORED, LETTERS, stripAccents } = require('./normalize');

const ANY_LETTER = '?';
const ANY_RUN = '*';
const BLANK_ALIASES = new Set(['?', '.', '_']);
// Our largest grid is 25x25, so anything longer is almost certainly a paste mistake.
const MAX_SYMBOLS = 25;

/** Raised for text that is not a valid crossword pattern. */
class PatternError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PatternError';
  }
}

/** A parsed crossword pattern. Create one with parsePattern(). */
class Pattern {
  constructor(text) {
    this.text = text; // canonical form: letters a-z, "?" and "*", e.g. "c?t*"
    this.minLength = [...text].filter(symbol => symbol !== ANY_RUN).length;
    // null when the pattern contains a star and so has no upper bound.
    this.maxLength = text.includes(ANY_RUN) ? null : text.length;
  }

  /** True when word (already normalised, as stored) fits this pattern. */
  matches(word) {
    throw new Error('Not implemented: Pattern#matches (Phase 2)');
  }

  toString() {
    return this.text;
  }
}

/** Turn user input into a Pattern. A Pattern is returned unchanged. */
function parsePattern(raw) {
  if (raw instanceof Pattern) return raw;
  if (typeof raw !== 'string') throw new PatternError(`expected a string, got ${typeof raw}`);
  const symbols = [];
  for (const ch of stripAccents(raw.trim()).toLowerCase()) {
    if (LETTERS.has(ch)) symbols.push(ch);
    else if (BLANK_ALIASES.has(ch)) symbols.push(ANY_LETTER);
    else if (ch === ANY_RUN) {
      if (symbols[symbols.length - 1] !== ANY_RUN) symbols.push(ANY_RUN);
    } else if (!IGNORED.has(ch)) {
      throw new PatternError(`'${raw}': '${ch}' is not allowed in a pattern`);
    }
  }
  if (!symbols.length) throw new PatternError(`'${raw}': pattern is empty`);
  if (symbols.length > MAX_SYMBOLS) throw new PatternError(`'${raw}': patterns are limited to ${MAX_SYMBOLS} symbols`);
  return new Pattern(symbols.join(''));
}

module.exports = { ANY_LETTER, ANY_RUN, MAX_SYMBOLS, Pattern, PatternError, parsePattern };
