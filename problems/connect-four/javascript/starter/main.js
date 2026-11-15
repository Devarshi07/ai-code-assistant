// Demo: replays a reported game, asks the computer for moves, checks the daily puzzles.
const { Board, NAMES } = require('./src/board');
const { Game } = require('./src/game');
const { chooseMove, solve } = require('./src/ai');
const { describeMove, render, renderGame } = require('./src/render');
const { DAILY_PUZZLES, OPENING, REPORTED_GAME } = require('./src/samples');

function attempt(label, fn) {
  try {
    return fn();
  } catch (error) {
    if (!error.message.startsWith('Not implemented')) throw error;
    console.log(`${label}: ${error.message}`);
    return undefined;
  }
}

function main() {
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
    const result = attempt('solver', () => solve(position, puzzle.plies));
    if (result !== undefined) {
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

if (require.main === module) main();
