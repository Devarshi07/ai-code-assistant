import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHand } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { findCombinations } from '../src/evaluate.ts';
import { scoreHand } from '../src/scoring.ts';
import { Match } from '../src/match.ts';

const PLAYERS = ['Ana', 'Ben', 'Cy'];

const names = (cards: readonly Card[]): string[] => cards.map(String);
const listed = (combos: readonly Card[][]): string[][] => combos.map(names);

/**
 * Checks every listed combination without trusting the code under test.
 *
 * Each combination must use cards from the hand, in hand order, and add up to
 * the target. The list must have no repeats and must be sorted by card
 * positions in dictionary order. (Needs a hand without repeated cards.)
 */
function assertValidCombinations(cards: readonly Card[], target: number, combos: readonly Card[][]): void {
  const position = new Map(cards.map((card, i) => [String(card), i]));
  assert.equal(position.size, cards.length, 'checker needs a hand without repeated cards');
  const seen: number[][] = [];
  for (const combo of combos) {
    assert.ok(combo.length > 0, 'a combination must hold at least one card');
    for (const card of combo) assert.ok(position.has(String(card)), `${card} is not in the hand`);
    const index = combo.map(card => position.get(String(card)) as number);
    assert.ok(index.every((p, i) => i === 0 || p > index[i - 1]), `${names(combo)} is not in hand order`);
    assert.equal(combo.reduce((sum, card) => sum + card.value, 0), target, `${names(combo)} doesn't add up to ${target}`);
    seen.push(index);
  }
  assert.equal(new Set(seen.map(String)).size, seen.length, 'a combination is listed twice');
  const dictionary = (a: number[], b: number[]): number => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  };
  assert.deepEqual(seen, [...seen].sort(dictionary), 'combinations are not in dictionary order of positions');
}

describe('findCombinations', () => {
  test('two-card fifteen', () => {
    assert.deepEqual(listed(findCombinations(parseHand('5H 10S'))), [['5H', '10S']]);
  });

  test('five-card fifteen', () => {
    assert.deepEqual(listed(findCombinations(parseHand('AC 2D 3H 4S 5C'))), [['AC', '2D', '3H', '4S', '5C']]);
  });

  test('two fives count separately', () => {
    const combos = findCombinations(parseHand('JH 5D 5S QC'));
    assert.deepEqual(listed(combos), [['JH', '5D'], ['JH', '5S'], ['5D', 'QC'], ['5S', 'QC']]);
  });

  test('combinations are listed in position order', () => {
    assert.deepEqual(listed(findCombinations(parseHand('7C 2D 6H 8S AD 5C'))), [
      ['7C', '2D', '6H'],
      ['7C', '2D', 'AD', '5C'],
      ['7C', '8S'],
      ['2D', '8S', '5C'],
      ['6H', '8S', 'AD'],
    ]);
  });

  test('mixed sizes with repeated ranks', () => {
    assert.deepEqual(listed(findCombinations(parseHand('9S 6D 3C 3H AS 2D'))), [
      ['9S', '6D'],
      ['9S', '3C', '3H'],
      ['9S', '3C', 'AS', '2D'],
      ['9S', '3H', 'AS', '2D'],
      ['6D', '3C', '3H', 'AS', '2D'],
    ]);
  });

  test('a card typed twice counts twice', () => {
    assert.deepEqual(listed(findCombinations(parseHand('8C 7H 8C'))), [['8C', '7H'], ['7H', '8C']]);
  });

  test('other targets', () => {
    assert.deepEqual(listed(findCombinations(parseHand('KD 4C 6H 10S'), 10)), [['KD'], ['4C', '6H'], ['10S']]);
    assert.deepEqual(listed(findCombinations(parseHand('3S 3D 9C 6H'), 21)), [['3S', '3D', '9C', '6H']]);
  });

  test('nothing adds up', () => {
    assert.deepEqual(findCombinations(parseHand('KC QD JH')), []);
    assert.deepEqual(findCombinations([]), []);
    assert.deepEqual(findCombinations(parseHand('5H 10S'), 0), [], 'only non-empty combinations count');
    assert.deepEqual(findCombinations(parseHand('5H 10S'), -5), []);
  });

  test('eight-card hand', () => {
    const cards = parseHand('4H 6C 5D 5S JC AH 9D 3S');
    const combos = findCombinations(cards);
    assert.equal(combos.length, 11);
    assertValidCombinations(cards, 15, combos);
  });

  test('sixteen-card practice hand', () => {
    const cards = parseHand('5C 2C QS 6S 7H AC 3S 3H QC AD JC 7D QD 6H 2S AH');
    const combos = findCombinations(cards);
    assert.equal(combos.length, 205);
    assertValidCombinations(cards, 15, combos);
  });

  test('returns the hand cards', () => {
    const cards = parseHand('6C 4D 5H 9S AC');
    const combos = findCombinations(cards);
    assert.deepEqual(listed(combos), [['6C', '4D', '5H'], ['6C', '9S'], ['5H', '9S', 'AC']]);
    assert.deepEqual(combos[1], [cards[0], cards[3]]);
  });
});

describe('scoreHand', () => {
  test('famous twenty-eight hand', () => {
    const score = scoreHand(parseHand('5C 5D 5H JS 5S'));
    assert.deepEqual([score.fifteens.length, score.pairs.length, score.runs], [8, 6, []]);
    assert.equal(score.total, 28);
  });

  test('fifteens of every size score', () => {
    const score = scoreHand(parseHand('2H 3C 4D 6S KH'));
    assert.deepEqual(listed(score.fifteens), [['2H', '3C', '4D', '6S'], ['2H', '3C', 'KH']]);
    assert.equal(score.total, 7);
    assert.equal(scoreHand(parseHand('AC 2D 3H 4S 5C')).total, 7);
  });

  test('eight-card hand total', () => {
    const score = scoreHand(parseHand('4H 6C 5D 5S JC AH 9D 3S'));
    assert.deepEqual([score.fifteenPoints, score.pairPoints, score.runPoints], [22, 2, 4]);
    assert.equal(score.total, 28);
  });

  test('seeded match standings', () => {
    const match = new Match(PLAYERS, { seed: 2024 });
    assert.deepEqual(match.play(5), [
      { name: 'Cy', total: 31 },
      { name: 'Ana', total: 24 },
      { name: 'Ben', total: 22 },
    ]);
    const last = match.rounds[match.rounds.length - 1];
    assert.deepEqual([...names(last.hands.Cy), String(last.turnUp)], ['3C', 'AS', '2S', '5D', '4S']);
    assert.equal(last.scores.Cy.total, 7, 'A-2-3-4-5 is a five-card fifteen plus a run of five');
  });
});
