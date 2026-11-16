// Round and match runner used by the game server.
//
// A match seats two to four players around one deck. Every round the dealer
// gathers and shuffles all 52 cards, deals the hands one card at a time in
// seating order, then turns up one more card. The turn-up counts as part of
// every player's hand when the round is scored.
import type { Card } from './cards.ts';
import { Deck } from './deck.ts';
import { scoreHand } from './scoring.ts';
import type { Score } from './scoring.ts';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export class MatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchError';
  }
}

export interface RoundResult {
  number: number; //                 1 for the first round of the match
  turnUp: Card;
  hands: Record<string, Card[]>; //  cards each player holds (turn-up not included)
  scores: Record<string, Score>; //  each player's hand scored with the turn-up
}

export interface Standing {
  name: string;
  total: number;
}

export interface MatchOptions {
  seed?: number;
  handSize?: number;
}

export class Match {
  readonly players: string[];
  readonly seed: number;
  readonly handSize: number;
  readonly deck: Deck;
  readonly totals: Record<string, number>;
  readonly rounds: RoundResult[] = [];

  constructor(players: Iterable<string>, { seed = 0, handSize = 4 }: MatchOptions = {}) {
    const seated = [...players];
    if (seated.length < MIN_PLAYERS || seated.length > MAX_PLAYERS) {
      throw new MatchError(`a match needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
    }
    if (new Set(seated).size !== seated.length) throw new MatchError('player names must be unique');
    if (handSize < 1 || seated.length * handSize + 1 > 52) {
      throw new MatchError(`cannot deal ${handSize} cards to ${seated.length} players`);
    }
    this.players = seated;
    this.seed = seed;
    this.handSize = handSize;
    this.deck = new Deck(seed);
    this.totals = Object.fromEntries(seated.map(name => [name, 0]));
  }

  /** Shuffle the full deck and deal. */
  dealRound(): { hands: Record<string, Card[]>; turnUp: Card } {
    this.deck.reset();
    this.deck.shuffle();
    const hands: Record<string, Card[]> = Object.fromEntries(this.players.map(name => [name, []]));
    for (let i = 0; i < this.handSize; i++) {
      for (const name of this.players) hands[name].push(...this.deck.deal(1));
    }
    const [turnUp] = this.deck.deal(1);
    return { hands, turnUp };
  }

  playRound(): RoundResult {
    const { hands, turnUp } = this.dealRound();
    const scores: Record<string, Score> = {};
    for (const name of this.players) {
      scores[name] = scoreHand([...hands[name], turnUp]);
      this.totals[name] += scores[name].total;
    }
    const result: RoundResult = { number: this.rounds.length + 1, turnUp, hands, scores };
    this.rounds.push(result);
    return result;
  }

  /** Play `rounds` more rounds and return the standings. */
  play(rounds: number): Standing[] {
    for (let i = 0; i < rounds; i++) this.playRound();
    return this.standings();
  }

  /** Highest total first; ties keep seating order. */
  standings(): Standing[] {
    return this.players.map(name => ({ name, total: this.totals[name] })).sort((a, b) => b.total - a.total);
  }
}
