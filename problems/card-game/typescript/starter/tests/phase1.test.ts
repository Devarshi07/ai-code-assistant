import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CardError, parseCard, parseHand } from '../src/cards.ts';
import type { Card } from '../src/cards.ts';
import { Deck, DeckError } from '../src/deck.ts';
import { findPairs, findRuns } from '../src/evaluate.ts';
import { scoreHand } from '../src/scoring.ts';
import { Match } from '../src/match.ts';
import type { RoundResult } from '../src/match.ts';

const PLAYERS = ['Ana', 'Ben', 'Cy'];

const names = (cards: readonly Card[]): string[] => cards.map(String);

/** Every card on the table in a round: all hands plus the turn-up. */
function dealtCards(result: RoundResult): string[] {
  return [...Object.values(result.hands).flat(), result.turnUp].map(String);
}

describe('cards', () => {
  test('parses tens and face cards', () => {
    const ten = parseCard('10H');
    assert.deepEqual([ten.rank, ten.suit, ten.value], ['10', 'H', 10]);
    assert.equal(String(parseCard('qs')), 'QS');
    assert.equal(String(parseCard(' ac ')), 'AC');
    assert.equal(String(parseCard('TD')), '10D');
  });

  test('counting values and rank order', () => {
    const cards = parseHand('AC 7D 10S JH QC KD');
    assert.deepEqual(cards.map(card => card.value), [1, 7, 10, 10, 10, 10]);
    assert.deepEqual(cards.map(card => card.order), [1, 7, 10, 11, 12, 13]);
  });

  test('rejects unknown cards', () => {
    for (const text of ['1H', '11S', '5X', 'Z', '']) {
      assert.throws(() => parseCard(text), CardError, text);
    }
  });

  test('parseHand keeps order and accepts commas', () => {
    assert.deepEqual(names(parseHand('5H, 5S JD,QC')), ['5H', '5S', 'JD', 'QC']);
  });
});

describe('scoring', () => {
  test('pairs score two points each', () => {
    const cards = parseHand('7H 7S 7D 2C');
    assert.deepEqual(findPairs(cards).map(names), [['7H', '7S'], ['7H', '7D'], ['7S', '7D']]);
    assert.equal(scoreHand(cards).total, 6);
  });

  test('runs score one point per rank', () => {
    assert.deepEqual(findRuns(parseHand('9C 10D JH QS KD')), [['9', '10', 'J', 'Q', 'K']]);
    assert.deepEqual(findRuns(parseHand('3C 4D 4H 5S 9C')), [['3', '4', '5']]);
    assert.deepEqual(findRuns(parseHand('QC KD AH 2S')), [], "runs don't wrap from king to ace");
  });

  test('face cards make fifteen with a five', () => {
    const score = scoreHand(parseHand('KH 5D'));
    assert.deepEqual(score.fifteens.map(names), [['KH', '5D']]);
    assert.equal(score.total, 2);
  });

  test('mixed hand breakdown', () => {
    const score = scoreHand(parseHand('QD 3S 4H 5C 5S'));
    assert.deepEqual([score.fifteenPoints, score.pairPoints, score.runPoints], [4, 2, 3]);
    assert.equal(score.total, 9);
  });
});

describe('deck', () => {
  test('new deck holds all 52 cards', () => {
    const deck = new Deck(1);
    assert.equal(deck.size, 52);
    const cards = names(deck.deal(52));
    assert.equal(new Set(cards).size, 52);
    assert.deepEqual(cards.slice(0, 3), ['AC', '2C', '3C'], 'an unshuffled deck is in fresh-deck order');
    assert.throws(() => deck.deal(1), DeckError);
  });

  test('dealt cards leave the deck', () => {
    const deck = new Deck(5);
    deck.shuffle();
    const hand = names(deck.deal(5));
    assert.equal(deck.size, 47);
    const rest = new Set(names(deck.peek()));
    assert.ok(hand.every(card => !rest.has(card)), 'a dealt card is still in the deck');
  });

  test('reset brings every card back', () => {
    const deck = new Deck(8);
    deck.shuffle();
    deck.deal(20);
    deck.reset();
    assert.equal(deck.size, 52);
    assert.equal(new Set(names(deck.peek())).size, 52);
  });

  test('seeded shuffle matches the replay log', () => {
    const deck = new Deck(42);
    deck.shuffle();
    assert.deepEqual(names(deck.deal(6)), ['5H', '9S', '9C', 'JS', '3C', '2D']);
  });

  test('same seed gives the same deal', () => {
    const first = new Deck(7);
    const second = new Deck(7);
    first.shuffle();
    second.shuffle();
    assert.deepEqual(names(first.deal(5)), names(second.deal(5)));
  });
});

describe('match', () => {
  test('round deals distinct cards', () => {
    const result = new Match(PLAYERS, { seed: 3 }).playRound();
    assert.deepEqual(Object.values(result.hands).map(hand => hand.length), [4, 4, 4]);
    assert.equal(new Set(dealtCards(result)).size, 13, 'the same card was dealt twice in one round');
  });

  test('first rounds match the replay log', () => {
    const match = new Match(['Ana', 'Ben'], { seed: 4412 });
    const first = match.playRound();
    assert.deepEqual(names(first.hands.Ana), ['KH', '3C', '10C', '6S']);
    assert.deepEqual(names(first.hands.Ben), ['8C', '7C', '8D', '8H']);
    assert.equal(String(first.turnUp), '5D');
    const second = match.playRound();
    assert.deepEqual(names(second.hands.Ana), ['4C', '2S', '7S', 'JH']);
    assert.deepEqual(names(second.hands.Ben), ['6C', 'AH', 'JS', '9H']);
    assert.equal(String(second.turnUp), '4H');
  });

  test('long match uses the full deck every round', () => {
    const match = new Match(PLAYERS, { seed: 11 });
    match.play(8);
    assert.equal(match.rounds.length, 8);
    for (const result of match.rounds) {
      assert.equal(new Set(dealtCards(result)).size, 13, `round ${result.number} reused a card`);
    }
    const scored = match.rounds.flatMap(result => Object.values(result.scores)).reduce((sum, score) => sum + score.total, 0);
    assert.equal(Object.values(match.totals).reduce((a, b) => a + b, 0), scored);
  });

  test('replaying a seed reproduces the match', () => {
    const original = new Match(PLAYERS, { seed: 2024 });
    original.play(3);
    const replay = new Match(PLAYERS, { seed: 2024 });
    replay.play(3);
    original.rounds.forEach((before, i) => {
      const after = replay.rounds[i];
      for (const name of PLAYERS) assert.deepEqual(names(before.hands[name]), names(after.hands[name]), `round ${before.number}, ${name}`);
      assert.equal(String(before.turnUp), String(after.turnUp));
    });
    assert.deepEqual(original.standings(), replay.standings());
  });
});
