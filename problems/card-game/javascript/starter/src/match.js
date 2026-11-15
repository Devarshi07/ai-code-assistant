// Round and match runner used by the game server.
//
// A match seats two to four players around one deck. Every round the dealer
// gathers and shuffles all 52 cards, deals the hands one card at a time in
// seating order, then turns up one more card. The turn-up counts as part of
// every player's hand when the round is scored.
const { Deck } = require('./deck');
const { scoreHand } = require('./scoring');

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

class MatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MatchError';
  }
}

/**
 * @typedef {object} RoundResult
 * @property {number} number   1 for the first round of the match
 * @property {Card} turnUp
 * @property {Object<string, Card[]>} hands   cards each player holds (turn-up not included)
 * @property {Object<string, Score>} scores   each player's hand scored with the turn-up
 */

class Match {
  constructor(players, { seed = 0, handSize = 4 } = {}) {
    players = [...players];
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      throw new MatchError(`a match needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
    }
    if (new Set(players).size !== players.length) throw new MatchError('player names must be unique');
    if (handSize < 1 || players.length * handSize + 1 > 52) {
      throw new MatchError(`cannot deal ${handSize} cards to ${players.length} players`);
    }
    this.players = players;
    this.seed = seed;
    this.handSize = handSize;
    this.deck = new Deck(seed);
    this.totals = Object.fromEntries(players.map(name => [name, 0]));
    /** @type {RoundResult[]} */
    this.rounds = [];
  }

  /** Shuffle the full deck and deal. Returns { hands, turnUp }. */
  dealRound() {
    this.deck.reset();
    this.deck.shuffle();
    const hands = Object.fromEntries(this.players.map(name => [name, []]));
    for (let i = 0; i < this.handSize; i++) {
      for (const name of this.players) hands[name].push(...this.deck.deal(1));
    }
    const [turnUp] = this.deck.deal(1);
    return { hands, turnUp };
  }

  /** @returns {RoundResult} */
  playRound() {
    const { hands, turnUp } = this.dealRound();
    const scores = {};
    for (const name of this.players) {
      scores[name] = scoreHand([...hands[name], turnUp]);
      this.totals[name] += scores[name].total;
    }
    const result = { number: this.rounds.length + 1, turnUp, hands, scores };
    this.rounds.push(result);
    return result;
  }

  /** Play `rounds` more rounds and return the standings. */
  play(rounds) {
    for (let i = 0; i < rounds; i++) this.playRound();
    return this.standings();
  }

  /** { name, total } entries, highest total first; ties keep seating order. */
  standings() {
    return this.players.map(name => ({ name, total: this.totals[name] })).sort((a, b) => b.total - a.total);
  }
}

module.exports = { Match, MatchError, MIN_PLAYERS, MAX_PLAYERS };
