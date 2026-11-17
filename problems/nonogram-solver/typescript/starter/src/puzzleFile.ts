// Reading and writing .non puzzle files.
//
// Contributors send puzzles as small text files:
//
//   # Pack 3, puzzle 7
//   title: Sailboat
//   author: R. Okafor
//   rows: 1 | 2 | 3 | 1 1
//   cols: 2 | 0 | 3 1
//
// Each field is `key: value` on its own line. `rows` and `cols` list one clue
// per line, separated by `|`; the numbers inside a clue are separated by
// spaces (commas are accepted too). `0` marks a line with no filled cells.
// Lines starting with `#` are comments.
import { readFileSync } from 'node:fs';
import { Puzzle, PuzzleError, formatClue } from './model.ts';
import type { Clue } from './model.ts';

const FIELDS = ['title', 'author', 'rows', 'cols'];

function parseClueList(value: string, field: string): Clue[] {
  return value.split('|').map((part, i) => {
    const tokens = part.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (!tokens.length) throw new PuzzleError(`${field}: clue ${i + 1} is blank (write 0 for an empty line)`);
    if (tokens.some(token => !/^\d+$/.test(token))) {
      throw new PuzzleError(`${field}: clue ${i + 1} ('${part.trim()}') is not a list of numbers`);
    }
    const numbers = tokens.map(Number);
    if (numbers.length === 1 && numbers[0] === 0) return [];
    if (numbers.includes(0)) throw new PuzzleError(`${field}: clue ${i + 1} mixes 0 with other blocks`);
    return numbers;
  });
}

/** Parse the contents of a .non file into a Puzzle. */
export function parsePuzzle(text: string): Puzzle {
  const fields: Record<string, string> = {};
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const colon = line.indexOf(':');
    const key = (colon < 0 ? line : line.slice(0, colon)).trim().toLowerCase();
    if (colon < 0 || !FIELDS.includes(key)) throw new PuzzleError(`line ${i + 1}: expected one of ${FIELDS.join(', ')} followed by ':'`);
    if (key in fields) throw new PuzzleError(`line ${i + 1}: ${key} is given twice`);
    fields[key] = line.slice(colon + 1).trim();
  });
  for (const required of ['rows', 'cols']) {
    if (!(required in fields)) throw new PuzzleError(`puzzle file has no ${required} field`);
  }
  return new Puzzle(parseClueList(fields.rows, 'rows'), parseClueList(fields.cols, 'cols'), {
    title: fields.title || 'Untitled',
    author: fields.author || null,
  });
}

/** Serialize a Puzzle in the .non format (round-trips through parsePuzzle). */
export function formatPuzzle(puzzle: Puzzle): string {
  const lines = [`title: ${puzzle.title}`];
  if (puzzle.author) lines.push(`author: ${puzzle.author}`);
  lines.push('rows: ' + puzzle.rowClues.map(formatClue).join(' | '));
  lines.push('cols: ' + puzzle.colClues.map(formatClue).join(' | '));
  return lines.join('\n') + '\n';
}

export function loadPuzzle(file: string | URL): Puzzle {
  return parsePuzzle(readFileSync(file, 'utf8'));
}
