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

/**
 * The board that covers the most letters without repeating any.
 *
 * Returns { words, total }: the chosen words in alphabetical order and the
 * number of letters they cover. Ties go to the alphabetically first word list.
 */
export function bestSelection(items: Iterable<Word | string>): Selection {
  throw new Error('Not implemented: bestSelection (Phase 2)');
}
