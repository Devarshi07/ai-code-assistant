// Playing-card models and the text notation used across the app.
//
// Cards are written rank first, then suit: "AC" is the ace of clubs, "10H"
// the ten of hearts and "QS" the queen of spades. "T" is accepted for ten
// because some older clients still send it. Hands travel as space- or
// comma-separated strings such as "5H 5S JD QC".

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['C', 'D', 'H', 'S'];
const SUIT_NAMES = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };

// Jacks, queens and kings are worth ten when counting fifteens.
const FACE_VALUE = 10;

class CardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CardError';
  }
}

class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
    Object.freeze(this);
  }

  /** Rank order used for runs and sorting: A=1, 2-10, J=11, Q=12, K=13. */
  get order() {
    return RANKS.indexOf(this.rank) + 1;
  }

  /** Counting value for fifteens: A=1, number cards at face value, J/Q/K=10. */
  get value() {
    return Math.min(this.order, FACE_VALUE);
  }

  get name() {
    return `${this.rank} of ${SUIT_NAMES[this.suit]}`;
  }

  equals(other) {
    return other instanceof Card && other.rank === this.rank && other.suit === this.suit;
  }

  toString() {
    return this.rank + this.suit;
  }
}

/** Parse one card such as "10H", "qs" or "AC". */
function parseCard(text) {
  const token = String(text).trim().toUpperCase();
  let rank = token.slice(0, -1);
  const suit = token.slice(-1);
  if (rank === 'T') rank = '10';
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) throw new CardError(`not a card: '${text}'`);
  return new Card(rank, suit);
}

/**
 * Parse a hand written as "5H 5S JD" or "5H,5S,JD".
 * The order of the cards is kept: it is the order the player sees them in.
 */
function parseHand(text) {
  return text.replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(parseCard);
}

function formatCards(cards) {
  return cards.map(String).join(' ');
}

module.exports = { RANKS, SUITS, SUIT_NAMES, FACE_VALUE, Card, CardError, parseCard, parseHand, formatCards };
