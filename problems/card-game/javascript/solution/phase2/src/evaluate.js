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
function findCombinations(cards, target = FIFTEEN) {
  const values = cards.map(card => card.value);
  const found = [];
  const chosen = [];

  function extend(start, total) {
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

/** How many combinations of cards add up to target. */
function countCombinations(cards, target = FIFTEEN) {
  return findCombinations(cards, target).length;
}

module.exports = { FIFTEEN, MIN_RUN, findPairs, findRuns, findCombinations, countCombinations };
