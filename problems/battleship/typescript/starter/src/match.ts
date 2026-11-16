// Match runner: plays a bot against a hidden fleet and reports the outcome.
import { Battle } from './battle.ts';
import { randomFleet } from './placer.ts';
import { DEFAULT_FLEET } from './ships.ts';
import type { Bot } from './bots.ts';
import type { Fleet } from './ships.ts';

/** Anything that builds a fresh bot for one match, such as the SeekerBot class. */
export type BotClass = new (size: number, shipSizes: readonly number[]) => Bot;

export class MatchReport {
  readonly bot: string;
  readonly shots: number;
  readonly won: boolean; // every ship sunk within the budget
  readonly repeats: number; // shots at cells that had already been fired at
  readonly battle: Battle;

  constructor(bot: string, shots: number, won: boolean, repeats: number, battle: Battle) {
    this.bot = bot;
    this.shots = shots;
    this.won = won;
    this.repeats = repeats;
    this.battle = battle;
  }

  summary(): string {
    const verdict = this.won ? 'sank the fleet' : 'did not sink the fleet';
    return `${this.bot} ${verdict} in ${this.shots} shots (${this.repeats} repeated)`;
  }
}

/**
 * Let bot fire until the fleet is sunk or the shot budget is spent.
 *
 * The bot only ever sees coordinates and ShotResults; it never gets the
 * fleet. The default budget is one shot per cell, which is enough for any
 * bot that never fires at the same cell twice.
 */
export function playMatch(bot: Bot, fleet: Fleet, budget: number | null = null): MatchReport {
  const battle = new Battle(fleet);
  const limit = budget === null ? fleet.ocean.size ** 2 : budget;
  while (!battle.fleetSunk && battle.shotsFired < limit) {
    const result = battle.fire(bot.nextShot());
    bot.observe(battle.log[battle.log.length - 1].coord, result);
  }
  return new MatchReport(bot.constructor.name, battle.shotsFired, battle.fleetSunk, battle.repeats, battle);
}

/**
 * Benchmark a bot class over seeded fleets. Each match gets a fresh
 * new BotClass(size, shipSizes). Returns a one-line summary for dashboards and the CLI.
 */
export function runSeries(BotClass: BotClass, seeds: Iterable<number>, size = 10, shipSizes: readonly number[] = DEFAULT_FLEET): string {
  const reports = [...seeds].map(seed => playMatch(new BotClass(size, shipSizes), randomFleet(seed, size, shipSizes)));
  const shots = reports.map(report => report.shots);
  const wins = reports.filter(report => report.won).length;
  const mean = shots.reduce((a, b) => a + b, 0) / shots.length;
  return `${reports[0].bot}: ${wins}/${reports.length} fleets sunk, ${mean.toFixed(1)} shots ` +
    `on average (best ${Math.min(...shots)}, worst ${Math.max(...shots)})`;
}
