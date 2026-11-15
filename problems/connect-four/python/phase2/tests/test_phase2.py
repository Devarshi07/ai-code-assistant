import unittest

from connect4 import Board, choose_move, solve
from tests.brute_force import can_force_win, move_forces_win

# Positions as 1-based move strings (Red first). Columns in assertions are 0-based.
WIN_OR_BLOCK = "171717"         # Red wins in column 1 (index 0); Yellow threatens column 7
DIAGONAL_THREAT = "4534213322"  # Yellow threatens column 2 (index 1) along a falling diagonal
POISONED_CENTRE = "6613572513"  # a disc in the centre lets Yellow win on top of it
FORK = "216646"                 # Red forks with column 5 (index 4): win in 3
WIN_IN_3 = "3211275371645"      # Yellow wins in 3, only with column 1 (index 0)
WIN_IN_5 = "36566312253"        # Red wins in 5 with column 3 (index 2); column 5 only wins in 7
WIN_IN_5_TWO_WAYS = "4711574655"  # Red wins in 5 with either column 2 or 3 (index 1 or 2)
CENTRE_IS_SLOWER = "431654242273522"  # the centre wins in 5, column 3 (index 2) wins in 3
DOUBLE_THREAT = "131475"        # Yellow threatens columns 2 and 6; Red cannot stop both
DRAWN = "444777176463166564635121577135541253322232"


class ChooseMoveTests(unittest.TestCase):
    def test_takes_a_win_before_blocking(self):
        board = Board.from_moves(WIN_OR_BLOCK)
        self.assertEqual(choose_move(board), 0)

    def test_blocks_the_only_threat(self):
        board = Board.from_moves(DIAGONAL_THREAT)
        self.assertEqual(choose_move(board), 1)

    def test_does_not_drop_under_an_opponent_threat(self):
        board = Board.from_moves(POISONED_CENTRE)
        move = choose_move(board)
        self.assertIn(move, board.legal_moves())
        self.assertNotEqual(move, 3, "column 4 lets Yellow complete four on top of it")

    def test_depth_two_already_sees_the_reply(self):
        board = Board.from_moves(POISONED_CENTRE)
        self.assertNotEqual(choose_move(board, depth=2), 3)

    def test_finds_the_fork(self):
        board = Board.from_moves(FORK)
        self.assertEqual(choose_move(board), 4, "column 5 makes two threats at once")

    def test_opens_in_the_centre(self):
        self.assertEqual(choose_move(Board()), 3)

    def test_leaves_the_board_unchanged(self):
        board = Board.from_moves(FORK)
        grid, moves = board.to_grid(), board.to_moves()
        choose_move(board)
        self.assertEqual(board.to_grid(), grid)
        self.assertEqual(board.to_moves(), moves)

    def test_full_board_raises(self):
        with self.assertRaises(ValueError):
            choose_move(Board.from_moves(DRAWN))


class SolveTests(unittest.TestCase):
    def assert_forced_win(self, moves, max_plies, plies, answers):
        board = Board.from_moves(moves)
        result = solve(board, max_plies)
        self.assertIsNotNone(result, f"{moves}: expected a win in {plies}")
        self.assertEqual(result.plies, plies, f"{moves}: wrong distance")
        self.assertIn(result.move, answers, f"{moves}: column {result.move + 1} does not win in {plies}")
        self.assertTrue(move_forces_win(board.copy(), result.move, plies), "the reported move does not force a win")
        self.assertEqual(board.to_moves(), moves, "solve must not change the board")

    def test_immediate_win_is_one_ply(self):
        self.assert_forced_win(WIN_OR_BLOCK, 5, 1, {0})

    def test_win_in_three(self):
        self.assert_forced_win(WIN_IN_3, 3, 3, {0})

    def test_fork_is_a_win_in_three(self):
        self.assert_forced_win(FORK, 5, 3, {4})

    def test_prefers_the_fastest_win(self):
        self.assert_forced_win(CENTRE_IS_SLOWER, 5, 3, {2})

    def test_win_in_five(self):
        self.assert_forced_win(WIN_IN_5, 5, 5, {2})

    def test_win_in_five_with_two_answers(self):
        self.assert_forced_win(WIN_IN_5_TWO_WAYS, 5, 5, {1, 2})

    def test_horizon_too_short_means_no_win(self):
        self.assertIsNone(solve(Board.from_moves(WIN_IN_5), 3))
        self.assertIsNone(solve(Board.from_moves(WIN_IN_3), 1))

    def test_losing_side_has_no_forced_win(self):
        board = Board.from_moves(DOUBLE_THREAT)
        self.assertFalse(can_force_win(board, 5))
        self.assertIsNone(solve(board, 5))

    def test_quiet_opening_has_no_forced_win(self):
        self.assertIsNone(solve(Board(), 5))

    def test_full_board_has_no_forced_win(self):
        self.assertIsNone(solve(Board.from_moves(DRAWN), 5))


if __name__ == "__main__":
    unittest.main()
