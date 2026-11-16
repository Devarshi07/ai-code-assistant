// Scoring rules for Fifteens.
//
//   fifteens   2 points for every combination of cards adding up to 15
//   pairs      2 points for every two cards of the same rank
//   runs       1 point per rank in each run of three or more consecutive ranks
//
// During a match a player's hand is scored together with the round's turn-up
// card, so a four-card hand is scored as five cards.
import { formatCards } from './cards.ts';
import type { Card, Rank } from './cards.ts';
import { FIFTEEN, findCombinations, findPairs, findRuns } from './evaluate.ts';

export const POINTS_PER_FIFTEEN = 2;
export const POINTS_PER_PAIR = 2;
export const POINTS_PER_RUN_RANK = 1;

export interface ScoreParts {
  fifteens: Card[][]; //     card combinations adding up to 15
  pairs: [Card, Card][]; //  pairs of cards of the same rank
  runs: Rank[][]; //         runs as rank symbols, e.g. ['3', '4', '5']
}

/** What a hand scored, with the patterns behind each part of the score. */
export class Score implements ScoreParts {
  readonly fifteens: Card[][];
  readonly pairs: [Card, Card][];
  readonly runs: Rank[][];

  constructor({ fifteens, pairs, runs }: ScoreParts) {
    this.fifteens = fifteens;
    this.pairs = pairs;
    this.runs = runs;
  }

  get fifteenPoints(): number {
    return POINTS_PER_FIFTEEN * this.fifteens.length;
  }

  get pairPoints(): number {
    return POINTS_PER_PAIR * this.pairs.length;
  }

  get runPoints(): number {
    return POINTS_PER_RUN_RANK * this.runs.reduce((sum, run) => sum + run.length, 0);
  }

  get total(): number {
    return this.fifteenPoints + this.pairPoints + this.runPoints;
  }
}

/** Score a hand (including the turn-up card, if there is one). */
export function scoreHand(cards: readonly Card[]): Score {
  return new Score({ fifteens: findCombinations(cards, FIFTEEN), pairs: findPairs(cards), runs: findRuns(cards) });
}

/** One-line summary for the table view, e.g. '8 pts: 15s x2, pair x1, run 3-4-5'. */
export function describeScore(score: Score): string {
  const parts: string[] = [];
  if (score.fifteens.length) parts.push(`15s x${score.fifteens.length}`);
  if (score.pairs.length) parts.push(`pair x${score.pairs.length}`);
  for (const run of score.runs) parts.push(`run ${run.join('-')}`);
  return `${score.total} pts` + (parts.length ? `: ${parts.join(', ')}` : '');
}

/** The fifteens spelled out, e.g. '5H+JD, 5H+QC'. */
export function describeFifteens(score: Score): string {
  return score.fifteens.map(combo => formatCards(combo).replace(/ /g, '+')).join(', ');
}
