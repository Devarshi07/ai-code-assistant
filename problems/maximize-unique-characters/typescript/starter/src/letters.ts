// Letter-set helpers shared by the whole package.
//
// A word's letters are stored as a 26-bit mask: bit 0 is 'a', bit 25 is 'z'.
// Masks make the puzzle rule cheap to check, because two words share a letter
// exactly when (a & b) is non-zero.
//
//   maskLetters(letterMask('tango'))  // 'agnot'

export const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
export const FULL_MASK = (1 << ALPHABET.length) - 1;

/** Thrown for text that cannot be used as a puzzle word. */
export class WordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordError';
  }
}

/** Trim and lower-case a word. Anything except the letters a-z is rejected. */
export function normalizeWord(raw: string): string {
  const word = String(raw).trim().toLowerCase();
  if (!word) throw new WordError('empty word');
  const bad = [...new Set(word)].filter(ch => !ALPHABET.includes(ch)).sort();
  if (bad.length) throw new WordError(`'${String(raw).trim()}' contains '${bad.join('')}'; only a-z are allowed`);
  return word;
}

/** The mask bit for a single lower-case letter. */
export function letterBit(ch: string): number {
  return 1 << (ch.charCodeAt(0) - 97);
}

/** Bitmask of the distinct letters in a normalized word. */
export function letterMask(word: string): number {
  let mask = 0;
  for (const ch of word) mask |= letterBit(ch);
  return mask;
}

/** Number of letters in a mask. */
export function popcount(mask: number): number {
  let count = 0;
  for (let rest = mask; rest; rest &= rest - 1) count++;
  return count;
}

/** The letters in a mask, alphabetically: maskLetters(letterMask('otter')) === 'eort'. */
export function maskLetters(mask: number): string {
  let letters = '';
  for (let i = 0; i < ALPHABET.length; i++) if (mask & (1 << i)) letters += ALPHABET[i];
  return letters;
}

/** Letters present in both masks, alphabetically. */
export function sharedLetters(a: number, b: number): string {
  return maskLetters(a & b);
}
