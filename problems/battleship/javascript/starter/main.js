// Demo: a seeded fleet, a replayed bug report, and the reference bot.
const { ScriptedBot, SeekerBot } = require('./src/bots');
const { playMatch, runSeries } = require('./src/match');
const { label } = require('./src/ocean');
const { randomFleet } = require('./src/placer');
const { DEFAULT_FLEET } = require('./src/ships');

const SEED = 7;

// QA ticket #212: shots recorded from an experimental bot that got stuck
// re-firing at the same squares. It was replayed against the seed-7 fleet.
const STUCK_BOT_SHOTS = ['C5', 'A3', 'A3', 'A3', 'A3', 'A3', 'F7', 'F7', 'F7', 'F7',
  'D4', 'D4', 'D4', 'G5', 'G5', 'G5', 'F3', 'F3'];

function main() {
  const fleet = randomFleet(SEED);
  console.log(`Hidden fleet for seed ${SEED} (10x10):`);
  console.log(fleet.render());
  fleet.ships.forEach((ship, i) => {
    console.log(`  ${String.fromCharCode(65 + i)}  ${ship.name.padEnd(10)} ${ship.size} cells from ${label(ship.cells[0])}`);
  });
  console.log('');

  const replay = playMatch(new ScriptedBot(10, STUCK_BOT_SHOTS), randomFleet(SEED), STUCK_BOT_SHOTS.length);
  console.log('Replay of ticket #212:', replay.summary());
  console.log('  results:', replay.battle.log.map(record => record.result).join(' '));
  console.log('');

  let report;
  try {
    report = playMatch(new SeekerBot(10, DEFAULT_FLEET), randomFleet(SEED));
  } catch (error) {
    console.log(`SeekerBot: ${error.message}`);
    return;
  }
  console.log(report.summary());
  console.log(report.battle.chart());
  console.log('');
  console.log('Benchmark over seeds 1-50:');
  const seeds = Array.from({ length: 50 }, (_, i) => i + 1);
  console.log(' ', runSeries(SeekerBot, seeds));
}

if (require.main === module) main();
