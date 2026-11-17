// Normalisation rules shared by everything that stores or looks up words.
//
// A crossword grid holds one plain letter per square, so the store keeps every
// entry in a single canonical form:
//
// 1. Surrounding whitespace is removed and letters are lowercased.
// 2. Accents are stripped: "Café" -> "cafe", "jalapeño" -> "jalapeno".
// 3. Spaces, hyphens and apostrophes inside an entry are dropped, the way grids
//    ignore them: "ice cream" -> "icecream", "o'clock" -> "oclock".
// 4. What is left must be letters a-z. Digits and other symbols make the entry
//    invalid ("r2d2", "24/7"), and so does an entry with no letters at all.

export const LETTERS: ReadonlySet<string> = new Set('abcdefghijklmnopqrstuvwxyz');
// Characters that grids ignore: space, hyphen, straight and curly apostrophes.
export const IGNORED: ReadonlySet<string> = new Set([' ', '-', "'", '’']);

/** Raised when an entry cannot be stored as a grid word. */
export class InvalidWord extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWord';
  }
}

/** Remove combining marks after compatibility decomposition (é -> e, ﬁ -> fi). */
export function stripAccents(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '');
}

/** The canonical form of an entry; throws InvalidWord when there is none. */
export function normalizeWord(raw: unknown): string {
  if (typeof raw !== 'string') throw new InvalidWord(`expected a string, got ${typeof raw}`);
  const text = raw.trim();
  // Fast path: almost every line of a word list is a plain ASCII word.
  if (/^[A-Za-z]+$/.test(text)) return text.toLowerCase();
  let letters = '';
  for (const ch of stripAccents(text).toLowerCase()) {
    if (LETTERS.has(ch)) letters += ch;
    else if (!IGNORED.has(ch)) throw new InvalidWord(`'${raw}': '${ch}' is not a letter`);
  }
  if (!letters) throw new InvalidWord(`'${raw}': no letters`);
  return letters;
}

/** Like normalizeWord, but an empty prefix is allowed and means "every word". */
export function normalizePrefix(raw: unknown): string {
  if (typeof raw === 'string' && !raw.trim()) return '';
  return normalizeWord(raw);
}
