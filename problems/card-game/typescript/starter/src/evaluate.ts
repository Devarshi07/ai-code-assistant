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
 * Two- and three-card combinations worth fifteen, in hand order.
 *
 * This is the shortcut the v1 scorer shipped with. It misses fifteens that
 * need four or more cards, such as A-2-3-4-5 or 2-3-4-6.
 */
export function smallFifteens(cards: readonly Card[]): Card[][] {
  const found: Card[][] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const pairTotal = cards[i].value + cards[j].value;
      if (pairTotal === FIFTEEN) found.push([cards[i], cards[j]]);
      for (let k = j + 1; k < cards.length; k++) {
        if (pairTotal + cards[k].value === FIFTEEN) found.push([cards[i], cards[j], cards[k]]);
      }
    }
  }
  return found;
}

/**
 * Every combination of one or more cards whose values add up to target.
 *
 * Each combination lists its cards in hand order. Combinations are ordered by
 * the positions of their cards, compared like words in a dictionary.
 */
export function findCombinations(cards: readonly Card[], target: number = FIFTEEN): Card[][] {
  throw new Error('Not implemented: findCombinations (Phase 2)');
}

/** How many combinations of cards add up to target. */
export function countCombinations(cards: readonly Card[], target: number = FIFTEEN): number {
  return findCombinations(cards, target).length;
}
