// The word list behind the spell checker, with usage frequencies.
//
// File format: one entry per line, a word and how often it appeared in the
// notes corpus, separated by whitespace. A missing count means 1. Blank lines
// and lines starting with # are ignored.
//
//     receive   215
//     don't     3020
import { readFileSync } from 'node:fs';

export const DEFAULT_WORDS = new URL('./data/words.txt', import.meta.url);

/** Lookup key for a word: lower case, typographic apostrophes as '. */
export function normalize(word: string): string {
  return word.replace(/’/g, "'").toLowerCase();
}

/** Known words and their frequencies, keyed by normalize(word). */
export class Dictionary {
  private readonly counts = new Map<string, number>();

  constructor(counts: Record<string, number> = {}) {
    for (const [word, count] of Object.entries(counts)) this.add(word, count);
  }

  static parse(text: string): Dictionary {
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

  static load(file: string | URL = DEFAULT_WORDS): Dictionary {
    return Dictionary.parse(readFileSync(file, 'utf8'));
  }

  /** Add word, or add count to it if it is already known. */
  add(word: string, count = 1): void {
    const key = normalize(word);
    this.counts.set(key, (this.counts.get(key) ?? 0) + count);
  }

  has(word: string): boolean {
    return this.counts.has(normalize(word));
  }

  /** How common word is; 0 when it isn't in the dictionary. */
  frequency(word: string): number {
    return this.counts.get(normalize(word)) ?? 0;
  }

  /** Every entry's lookup key, in the order they were added. */
  words(): string[] {
    return [...this.counts.keys()];
  }

  get size(): number {
    return this.counts.size;
  }
}
