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

/** word plus every string made by deleting up to `depth` of its letters. */
export function deletes(word: string, depth = MAX_DISTANCE): Set<string> {
  const variants = new Set([word]);
  let frontier = [word];
  for (let level = 0; level < depth; level++) {
    const next: string[] = [];
    for (const w of frontier) {
      for (let i = 0; i < w.length; i++) {
        const shorter = w.slice(0, i) + w.slice(i + 1);
        if (!variants.has(shorter)) {
          variants.add(shorter);
          next.push(shorter);
        }
      }
    }
    frontier = next;
  }
  return variants;
}

/** Closest first, then most frequent, then alphabetical (plain < order). */
function byRank(x: Ranked, y: Ranked): number {
  return x.distance - y.distance || y.frequency - x.frequency || (x.word < y.word ? -1 : x.word > y.word ? 1 : 0);
}

/**
 * Ranks dictionary words as replacements for a misspelled word.
 *
 * Symmetric-delete index: if two words are within MAX_DISTANCE edits, then
 * deleting at most MAX_DISTANCE letters from each yields a common string (a
 * substitution is one deletion on each side, an insertion is a deletion on
 * the other side). The index maps every such deletion variant of every
 * dictionary word to the words that produce it, so a lookup only verifies the
 * handful of words that share a variant with the misspelling.
 *
 * The index is built once, from the dictionary as it is when the suggester is
 * created.
 */
export class Suggester {
  readonly dictionary: Dictionary;
  private readonly index = new Map<string, string[]>();

  constructor(dictionary: Dictionary) {
    this.dictionary = dictionary;
    for (const entry of dictionary.words()) {
      for (const variant of deletes(entry)) {
        const bucket = this.index.get(variant);
        if (bucket) bucket.push(entry);
        else this.index.set(variant, [entry]);
      }
    }
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
    const candidates = new Set<string>();
    for (const variant of deletes(key)) {
      for (const candidate of this.index.get(variant) ?? []) candidates.add(candidate);
    }
    const ranked: Ranked[] = [];
    for (const candidate of candidates) {
      const distance = editDistance(key, candidate);
      if (distance <= MAX_DISTANCE) {
        ranked.push({ word: candidate, distance, frequency: this.dictionary.frequency(candidate) });
      }
    }
    ranked.sort(byRank);
    return ranked.slice(0, Math.max(limit, 0)).map(entry => entry.word);
  }
}
