// Demo: publish the designers' drawings, then build answer keys for contributor puzzles.
import { readFileSync } from 'node:fs';
import { PuzzleError, parseGrid } from './src/model.ts';
import type { Puzzle } from './src/model.ts';
import { puzzleFromPicture } from './src/clues.ts';
import { loadPuzzle } from './src/puzzleFile.ts';
import { isSolution } from './src/verify.ts';
import { render } from './src/render.ts';
import { solve } from './src/solver.ts';

const sampleUrl = (name: string): URL => new URL(`./samples/${name}`, import.meta.url);
const DRAWINGS = ['heart.pic', 'mug.pic', 'lighthouse.pic'];
const CONTRIBUTED = ['sailboat.non', 'starfield.non'];

function publishDrawings(): void {
  console.log('== Publishing drawings ==');
  for (const name of DRAWINGS) {
    const base = name.replace(/\.pic$/, '');
    const title = base[0].toUpperCase() + base.slice(1);
    const picture = parseGrid(readFileSync(sampleUrl(name), 'utf8'));
    let puzzle: Puzzle;
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

function buildAnswerKeys(): void {
  console.log('== Answer keys for contributed puzzles ==');
  for (const name of CONTRIBUTED) {
    const puzzle = loadPuzzle(sampleUrl(name));
    const started = performance.now();
    let grid;
    try {
      grid = solve(puzzle);
    } catch (error) {
      console.log(`${puzzle.title}: ${(error as Error).message}\n`);
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

publishDrawings();
buildAnswerKeys();
