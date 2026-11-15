import time
import unittest

from connect4 import Board, solve
from tests.brute_force import can_force_win, move_forces_win

# Puzzles as 1-based move strings. Answers are 0-based columns: every column
# that wins in the stated number of plies, checked offline by exhaustive search.
WIN_IN_7 = [
    ("164773774571", {3, 4, 5}),
    ("6361444236654215", {3, 4}),
]
SLOW_WINS_FIRST = "2575261113446722"  # columns 4 and 5 win in 7; only column 1 wins in 5
WIN_IN_9 = "6161344754142623353"
DEFENDER = "1647737745714"        # Yellow to move after Red's winning first move

# Today's batch from the puzzle generator, easiest first: (moves, plies, answers).
BATCH = [
    ("31615173636666245717", 9, {4}),
    ("6563735724123", 11, {3}),
    ("6672166367261", 11, {3}),
]
BATCH_BUDGET = 0.6   # seconds for the whole batch


class DeepSolveTests(unittest.TestCase):
    def test_win_in_seven_reports_the_exact_distance(self):
        for moves, answers in WIN_IN_7:
            with self.subTest(moves=moves):
                board = Board.from_moves(moves)
                result = solve(board, 7)
                self.assertIsNotNone(result)
                self.assertEqual(result.plies, 7)
                self.assertIn(result.move, answers)
                self.assertTrue(move_forces_win(board.copy(), result.move, 7))
                self.assertFalse(can_force_win(board.copy(), 5), "fixture check: no faster win exists")

    def test_longer_horizon_still_finds_the_fastest_win(self):
        result = solve(Board.from_moves(SLOW_WINS_FIRST), 7)
        self.assertIsNotNone(result)
        self.assertEqual((result.move, result.plies), (0, 5))

    def test_deeper_win_is_not_reported_inside_a_shorter_horizon(self):
        self.assertIsNone(solve(Board.from_moves(WIN_IN_9), 7))

    def test_defender_has_no_forced_win(self):
        self.assertIsNone(solve(Board.from_moves(DEFENDER), 6))

    def test_puzzle_batch_is_checked_within_budget(self):
        elapsed = 0.0
        for index, (moves, plies, answers) in enumerate(BATCH, 1):
            board = Board.from_moves(moves)
            start = time.perf_counter()
            result = solve(board, plies)
            elapsed += time.perf_counter() - start
            self.assertLess(elapsed, BATCH_BUDGET,
                            f"{elapsed:.2f}s after {index} of {len(BATCH)} puzzles; "
                            f"the batch must be checked in under {BATCH_BUDGET}s")
            self.assertIsNotNone(result, f"{moves}: expected a win in {plies}")
            self.assertEqual(result.plies, plies, f"{moves}: wrong distance")
            self.assertIn(result.move, answers, f"{moves}: column {result.move + 1} does not win in {plies}")
            self.assertEqual(board.to_moves(), moves, "solve must not change the board")


if __name__ == "__main__":
    unittest.main()
