import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { Board } from '../src/board.ts';
import { solve } from '../src/ai.ts';
import { canForceWin, moveForcesWin } from './brute-force.ts';

// Puzzles as 1-based move strings. Answers are 0-based columns: every column
// that wins in the stated number of plies, checked offline by exhaustive search.
const WIN_IN_7: [string, number[]][] = [
  ['164773774571', [3, 4, 5]],
  ['6361444236654215', [3, 4]],
];
const SLOW_WINS_FIRST = '2575261113446722'; // columns 4 and 5 win in 7; only column 1 wins in 5
const WIN_IN_9 = '6161344754142623353';
const DEFENDER = '1647737745714'; // Yellow to move after Red's winning first move

// Today's batch from the puzzle generator, easiest first: [moves, plies, answers].
const BATCH: [string, number, number[]][] = [
  ['657657347227', 9, [3]],
  ['7145742714611', 11, [4]],
  ['45321456414517', 11, [2]],
  ['7677526775225755', 11, [5]],
];
const BATCH_BUDGET_MS = 500;

describe('deep solve', () => {
  test('win in seven reports the exact distance', () => {
    for (const [moves, answers] of WIN_IN_7) {
      const board = Board.fromMoves(moves);
      const result = solve(board, 7);
      assert.ok(result, `${moves}: expected a win in 7`);
      assert.equal(result.plies, 7, `${moves}: wrong distance`);
      assert.ok(answers.includes(result.move), `${moves}: column ${result.move + 1} does not win in 7`);
      assert.ok(moveForcesWin(board.copy(), result.move, 7));
      assert.equal(canForceWin(board.copy(), 5), false, 'fixture check: no faster win exists');
    }
  });

  test('longer horizon still finds the fastest win', () => {
    const result = solve(Board.fromMoves(SLOW_WINS_FIRST), 9);
    assert.ok(result);
    assert.deepEqual([result.move, result.plies], [0, 5]);
  });

  test('deeper win is not reported inside a shorter horizon', () => {
    assert.equal(solve(Board.fromMoves(WIN_IN_9), 7), null);
  });

  test('defender has no forced win', () => {
    assert.equal(solve(Board.fromMoves(DEFENDER), 8), null);
  });

  test('puzzle batch is checked within budget', () => {
    let elapsed = 0;
    BATCH.forEach(([moves, plies, answers], index) => {
      const board = Board.fromMoves(moves);
      const start = performance.now();
      const result = solve(board, plies);
      elapsed += performance.now() - start;
      assert.ok(elapsed < BATCH_BUDGET_MS,
        `${elapsed.toFixed(0)}ms after ${index + 1} of ${BATCH.length} puzzles; the batch must be checked in under ${BATCH_BUDGET_MS}ms`);
      assert.ok(result, `${moves}: expected a win in ${plies}`);
      assert.equal(result.plies, plies, `${moves}: wrong distance`);
      assert.ok(answers.includes(result.move), `${moves}: column ${result.move + 1} does not win in ${plies}`);
      assert.equal(board.toMoves(), moves, 'solve must not change the board');
    });
  });
});
