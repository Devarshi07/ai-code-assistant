// Text previews of a board for the puzzle desk and the CLI.
import { ALPHABET } from './letters.ts';
import type { Puzzle } from './models.ts';

/** 'AB.D..' style strip: upper-case letters are on the board, dots are unused. */
export function alphabetStrip(mask: number): string {
  return [...ALPHABET].map((ch, i) => (mask & (1 << i) ? ch.toUpperCase() : '.')).join('');
}

/** Header, word row and alphabet strip for one puzzle. */
export function render(puzzle: Puzzle): string {
  const words = puzzle.words.map(word => word.text.toUpperCase()).join('  ') || '(empty board)';
  return [
    `${puzzle.day}  ${puzzle.theme}: ${puzzle.tileCount} tiles`,
    `  ${words}`,
    `  [${alphabetStrip(puzzle.covered)}]  ${puzzle.unusedLetters.length} letters unused`
  ].join('\n');
}
