// Hand evaluation: finds the card patterns that the scoring rules pay for.
//
// Every function takes an array of cards and works by *position* in that
// array. Two different fives are two different cards, and so is the same card
// typed twice in practice mode. Nothing in this module awards points;
// scoring.ts turns these patterns into a score.
import { RANKS } from './cards.ts';
import type { Card, Rank } from './cards.ts';

export const FIFTEEN = 15;
export const MIN_RUN = 3;

/** Every two cards of the same rank, as [first, second] in hand order. */
export function findPairs(cards: readonly Card[]): [Card, Card][] {
  const pairs: [Card, Card][] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].rank === cards[j].rank) pairs.push([cards[i], cards[j]]);
    }
  }
  return pairs;
}

/**
 * Runs of three or more consecutive ranks, aces low, kings high, no wrap.
 *
 * Each run is reported once, as rank symbols from lowest to highest, and is
 * as long as possible. Repeated ranks don't make extra runs, so 3-4-4-5 holds
 * a single run of three.
 */
export function findRuns(cards: readonly Card[]): Rank[][] {
  const present = [...new Set(cards.map(card => card.order))].sort((a, b) => a - b);
  const runs: number[][] = [];
  let current: number[] = [];
  for (const order of present) {
    if (current.length && order !== current[current.length - 1] + 1) {
      if (current.length >= MIN_RUN) runs.push(current);
      current = [];
    }
    current.push(order);
  }
  if (current.length >= MIN_RUN) runs.push(current);
  return runs.map(run => run.map(order => RANKS[order - 1]));
}

/**
 * Every combination of one or more cards whose values add up to target.
 *
 * Each combination lists its cards in hand order. Combinations are ordered by
 * the positions of their cards, compared like words in a dictionary.
 *
 * Depth-first search over positions: the next card added always sits to the
 * right of the last one, which yields combinations in exactly that dictionary
 * order. Card values are positive, so a branch stops as soon as its total
 * reaches the target.
 */
export function findCombinations(cards: readonly Card[], target: number = FIFTEEN): Card[][] {
  const values = cards.map(card => card.value);
  const found: Card[][] = [];
  const chosen: number[] = [];

  function extend(start: number, total: number): void {
    for (let i = start; i < cards.length; i++) {
      const newTotal = total + values[i];
      if (newTotal > target) continue;
      chosen.push(i);
      if (newTotal === target) found.push(chosen.map(j => cards[j]));
      else extend(i + 1, newTotal);
      chosen.pop();
    }
  }

  if (target > 0) extend(0, 0);
  return found;
}

/**
 * How many combinations of cards add up to target.
 *
 * Subset-sum counting instead of listing: ways[t] is the number of
 * combinations of the cards seen so far that add up to t. Each new card either
 * stays out or joins a combination worth t - value. Totals are updated from
 * high to low so a card is never used twice in one pass.
 * O(cards.length * target) time and O(target) memory.
 *
 * Hands have at most 52 cards, so every count is below 2^52 and a plain
 * Float64Array holds it exactly (Int32Array/Uint32Array would overflow).
 */
export function countCombinations(cards: readonly Card[], target: number = FIFTEEN): number {
  if (!(target > 0)) return 0;
  const ways = new Float64Array(target + 1);
  ways[0] = 1; // the empty combination; never counted on its own because target > 0
  for (const card of cards) {
    const value = card.value;
    for (let total = target; total >= value; total--) ways[total] += ways[total - value];
  }
  return ways[target];
}
