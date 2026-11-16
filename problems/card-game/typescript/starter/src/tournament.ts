// Tournament marathon mode.
//
// In tournament finals the cards are not dealt into small hands. A marathon
// hand of up to a full deck is spread face up and the table calls bonus
// targets such as 15, 31 or 100. For every target the scoreboard shows how
// many combinations of cards (by position, as everywhere else) add up to it.
// Only the counts are needed; nobody wants the combinations listed.
import { formatCards } from './cards.ts';
import type { Card } from './cards.ts';
import { FIFTEEN, countCombinations } from './evaluate.ts';

// Marathon hands come from a single deck.
export const MAX_MARATHON_CARDS = 52;
export const MAX_TARGET = 200;

/** Map each target to the number of combinations of cards adding up to it. */
export function marathonCounts(cards: readonly Card[], targets: readonly number[] = [FIFTEEN]): Map<number, number> {
  if (cards.length > MAX_MARATHON_CARDS) throw new RangeError(`a marathon hand has at most ${MAX_MARATHON_CARDS} cards`);
  for (const target of targets) {
    if (!(target >= 1 && target <= MAX_TARGET)) throw new RangeError(`targets must be between 1 and ${MAX_TARGET}`);
  }
  const counts = new Map<number, number>();
  for (const target of targets) counts.set(target, countCombinations(cards, target));
  return counts;
}

export function formatMarathon(cards: readonly Card[], counts: ReadonlyMap<number, number>): string {
  const lines = [`Marathon hand (${cards.length} cards): ${formatCards(cards.slice(0, 8))}${cards.length > 8 ? ' ...' : ''}`];
  for (const [target, count] of counts) {
    lines.push(`  target ${String(target).padStart(3)}: ${count.toLocaleString('en-US')} combinations`);
  }
  return lines.join('\n');
}
