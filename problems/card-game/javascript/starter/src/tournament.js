// Tournament marathon mode.
//
// In tournament finals the cards are not dealt into small hands. A marathon
// hand of up to a full deck is spread face up and the table calls bonus
// targets such as 15, 31 or 100. For every target the scoreboard shows how
// many combinations of cards (by position, as everywhere else) add up to it.
// Only the counts are needed; nobody wants the combinations listed.
const { formatCards } = require('./cards');
const { FIFTEEN, countCombinations } = require('./evaluate');

// Marathon hands come from a single deck.
const MAX_MARATHON_CARDS = 52;
const MAX_TARGET = 200;

/** Map each target to the number of combinations of cards adding up to it. */
function marathonCounts(cards, targets = [FIFTEEN]) {
  if (cards.length > MAX_MARATHON_CARDS) throw new RangeError(`a marathon hand has at most ${MAX_MARATHON_CARDS} cards`);
  for (const target of targets) {
    if (!(target >= 1 && target <= MAX_TARGET)) throw new RangeError(`targets must be between 1 and ${MAX_TARGET}`);
  }
  const counts = new Map();
  for (const target of targets) counts.set(target, countCombinations(cards, target));
  return counts;
}

function formatMarathon(cards, counts) {
  const lines = [`Marathon hand (${cards.length} cards): ${formatCards(cards.slice(0, 8))}${cards.length > 8 ? ' ...' : ''}`];
  for (const [target, count] of counts) {
    lines.push(`  target ${String(target).padStart(3)}: ${count.toLocaleString('en-US')} combinations`);
  }
  return lines.join('\n');
}

module.exports = { MAX_MARATHON_CARDS, MAX_TARGET, marathonCounts, formatMarathon };
