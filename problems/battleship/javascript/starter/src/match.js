// Match runner: plays a bot against a hidden fleet and reports the outcome.
const { Battle } = require('./battle');
const { randomFleet } = require('./placer');
const { DEFAULT_FLEET } = require('./ships');

class MatchReport {
  constructor(bot, shots, won, repeats, battle) {
    this.bot = bot;
    this.shots = shots;
    this.won = won; // every ship sunk within the budget
    this.repeats = repeats; // shots at cells that had already been fired at
    this.battle = battle;
  }

  summary() {
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
function playMatch(bot, fleet, budget = null) {
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
function runSeries(BotClass, seeds, size = 10, shipSizes = DEFAULT_FLEET) {
  const reports = [...seeds].map(seed => playMatch(new BotClass(size, shipSizes), randomFleet(seed, size, shipSizes)));
  const shots = reports.map(report => report.shots);
  const wins = reports.filter(report => report.won).length;
  const mean = shots.reduce((a, b) => a + b, 0) / shots.length;
  return `${reports[0].bot}: ${wins}/${reports.length} fleets sunk, ${mean.toFixed(1)} shots ` +
    `on average (best ${Math.min(...shots)}, worst ${Math.max(...shots)})`;
}

module.exports = { MatchReport, playMatch, runSeries };
