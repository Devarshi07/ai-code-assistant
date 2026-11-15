// A standard 52-card deck with reproducible shuffles.
//
// Every match stores its seed. Support's replay tool rebuilds a disputed match
// from that seed, so a given seed must always produce the same deals, here and
// on the Python server alike. That is why the deck uses its own small
// generator instead of Math.random.
const { RANKS, SUITS, Card } = require('./cards');

// Fresh-deck order: clubs, diamonds, hearts, spades; ace to king in each suit.
const STANDARD_ORDER = SUITS.flatMap(suit => RANKS.map(rank => new Card(rank, suit)));

class DeckError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeckError';
  }
}

/**
 * 32-bit linear congruential generator (Numerical Recipes constants).
 * The Python server implements the same arithmetic, so both produce the same
 * sequence for the same seed.
 */
class SeededRandom {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  nextUint32() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state;
  }

  /** An integer in [0, n), taken from the high bits of the next value. */
  below(n) {
    return Math.floor((this.nextUint32() * n) / 4294967296);
  }
}

/** The cards not yet dealt, top of the deck first. */
class Deck {
  constructor(seed = 0) {
    this.seed = seed;
    this.rng = new SeededRandom(seed);
    this.reset();
  }

  /** Gather all 52 cards back into the deck, in fresh-deck order. */
  reset() {
    this.cards = [...STANDARD_ORDER];
  }

  /** Fisher-Yates shuffle of the cards currently in the deck. */
  shuffle() {
    const cards = this.cards;
    for (let i = cards.length - 1; i > 0; i--) {
      const j = this.rng.below(i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  /** Remove `count` cards from the top of the deck and return them. */
  deal(count = 1) {
    if (count > this.cards.length) {
      throw new DeckError(`cannot deal ${count} card(s), only ${this.cards.length} left`);
    }
    return this.cards.splice(0, count);
  }

  /** The cards still in the deck, top first (a copy). */
  peek() {
    return [...this.cards];
  }

  get size() {
    return this.cards.length;
  }

  toString() {
    return `Deck(seed=${this.seed}, ${this.size} cards left)`;
  }
}

module.exports = { STANDARD_ORDER, Deck, DeckError, SeededRandom };
