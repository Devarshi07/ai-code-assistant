// Playing-card models and the text notation used across the app.
//
// Cards are written rank first, then suit: "AC" is the ace of clubs, "10H"
// the ten of hearts and "QS" the queen of spades. "T" is accepted for ten
// because some older clients still send it. Hands travel as space- or
// comma-separated strings such as "5H 5S JD QC".

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['C', 'D', 'H', 'S'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export const SUIT_NAMES: Readonly<Record<Suit, string>> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };

// Jacks, queens and kings are worth ten when counting fifteens.
export const FACE_VALUE = 10;

export class CardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardError';
  }
}

export class Card {
  readonly rank: Rank;
  readonly suit: Suit;

  constructor(rank: Rank, suit: Suit) {
    this.rank = rank;
    this.suit = suit;
    Object.freeze(this);
  }

  /** Rank order used for runs and sorting: A=1, 2-10, J=11, Q=12, K=13. */
  get order(): number {
    return RANKS.indexOf(this.rank) + 1;
  }

  /** Counting value for fifteens: A=1, number cards at face value, J/Q/K=10. */
  get value(): number {
    return Math.min(this.order, FACE_VALUE);
  }

  get name(): string {
    return `${this.rank} of ${SUIT_NAMES[this.suit]}`;
  }

  equals(other: unknown): boolean {
    return other instanceof Card && other.rank === this.rank && other.suit === this.suit;
  }

  toString(): string {
    return this.rank + this.suit;
  }
}

const isRank = (text: string): text is Rank => (RANKS as readonly string[]).includes(text);
const isSuit = (text: string): text is Suit => (SUITS as readonly string[]).includes(text);

/** Parse one card such as "10H", "qs" or "AC". */
export function parseCard(text: string): Card {
  const token = String(text).trim().toUpperCase();
  let rank = token.slice(0, -1);
  const suit = token.slice(-1);
  if (rank === 'T') rank = '10';
  if (!isRank(rank) || !isSuit(suit)) throw new CardError(`not a card: '${text}'`);
  return new Card(rank, suit);
}

/**
 * Parse a hand written as "5H 5S JD" or "5H,5S,JD".
 * The order of the cards is kept: it is the order the player sees them in.
 */
export function parseHand(text: string): Card[] {
  return text.replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(parseCard);
}

export function formatCards(cards: readonly Card[]): string {
  return cards.map(String).join(' ');
}
