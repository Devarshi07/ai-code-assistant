// Plays a seeded five-round match, then scores a few showcase hands.
import { formatCards, parseHand } from './src/cards.ts';
import { Deck } from './src/deck.ts';
import { Match } from './src/match.ts';
import { scoreHand, describeScore, describeFifteens } from './src/scoring.ts';
import { marathonCounts, formatMarathon } from './src/tournament.ts';

const SHOWCASE: [hand: string, turnUp: string][] = [
  ['5C 5D 5H JS', '5S'],
  ['AC 2D 3H 4S', '5C'],
  ['2H 3C 4D 6S', 'KH'],
];

function printMatch(): void {
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

function printShowcase(): void {
  console.log('\nShowcase hands');
  for (const [handText, turnUp] of SHOWCASE) {
    const score = scoreHand([...parseHand(handText), ...parseHand(turnUp)]);
    console.log(`  ${handText} | ${turnUp}   ${describeScore(score)}`);
    if (score.fifteens.length) console.log(`    fifteens: ${describeFifteens(score)}`);
  }
}

function printMarathon(): void {
  console.log('');
  const fullDeck = new Deck().deal(52);
  try {
    console.log(formatMarathon(fullDeck, marathonCounts(fullDeck)));
  } catch (error) {
    console.log(`Marathon preview: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function main(): void {
  printMatch();
  printShowcase();
  printMarathon();
}

main();
