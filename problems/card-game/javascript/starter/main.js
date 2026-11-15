// Plays a seeded five-round match, then scores a few showcase hands.
const { formatCards, parseHand } = require('./src/cards');
const { Deck } = require('./src/deck');
const { Match } = require('./src/match');
const { scoreHand, describeScore, describeFifteens } = require('./src/scoring');
const { marathonCounts, formatMarathon } = require('./src/tournament');

const SHOWCASE = [
  ['5C 5D 5H JS', '5S'],
  ['AC 2D 3H 4S', '5C'],
  ['2H 3C 4D 6S', 'KH'],
];

function printMatch() {
  const match = new Match(['Ana', 'Ben', 'Cy'], { seed: 2024 });
  console.log(`Fifteens match, seed ${match.seed}: ${match.players.join(', ')}`);
  for (let i = 0; i < 5; i++) {
    const result = match.playRound();
    console.log(`\nRound ${result.number}   turn-up ${result.turnUp}`);
    for (const [name, hand] of Object.entries(result.hands)) {
      console.log(`  ${name.padEnd(4)} ${formatCards(hand).padEnd(14)} ${describeScore(result.scores[name])}`);
    }
  }
  console.log('\nStandings');
  match.standings().forEach(({ name, total }, index) => {
    console.log(`  ${index + 1}. ${name.padEnd(4)} ${String(total).padStart(3)}`);
  });
}

function printShowcase() {
  console.log('\nShowcase hands');
  for (const [handText, turnUp] of SHOWCASE) {
    const score = scoreHand([...parseHand(handText), ...parseHand(turnUp)]);
    console.log(`  ${handText} | ${turnUp}   ${describeScore(score)}`);
    if (score.fifteens.length) console.log(`    fifteens: ${describeFifteens(score)}`);
  }
}

function printMarathon() {
  console.log('');
  const fullDeck = new Deck().deal(52);
  try {
    console.log(formatMarathon(fullDeck, marathonCounts(fullDeck)));
  } catch (error) {
    console.log(`Marathon preview: ${error.message}`);
  }
}

function main() {
  printMatch();
  printShowcase();
  printMarathon();
}

if (require.main === module) main();
