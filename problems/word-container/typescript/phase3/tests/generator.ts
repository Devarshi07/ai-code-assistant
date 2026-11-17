// Deterministic pseudo-English dictionaries and queries for the scale tests.
// Every language edition has the same generator, so a seed produces the same words
// everywhere.

const ONSETS = ['', '', 'b', 'b', 'br', 'c', 'c', 'ch', 'cl', 'd', 'd', 'dr', 'f', 'fl', 'g', 'gr', 'h', 'h',
  'j', 'k', 'l', 'l', 'm', 'm', 'n', 'n', 'p', 'p', 'pl', 'r', 'r', 's', 's', 'sh', 'sl', 'sp',
  'st', 't', 't', 'th', 'tr', 'v', 'w', 'w', 'y', 'z'];
const VOWELS = ['a', 'a', 'e', 'e', 'i', 'o', 'u', 'ai', 'au', 'ea', 'ee', 'ie', 'oa', 'oo', 'ou', 'y'];
const CODAS = ['', '', '', '', '', '', '', '', 'b', 'ck', 'd', 'g', 'l', 'll', 'm', 'n', 'n', 'nd', 'ng',
  'nt', 'p', 'r', 'r', 's', 'st', 't', 't', 'x'];
const SUFFIXES = ['', '', '', '', '', '', '', '', '', '', 's', 's', 's', 'ed', 'er', 'ing', 'ly', 'y'];

/** 32-bit linear congruential generator, identical in every edition. */
export function lcg(seed: number): (n: number) => number {
  let state = seed >>> 0;
  return (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 16) % n;
  };
}

function makeWord(below: (n: number) => number): string {
  let word = '';
  const syllables = 1 + below(2) + below(2);
  for (let i = 0; i < syllables; i++) {
    word += ONSETS[below(ONSETS.length)];
    word += VOWELS[below(VOWELS.length)];
    word += CODAS[below(CODAS.length)];
  }
  return word + SUFFIXES[below(SUFFIXES.length)];
}

/** count pseudo-words; expect some repeats. */
export function generateWords(seed: number, count: number): string[] {
  const below = lcg(seed);
  const words: string[] = [];
  for (let i = 0; i < count; i++) words.push(makeWord(below));
  return words;
}

/** Grid-fill queries: stored words with some squares still blank, e.g. "?ra??le". */
export function slotPatterns(words: string[], seed: number, count: number, blankPercent = 40): string[] {
  const below = lcg(seed);
  const patterns: string[] = [];
  while (patterns.length < count) {
    const word = words[below(words.length)];
    if (word.length < 4) continue;
    const squares = [...word].map(ch => (below(100) < blankPercent ? '?' : ch));
    if (squares.filter(ch => ch !== '?').length >= 2) patterns.push(squares.join(''));
  }
  return patterns;
}

/** Solver-panel queries: the start of a word with a few blanks, then a star, e.g. "dr?n*". */
export function searchPatterns(words: string[], seed: number, count: number): string[] {
  const below = lcg(seed);
  const patterns: string[] = [];
  while (patterns.length < count) {
    const word = words[below(words.length)];
    if (word.length < 6) continue;
    const start = [...word.slice(0, 3 + below(word.length - 4))].map(ch => (below(100) < 35 ? '?' : ch));
    if (start.filter(ch => ch !== '?').length >= 2) patterns.push(start.join('') + '*');
  }
  return patterns;
}

