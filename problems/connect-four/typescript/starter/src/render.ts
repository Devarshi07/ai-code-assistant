// Plain-text rendering for the CLI, server logs and bug reports.
import type { Board } from './board.ts';
import type { Game } from './game.ts';
import type { Cell } from './rules.ts';

/**
 * The board as text, top row first, with the players' column numbers below.
 *
 * Discs whose [col, row] is in highlight, such as a winning line, are drawn in
 * lowercase so they stand out in a terminal.
 */
export function render(board: Board, highlight: Cell[] = []): string {
  const marked = new Set(highlight.map(([col, row]) => `${col},${row}`));
  const lines: string[] = [];
  for (let row = board.rows - 1; row >= 0; row--) {
    const cells: string[] = [];
    for (let col = 0; col < board.columns; col++) {
      const disc = board.cell(col, row);
      cells.push(marked.has(`${col},${row}`) ? disc.toLowerCase() : disc);
    }
    lines.push(`| ${cells.join(' ')} |`);
  }
  lines.push(`+${'-'.repeat(2 * board.columns + 1)}+`);
  lines.push(`  ${Array.from({ length: board.columns }, (_, col) => col + 1).join(' ')}`);
  return lines.join('\n');
}

/** The board with any winning line highlighted, followed by the status. */
export function renderGame(game: Game): string {
  return `${render(game.board, game.winningCells || [])}\n${game.status}`;
}

/** A column as players say it: describeMove(3) === 'column 4'. */
export function describeMove(col: number): string {
  return `column ${col + 1}`;
}
