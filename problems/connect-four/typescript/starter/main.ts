// Demo: replays a reported game, asks the computer for moves, checks the daily puzzles.
import { Board, NAMES } from './src/board.ts';
import { Game } from './src/game.ts';
import { chooseMove, solve } from './src/ai.ts';
import { describeMove, render, renderGame } from './src/render.ts';
import { DAILY_PUZZLES, OPENING, REPORTED_GAME } from './src/samples.ts';

function attempt<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('Not implemented')) throw error;
    console.log(`${label}: ${error.message}`);
    return undefined;
  }
}

function main(): void {
  console.log(`Reported game ${REPORTED_GAME}`);
  console.log(renderGame(Game.fromMoves(REPORTED_GAME)));
  console.log('');

  const board = Board.fromMoves(OPENING);
  console.log(`Opening ${OPENING}`);
  console.log(render(board));
  const col = attempt('computer', () => chooseMove(board));
  if (col !== undefined) console.log(`computer (${NAMES[board.toMove]}) plays ${describeMove(col)}`);
  console.log('');

  for (const puzzle of DAILY_PUZZLES) {
    const position = puzzle.board();
    console.log(`${puzzle.name} puzzle: ${NAMES[position.toMove]} to play and win in ${puzzle.plies}`);
    console.log(render(position));
    const outcome = attempt('solver', () => ({ result: solve(position, puzzle.plies) }));
    if (outcome !== undefined) {
      const { result } = outcome;
      console.log(`solver: ${result ? `${describeMove(result.move)} wins in ${result.plies} plies` : 'no forced win'}`);
    }
    console.log('');
  }

  const game = new Game();
  const finished = attempt('computer vs computer', () => {
    while (!game.isOver) game.play(chooseMove(game.board, 3));
    return true;
  });
  if (finished) {
    console.log(`Computer vs computer at depth 3: ${game.board.toMoves()}`);
    console.log(renderGame(game));
  }
}

main();
