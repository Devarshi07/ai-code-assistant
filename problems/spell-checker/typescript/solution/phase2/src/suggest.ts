// Spelling suggestions: the dictionary words closest to a misspelling.
//
// Closeness is Levenshtein edit distance, the fewest single-character
// insertions, deletions and substitutions that turn one word into the other.
// Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").
import { normalize } from './dictionary.ts';
import type { Dictionary } from './dictionary.ts';

export const MAX_DISTANCE = 2; // anything further away is not a useful suggestion
export const DEFAULT_LIMIT = 5; // entries shown in the editor's right-click menu

/** A dictionary word with what it is ranked by. */
interface Ranked {
  word: string;
  distance: number;
  frequency: number;
}

/**
 * Levenshtein distance between strings a and b.
 *
 * Classic dynamic program, keeping one row of the table at a time:
 * row[j] is the distance between the current prefix of a and b.slice(0, j).
 */
export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = Math.min(
        row[j] + 1, // delete a[i - 1]
        row[j - 1] + 1, // insert b[j - 1]
        previous + (a[i - 1] === b[j - 1] ? 0 : 1), // substitute
      );
      previous = row[j];
      row[j] = current;
    }
  }
  return row[b.length];
}

/** Closest first, then most frequent, then alphabetical (plain < order). */
function byRank(x: Ranked, y: Ranked): number {
  return x.distance - y.distance || y.frequency - x.frequency || (x.word < y.word ? -1 : x.word > y.word ? 1 : 0);
}

/** Ranks dictionary words as replacements for a misspelled word. */
export class Suggester {
  readonly dictionary: Dictionary;

  constructor(dictionary: Dictionary) {
    this.dictionary = dictionary;
  }

  /**
   * Up to `limit` dictionary words within MAX_DISTANCE edits of word.
   *
   * The word is compared in its normalized (lower-case) form and the results
   * are dictionary keys. Closest words come first; ties go to the more
   * frequent word, then to the alphabetically smaller one.
   */
  suggest(word: string, limit = DEFAULT_LIMIT): string[] {
    const key = normalize(word);
    const ranked: Ranked[] = [];
    for (const candidate of this.dictionary.words()) {
      const distance = editDistance(key, candidate);
      if (distance <= MAX_DISTANCE) {
        ranked.push({ word: candidate, distance, frequency: this.dictionary.frequency(candidate) });
      }
    }
    ranked.sort(byRank);
    return ranked.slice(0, Math.max(limit, 0)).map(entry => entry.word);
  }
}
