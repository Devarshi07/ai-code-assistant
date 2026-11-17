// Suggests boards: the best set of candidate words for a puzzle.
import { asWords } from './models.ts';
import type { Selection, Word } from './models.ts';

/**
 * Candidates that could appear on a board at all, one per spelling.
 *
 * Words that repeat a letter are dropped, and so are exact duplicates (the
 * same word often appears in several themes). Order is preserved.
 */
export function playableWords(items: Iterable<Word | string>): Word[] {
  const seen = new Set<string>();
  const playable: Word[] = [];
  for (const word of asWords(items)) {
    if (word.hasRepeats || seen.has(word.text)) continue;
    seen.add(word.text);
    playable.push(word);
  }
  return playable;
}

/** True when word list a sorts before word list b (word by word, like a dictionary). */
function listBefore(a: string[], b: string[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return a.length < b.length;
}

/**
 * The board that covers the most letters without repeating any.
 *
 * Returns { words, total }: the chosen words in alphabetical order and the
 * number of letters they cover. Ties go to the alphabetically first word list.
 *
 * Backtracking: try every set of mutually compatible words, extending a board
 * only with words that come later alphabetically and share no letter with it,
 * and keep the best board seen.
 */
export function bestSelection(items: Iterable<Word | string>): Selection {
  const pool = playableWords(items).sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  let bestTotal = 0;
  let bestWords: string[] = [];
  const chosen: string[] = [];

  function search(start: number, used: number, total: number): void {
    if (total > bestTotal || (total === bestTotal && listBefore(chosen, bestWords))) {
      bestTotal = total;
      bestWords = chosen.slice();
    }
    for (let i = start; i < pool.length; i++) {
      const word = pool[i];
      if (word.mask & used) continue;
      chosen.push(word.text);
      search(i + 1, used | word.mask, total + word.length);
      chosen.pop();
    }
  }

  search(0, 0, 0);
  return { words: bestWords, total: bestTotal };
}
