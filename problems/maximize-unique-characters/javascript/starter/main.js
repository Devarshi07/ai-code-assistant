// Puzzle desk preview: checks this week's hand-picked boards and suggests the best board per theme.
const { Puzzle } = require('./src/models');
const { filterWords, loadWordList, themes } = require('./src/wordlist');
const { selectionProblems } = require('./src/validator');
const { bestSelection, playableWords } = require('./src/solver');
const { render } = require('./src/board');

// Boards the designers picked by hand for this week.
const SCHEDULE = [
  ['2026-10-12', 'kitchen', ['butter', 'fig', 'jam', 'wok']],
  ['2026-10-13', 'music', ['drum', 'harp', 'tempo', 'sax']],
  ['2026-10-14', 'animals', ['zebra', 'lynx', 'dog']],
  ['2026-10-15', 'garden', ['tulip', 'fern', 'moss']]
];

function main() {
  const words = loadWordList();
  console.log(`Loaded ${words.length} candidates in ${themes(words).length} themes, ${playableWords(words).length} playable spellings\n`);

  console.log('== Hand-picked boards');
  for (const [day, theme, picks] of SCHEDULE) {
    const puzzle = new Puzzle(day, theme, picks);
    console.log(render(puzzle));
    const problems = selectionProblems(puzzle.words);
    console.log('  status: ' + (problems.length ? 'REJECTED: ' + problems.join('; ') : 'ok'));
    console.log('');
  }

  console.log('== Suggested boards (difficulty 2 or easier)');
  for (const theme of themes(words)) {
    const candidates = filterWords(words, { theme, maxDifficulty: 2 });
    let best;
    try {
      best = bestSelection(candidates);
    } catch (error) {
      console.log(`  solver unavailable: ${error.message}`);
      break;
    }
    console.log(render(new Puzzle('next week', theme, best.words)));
    console.log(`  covers ${best.total} letters from ${candidates.length} candidates\n`);
  }
}

if (require.main === module) main();
