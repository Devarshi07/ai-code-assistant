// Splits note text into words, keeping each word's character offsets.
//
// The editor draws its red underline from the offsets reported here, so every
// token must point at exactly the characters it came from in the note.
//
// Rules
//   - A word is a run of letters. An apostrophe with a letter on both sides
//     belongs to the word, so contractions and possessives stay whole:
//     don't, o'clock, team's.
//   - Quotes, hyphens, dashes, slashes and other punctuation separate words.
//     "well-known" is checked as "well" and "known"; 'draft' is just draft.
//   - Runs that contain a digit (2024, 3rd, mp3, 10am) are not words and are
//     skipped entirely.

const APOSTROPHE = "'";
const DIGITS = '0123456789';
const LETTER = /\p{L}/u;

/** A word as it appears in the note. */
export interface Token {
  /** The word exactly as written in the note. */
  text: string;
  /** Offset of its first character. */
  start: number;
  /** Offset one past its last character. */
  end: number;
}

export function isLetter(ch: string | undefined): boolean {
  return ch !== undefined && LETTER.test(ch);
}

function isWordChar(ch: string): boolean {
  return isLetter(ch) || DIGITS.includes(ch);
}

/** True when text[i] is an apostrophe with a letter on each side. */
function joinsWord(text: string, i: number): boolean {
  return text[i] === APOSTROPHE && i > 0 && i < text.length - 1
    && isLetter(text[i - 1]) && isLetter(text[i + 1]);
}

/** Every checkable word in text, in order. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (!isWordChar(text[i])) {
      i++;
      continue;
    }
    const start = i;
    while (i < text.length && (isWordChar(text[i]) || joinsWord(text, i))) i++;
    const word = text.slice(start, i);
    if (![...word].some(ch => DIGITS.includes(ch))) tokens.push({ text: word, start, end: i });
  }
  return tokens;
}
