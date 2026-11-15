// Hand evaluation: finds the card patterns that the scoring rules pay for.
//
// Every function takes an array of cards and works by *position* in that
// array. Two different fives are two different cards, and so is the same card
// typed twice in practice mode. Nothing in this module awards points;
// scoring.js turns these patterns into a score.
const { RANKS } = require('./cards');

const FIFTEEN = 15;
const MIN_RUN = 3;

/** Every two cards of the same rank, as [first, second] in hand order. */
function findPairs(cards) {
  const pairs = [];
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
function findRuns(cards) {
  const present = [...new Set(cards.map(card => card.order))].sort((a, b) => a - b);
  const runs = [];
  let current = [];
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
function smallFifteens(cards) {
  const found = [];
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
function findCombinations(cards, target = FIFTEEN) {
  throw new Error('Not implemented: findCombinations (Phase 2)');
}

/** How many combinations of cards add up to target. */
function countCombinations(cards, target = FIFTEEN) {
  return findCombinations(cards, target).length;
}

module.exports = { FIFTEEN, MIN_RUN, findPairs, findRuns, smallFifteens, findCombinations, countCombinations };
