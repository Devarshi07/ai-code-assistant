import os
import time
import unittest

from nonogram import Puzzle, load_puzzle, parse_grid, puzzle_from_picture, solve
from tests.generator import random_picture

SAMPLES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "samples")
LIMIT = 0.5  # seconds per large puzzle


def runs(cells):
    """Independent run-length check, so these tests don't trust the verifier."""
    out, length = [], 0
    for cell in list(cells) + [0]:
        if cell == 1:
            length += 1
        elif length:
            out.append(length)
            length = 0
    return out


def assert_satisfies(test, puzzle, grid):
    test.assertIsNotNone(grid, "expected a solution")
    test.assertEqual(len(grid), puzzle.height, "wrong number of rows")
    for r, row in enumerate(grid):
        test.assertEqual(len(row), puzzle.width, f"row {r} has the wrong length")
        test.assertTrue(all(cell in (0, 1) for cell in row), f"row {r} has cells that are not FILLED/EMPTY")
        test.assertEqual(runs(row), puzzle.row_clues[r], f"row {r} does not match its clue")
    for c in range(puzzle.width):
        test.assertEqual(runs(row[c] for row in grid), puzzle.col_clues[c], f"column {c} does not match its clue")


def timed_solve(puzzle):
    started = time.perf_counter()
    grid = solve(puzzle)
    return grid, time.perf_counter() - started


class CorrectnessTests(unittest.TestCase):
    def test_contributor_samples_still_solve(self):
        for name in ("sailboat.non", "starfield.non"):
            with self.subTest(puzzle=name):
                puzzle = load_puzzle(os.path.join(SAMPLES, name))
                assert_satisfies(self, puzzle, solve(puzzle))

    def test_puzzle_where_line_logic_stalls(self):
        # Row-and-column deduction alone leaves most of this board unknown.
        picture = random_picture(66, 20, 20, 0.55)
        puzzle = puzzle_from_picture(picture)
        grid = solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, picture)

    def test_contradiction_found_deep_in_the_search(self):
        # Two row clues swapped by a contributor: the totals still agree, but no grid fits.
        puzzle = puzzle_from_picture(random_picture(66, 20, 20, 0.55))
        rows = puzzle.row_clues
        rows[6], rows[7] = rows[7], rows[6]
        self.assertIsNone(solve(Puzzle(rows, puzzle.col_clues)))

    def test_ambiguous_puzzle_returns_a_valid_grid(self):
        puzzle = Puzzle([[1, 1], [1, 1], [1, 1], [1, 1]], [[2], [2], [2], [2]])
        assert_satisfies(self, puzzle, solve(puzzle))


class ScaleTests(unittest.TestCase):
    def test_25x25_community_puzzle_is_fast(self):
        picture = random_picture(9, 25, 25, 0.58)
        puzzle = puzzle_from_picture(picture)
        grid, elapsed = timed_solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, picture)
        self.assertLess(elapsed, LIMIT, f"took {elapsed:.2f}s; a 25x25 puzzle must solve in under {LIMIT}s")

    def test_30x30_community_puzzle_is_fast(self):
        picture = random_picture(1, 30, 30, 0.6)
        puzzle = puzzle_from_picture(picture)
        grid, elapsed = timed_solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, picture)
        self.assertLess(elapsed, LIMIT, f"took {elapsed:.2f}s; a 30x30 puzzle must solve in under {LIMIT}s")


if __name__ == "__main__":
    unittest.main()
