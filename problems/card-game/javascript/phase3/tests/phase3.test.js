const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { RANKS, SUITS, parseHand } = require('../src/cards');
const { countCombinations, findCombinations } = require('../src/evaluate');

// Every expected count in this file was checked two independent ways:
// enumerating all subsets (for the hands of up to 18 cards) and summing
// binomial coefficients over how many cards of each value are used.

const FULL_DECK = parseHand(SUITS.flatMap(suit => RANKS.map(rank => rank + suit)).join(' '));
const MARATHON_40 = parseHand(
  '2D 2H 9D KH 10C 8S JH 4C 3H 9H 6D 2S KD 10S 3C 7D 6C QH 7C 9C ' +
  'QS 4D 10D 2C 4S 5C 6S JD 10H 4H 3S KS KC AC AS JS 5S 3D 5D 7H');
const MARATHON_30 = parseHand(
  '3D QH 4C KC KH JD 2D 10S 6H 3H QS 9C 9H JC 6S JH 4S 8S 3S 3C ' +
  'AS 5S QC 2C 2H 8C 5D JS QD 5H');

const MEDIUM_HANDS = [
  ['7D 3S 8H 5S 9D KC AC 9H 7C 10H AD 3D', { 15: 25, 21: 64, 31: 119, 40: 124 }],
  ['KH 4H KD KS 10S 9D 6D QD JD 10C 6H QH 5D 5S', { 15: 22, 21: 35, 31: 137, 40: 422 }],
  ['JS JD KD 8S QD KH AC 8D 4H 5H QS 2H JC 10S 7S 9S', { 15: 25, 21: 79, 31: 291, 40: 723 }],
  ['6C 5S 9S KS 3H 6D 8C 8H JS 10C KD 9D AH QH 2H KC 5C 8S', { 15: 47, 21: 175, 31: 773, 40: 2078 }],
  // A practice-mode hand with repeated cards: every position counts.
  ['5H 5H 10S 5H JD AC AC 4S 6D 6D 9C 5H KS 2C', { 15: 64, 21: 199, 31: 453, 40: 459 }],
];

// One tournament round: the targets called at the table, in order.
const MARATHON_ROUND = [
  [FULL_DECK, 15, 17264],
  [FULL_DECK, 25, 746736],
  [FULL_DECK, 31, 5011024],
  [FULL_DECK, 100, 1864192096504],
  [FULL_DECK, 170, 68141176483932],
  [FULL_DECK, 200, 35865475414775],
  [MARATHON_40, 77, 1471665517],
  [MARATHON_30, 120, 12473861],
];
const ROUND_BUDGET_MS = 50; // for the whole round

describe('countCombinations', () => {
  test('count matches the listing on normal hands', () => {
    for (const text of ['JH 5D 5S QC', '7C 2D 6H 8S AD 5C', '4H 6C 5D 5S JC AH 9D 3S']) {
      const cards = parseHand(text);
      assert.equal(countCombinations(cards), findCombinations(cards).length, text);
    }
    assert.equal(countCombinations(parseHand('KD 4C 6H 10S'), 10), 3);
  });

  test('medium hands match brute force', () => {
    for (const [text, expected] of MEDIUM_HANDS) {
      const cards = parseHand(text);
      for (const [target, count] of Object.entries(expected)) {
        assert.equal(countCombinations(cards, Number(target)), count, `${text}, target ${target}`);
      }
    }
  });

  test('edge cases', () => {
    const fives = parseHand('5H 5H 5H 5H');
    assert.deepEqual([5, 10, 15, 20, 25].map(t => countCombinations(fives, t)), [4, 6, 4, 1, 0]);
    assert.equal(countCombinations([], 15), 0);
    assert.equal(countCombinations(parseHand('KH'), 10), 1);
    assert.equal(countCombinations(parseHand('5H 10S'), 0), 0, 'the empty combination never counts');
    assert.equal(countCombinations(parseHand('5H 10S'), -4), 0);
  });

  test('marathon round is fast and exact', () => {
    const start = performance.now();
    for (const [cards, target, expected] of MARATHON_ROUND) {
      const count = countCombinations(cards, target);
      const elapsed = performance.now() - start;
      // Checked after every call, so a slow solution fails quickly instead of
      // running for hours on the bigger targets.
      assert.ok(elapsed < ROUND_BUDGET_MS,
        `took ${elapsed.toFixed(0)}ms to get through target ${target} (${cards.length} cards); ` +
        `the whole marathon round must finish in under ${ROUND_BUDGET_MS}ms`);
      assert.equal(count, expected, `${cards.length}-card hand, target ${target}`);
    }
  });
});
