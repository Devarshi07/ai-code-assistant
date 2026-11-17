import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, BoardError, RED, YELLOW } from '../src/board.ts';
import type { Player } from '../src/board.ts';
import { Game, GameError } from '../src/game.ts';
import { winningColumns } from '../src/rules.ts';
import type { Cell } from '../src/rules.ts';

// Move logs (1-based columns, Red first). Each one ends on the winning disc.
const HORIZONTAL = '1122334';
const VERTICAL = '1212121';
const RISING = '12234334744'; // Red: columns 1-4, climbing to the right
const FALLING = '76654554144'; // Red: column 4 row 4 down to column 7 row 1
const FALLING_MIDDLE = '76654414455'; // same line, but the last disc lands in the middle of it
const REPORTED = '453421332272'; // support ticket: Yellow, column 2 down to column 5

// A saved position from the tournament archive (Red to move by disc count).
const SAVED = `
.......
.......
.Y.....
.YY....
.RRY...
YRRRY.R
`;

// A complete game that fills the board without anyone connecting four.
const DRAWN = '444777176463166564635121577135541253322232';

const sortCells = (cells: Cell[]): Cell[] => [...cells].map(([c, r]): Cell => [c, r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

function assertWon(game: Game, winner: Player, cells: Cell[]): void {
  assert.equal(game.winner, winner, `${game.status}: expected ${winner} to have won`);
  assert.ok(game.isOver);
  assert.deepEqual(sortCells(game.winningCells ?? []), sortCells(cells));
}

describe('board', () => {
  test('discs stack from the bottom', () => {
    const board = Board.fromMoves('4453');
    assert.equal(board.cell(3, 0), RED);
    assert.equal(board.cell(3, 1), YELLOW);
    assert.equal(board.cell(4, 0), RED);
    assert.equal(board.cell(2, 0), YELLOW);
    assert.equal(board.height(3), 2);
    assert.equal(board.toMove, RED);
  });

  test('full column rejects a seventh disc', () => {
    const board = Board.fromMoves('444444');
    assert.equal(board.canPlay(3), false);
    assert.ok(!board.legalMoves().includes(3));
    assert.throws(() => board.drop(3), BoardError);
  });

  test('undo restores the position and the turn', () => {
    const board = Board.fromMoves('4453');
    const before = board.toGrid();
    board.drop(0);
    assert.equal(board.toMove, YELLOW);
    assert.equal(board.undo(), 0);
    assert.equal(board.toGrid(), before);
    assert.equal(board.toMove, RED);
    assert.equal(board.toMoves(), '4453');
  });

  test('grid round trip keeps the side to move', () => {
    const board = Board.fromMoves('44536');
    const loaded = Board.fromGrid(board.toGrid());
    assert.equal(loaded.toGrid(), board.toGrid());
    assert.equal(loaded.toMove, YELLOW);
    assert.deepEqual(loaded.legalMoves(), [0, 1, 2, 3, 4, 5, 6]);
  });

  test('grid with a floating disc is rejected', () => {
    assert.throws(() => Board.fromGrid('....\n....\n.R..\n.Y..\n....\n....'), BoardError);
  });
});

describe('game', () => {
  test('horizontal four wins', () => {
    assertWon(Game.fromMoves(HORIZONTAL), RED, [[0, 0], [1, 0], [2, 0], [3, 0]]);
  });

  test('vertical four wins', () => {
    assertWon(Game.fromMoves(VERTICAL), RED, [[0, 0], [0, 1], [0, 2], [0, 3]]);
  });

  test('rising diagonal wins', () => {
    assertWon(Game.fromMoves(RISING), RED, [[0, 0], [1, 1], [2, 2], [3, 3]]);
  });

  test('falling diagonal wins', () => {
    assertWon(Game.fromMoves(FALLING), RED, [[3, 3], [4, 2], [5, 1], [6, 0]]);
  });

  test('falling diagonal completed in the middle', () => {
    assertWon(Game.fromMoves(FALLING_MIDDLE), RED, [[3, 3], [4, 2], [5, 1], [6, 0]]);
  });

  test('reported game ends with yellow\'s diagonal', () => {
    const game = Game.fromMoves(REPORTED);
    assertWon(game, YELLOW, [[1, 3], [2, 2], [3, 1], [4, 0]]);
    assert.equal(game.status, 'Yellow wins');
  });

  test('saved position shows the winner', () => {
    const game = Game.fromGrid(SAVED);
    assert.equal(game.winner, YELLOW, `loaded position says '${game.status}'`);
    assert.deepEqual(game.legalMoves(), []);
  });

  test('no moves after the game is won', () => {
    const game = Game.fromMoves(HORIZONTAL);
    assert.throws(() => game.play(4), GameError);
  });

  test('undo reopens a won game', () => {
    const game = Game.fromMoves(VERTICAL);
    game.undo();
    assert.equal(game.winner, null);
    assert.equal(game.toMove, RED);
  });

  test('full board without four is a draw', () => {
    const game = Game.fromMoves(DRAWN);
    assert.equal(game.winner, null);
    assert.ok(game.isOver);
    assert.equal(game.status, 'Draw');
  });
});

describe('threats', () => {
  test('hint spots a diagonal threat', () => {
    // Yellow needs column 2 to finish the diagonal from the ticket.
    const board = Board.fromMoves(REPORTED.slice(0, -2));
    assert.equal(board.toMove, RED);
    assert.deepEqual(winningColumns(board, YELLOW), [1]);
    assert.deepEqual(winningColumns(board, RED), []);
  });
});
