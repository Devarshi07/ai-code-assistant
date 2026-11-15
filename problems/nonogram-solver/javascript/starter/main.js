// Demo: publish the designers' drawings, then build answer keys for contributor puzzles.
const fs = require('node:fs');
const path = require('node:path');
const { PuzzleError, parseGrid } = require('./src/model');
const { puzzleFromPicture } = require('./src/clues');
const { loadPuzzle } = require('./src/puzzleFile');
const { isSolution } = require('./src/verify');
const { render } = require('./src/render');
const { solve } = require('./src/solver');

const SAMPLES = path.join(__dirname, 'samples');
const DRAWINGS = ['heart.pic', 'mug.pic', 'lighthouse.pic'];
const CONTRIBUTED = ['sailboat.non', 'starfield.non'];

function publishDrawings() {
  console.log('== Publishing drawings ==');
  for (const name of DRAWINGS) {
    const base = name.replace(/\.pic$/, '');
    const title = base[0].toUpperCase() + base.slice(1);
    const picture = parseGrid(fs.readFileSync(path.join(SAMPLES, name), 'utf8'));
    let puzzle;
    try {
      puzzle = puzzleFromPicture(picture, { title });
    } catch (error) {
      if (!(error instanceof PuzzleError)) throw error;
      console.log(`${name}: cannot publish: ${error.message}\n`);
      continue;
    }
    const status = isSolution(puzzle, picture) ? 'ok' : 'drawing does not match its own clues';
    console.log(`${name}: ${puzzle.width}x${puzzle.height}, ${puzzle.filledCells} filled cells, self-check ${status}`);
    console.log(render(puzzle));
    console.log('');
  }
}

function buildAnswerKeys() {
  console.log('== Answer keys for contributed puzzles ==');
  for (const name of CONTRIBUTED) {
    const puzzle = loadPuzzle(path.join(SAMPLES, name));
    const started = performance.now();
    let grid;
    try {
      grid = solve(puzzle);
    } catch (error) {
      console.log(`${puzzle.title}: ${error.message}\n`);
      continue;
    }
    const elapsed = performance.now() - started;
    if (!grid) {
      console.log(`${puzzle.title}: no grid fits these clues\n`);
      continue;
    }
    const verdict = isSolution(puzzle, grid) ? 'verified' : 'FAILED verification';
    console.log(`${puzzle.title} by ${puzzle.author}: solved in ${elapsed.toFixed(1)} ms, ${verdict}`);
    console.log(render(puzzle, grid));
    console.log('');
  }
}

function main() {
  publishDrawings();
  buildAnswerKeys();
}

if (require.main === module) main();
