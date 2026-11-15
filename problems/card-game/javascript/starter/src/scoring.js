// Scoring rules for Fifteens.
//
//   fifteens   2 points for every combination of cards adding up to 15
//   pairs      2 points for every two cards of the same rank
//   runs       1 point per rank in each run of three or more consecutive ranks
//
// During a match a player's hand is scored together with the round's turn-up
// card, so a four-card hand is scored as five cards.
const { formatCards } = require('./cards');
const { findPairs, findRuns, smallFifteens } = require('./evaluate');

const POINTS_PER_FIFTEEN = 2;
const POINTS_PER_PAIR = 2;
const POINTS_PER_RUN_RANK = 1;

/** What a hand scored, with the patterns behind each part of the score. */
class Score {
  constructor({ fifteens, pairs, runs }) {
    this.fifteens = fifteens; // card combinations adding up to 15
    this.pairs = pairs; //       [card, card] pairs of the same rank
    this.runs = runs; //         runs as rank symbols, e.g. ['3', '4', '5']
  }

  get fifteenPoints() {
    return POINTS_PER_FIFTEEN * this.fifteens.length;
  }

  get pairPoints() {
    return POINTS_PER_PAIR * this.pairs.length;
  }

  get runPoints() {
    return POINTS_PER_RUN_RANK * this.runs.reduce((sum, run) => sum + run.length, 0);
  }

  get total() {
    return this.fifteenPoints + this.pairPoints + this.runPoints;
  }
}

/** Score a hand (including the turn-up card, if there is one). */
function scoreHand(cards) {
  // TODO(FIF-31): count fifteens of every size, not just two and three cards.
  return new Score({ fifteens: smallFifteens(cards), pairs: findPairs(cards), runs: findRuns(cards) });
}

/** One-line summary for the table view, e.g. '8 pts: 15s x2, pair x1, run 3-4-5'. */
function describeScore(score) {
  const parts = [];
  if (score.fifteens.length) parts.push(`15s x${score.fifteens.length}`);
  if (score.pairs.length) parts.push(`pair x${score.pairs.length}`);
  for (const run of score.runs) parts.push(`run ${run.join('-')}`);
  return `${score.total} pts` + (parts.length ? `: ${parts.join(', ')}` : '');
}

/** The fifteens spelled out, e.g. '5H+JD, 5H+QC'. */
function describeFifteens(score) {
  return score.fifteens.map(combo => formatCards(combo).replace(/ /g, '+')).join(', ');
}

module.exports = { POINTS_PER_FIFTEEN, POINTS_PER_PAIR, POINTS_PER_RUN_RANK, Score, scoreHand, describeScore, describeFifteens };
