import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Board } from '../src/board.ts';
import { chooseMove, solve } from '../src/ai.ts';
import { canForceWin, moveForcesWin } from './brute-force.ts';

// Positions as 1-based move strings (Red first). Columns in assertions are 0-based.
const WIN_OR_BLOCK = '171717'; // Red wins in column 1 (index 0); Yellow threatens column 7
const DIAGONAL_THREAT = '4534213322'; // Yellow threatens column 2 (index 1) along a falling diagonal
const POISONED_CENTRE = '6613572513'; // a disc in the centre lets Yellow win on top of it
const FORK = '216646'; // Red forks with column 5 (index 4): win in 3
const WIN_IN_3 = '3211275371645'; // Yellow wins in 3, only with column 1 (index 0)
const WIN_IN_5 = '36566312253'; // Red wins in 5 with column 3 (index 2); column 5 only wins in 7
const WIN_IN_5_TWO_WAYS = '4711574655'; // Red wins in 5 with either column 2 or 3 (index 1 or 2)
const CENTRE_IS_SLOWER = '431654242273522'; // the centre wins in 5, column 3 (index 2) wins in 3
const DOUBLE_THREAT = '131475'; // Yellow threatens columns 2 and 6; Red cannot stop both
const DRAWN = '444777176463166564635121577135541253322232';

function assertForcedWin(moves: string, maxPlies: number, plies: number, answers: number[]): void {
  const board = Board.fromMoves(moves);
  const result = solve(board, maxPlies);
  assert.ok(result, `${moves}: expected a win in ${plies}`);
  assert.equal(result.plies, plies, `${moves}: wrong distance`);
  assert.ok(answers.includes(result.move), `${moves}: column ${result.move + 1} does not win in ${plies}`);
  assert.ok(moveForcesWin(board.copy(), result.move, plies), 'the reported move does not force a win');
  assert.equal(board.toMoves(), moves, 'solve must not change the board');
}

describe('chooseMove', () => {
  test('takes a win before blocking', () => {
    assert.equal(chooseMove(Board.fromMoves(WIN_OR_BLOCK)), 0);
  });

  test('blocks the only threat', () => {
    assert.equal(chooseMove(Board.fromMoves(DIAGONAL_THREAT)), 1);
  });

  test('does not drop under an opponent threat', () => {
    const board = Board.fromMoves(POISONED_CENTRE);
    const move = chooseMove(board);
    assert.ok(board.legalMoves().includes(move));
    assert.notEqual(move, 3, 'column 4 lets Yellow complete four on top of it');
  });

  test('depth two already sees the reply', () => {
    assert.notEqual(chooseMove(Board.fromMoves(POISONED_CENTRE), 2), 3);
  });

  test('finds the fork', () => {
    assert.equal(chooseMove(Board.fromMoves(FORK)), 4, 'column 5 makes two threats at once');
  });

  test('opens in the centre', () => {
    assert.equal(chooseMove(new Board()), 3);
  });

  test('leaves the board unchanged', () => {
    const board = Board.fromMoves(FORK);
    const grid = board.toGrid();
    chooseMove(board);
    assert.equal(board.toGrid(), grid);
    assert.equal(board.toMoves(), FORK);
  });

  test('full board throws', () => {
    assert.throws(() => chooseMove(Board.fromMoves(DRAWN)));
  });
});

describe('solve', () => {
  test('immediate win is one ply', () => {
    assertForcedWin(WIN_OR_BLOCK, 5, 1, [0]);
  });

  test('win in three', () => {
    assertForcedWin(WIN_IN_3, 3, 3, [0]);
  });

  test('fork is a win in three', () => {
    assertForcedWin(FORK, 5, 3, [4]);
  });

  test('prefers the fastest win', () => {
    assertForcedWin(CENTRE_IS_SLOWER, 5, 3, [2]);
  });

  test('win in five', () => {
    assertForcedWin(WIN_IN_5, 5, 5, [2]);
  });

  test('win in five with two answers', () => {
    assertForcedWin(WIN_IN_5_TWO_WAYS, 5, 5, [1, 2]);
  });

  test('horizon too short means no win', () => {
    assert.equal(solve(Board.fromMoves(WIN_IN_5), 3), null);
    assert.equal(solve(Board.fromMoves(WIN_IN_3), 1), null);
  });

  test('losing side has no forced win', () => {
    const board = Board.fromMoves(DOUBLE_THREAT);
    assert.equal(canForceWin(board, 5), false);
    assert.equal(solve(board, 5), null);
  });

  test('quiet opening has no forced win', () => {
    assert.equal(solve(new Board(), 5), null);
  });

  test('full board has no forced win', () => {
    assert.equal(solve(Board.fromMoves(DRAWN), 5), null);
  });
});
