import os
import unittest

from nonogram import Puzzle, load_puzzle, parse_grid, puzzle_from_picture, solve

SAMPLES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "samples")

SAILBOAT = """
....#.....
....##....
....###...
....####..
....#####.
....#.....
##########
.########.
..######..
.#.#.#.#.#
"""

# Line-by-line logic stalls on this one almost immediately: a solver has to
# commit to a guess and back out of the wrong ones.
STARFIELD = """
#.....#.#.
#..#..##..
...#.#.###
#..#.#.##.
...#..#.##
....####.#
#..#..#...
.#.#...#.#
.#..###..#
###.#....#
"""


def sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return handle.read()


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


class SolveTests(unittest.TestCase):
    def test_heart(self):
        puzzle = Puzzle([[1, 1], [5], [5], [3], [1]], [[2], [4], [4], [4], [2]], title="Heart")
        grid = solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, parse_grid(sample("heart.pic")))

    def test_sailboat_answer_key(self):
        puzzle = load_puzzle(os.path.join(SAMPLES, "sailboat.non"))
        grid = solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, parse_grid(SAILBOAT))

    def test_starfield_needs_more_than_line_logic(self):
        puzzle = load_puzzle(os.path.join(SAMPLES, "starfield.non"))
        grid = solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, parse_grid(STARFIELD))

    def test_published_drawings_solve_back_to_the_drawing(self):
        for name in ("mug.pic", "lighthouse.pic"):
            with self.subTest(drawing=name):
                picture = parse_grid(sample(name))
                puzzle = puzzle_from_picture(picture)
                grid = solve(puzzle)
                assert_satisfies(self, puzzle, grid)
                self.assertEqual(grid, picture)

    def test_single_cell_puzzles(self):
        self.assertEqual(solve(Puzzle([[1]], [[1]])), [[1]])
        self.assertEqual(solve(Puzzle([[]], [[]])), [[0]])

    def test_full_and_empty_lines(self):
        puzzle = Puzzle([[4], [], [1, 1], [4]], [[1, 2], [1, 1], [1, 1], [1, 2]])
        grid = solve(puzzle)
        assert_satisfies(self, puzzle, grid)
        self.assertEqual(grid, [[1, 1, 1, 1], [0, 0, 0, 0], [1, 0, 0, 1], [1, 1, 1, 1]])

    def test_ambiguous_puzzle_returns_a_valid_grid(self):
        # Two diagonals both fit; either answer is acceptable.
        puzzle = Puzzle([[1], [1]], [[1], [1]])
        assert_satisfies(self, puzzle, solve(puzzle))

    def test_contradictory_clues_have_no_solution(self):
        # Totals agree, but each outer column needs two stacked cells while row 2 is empty.
        self.assertIsNone(solve(Puzzle([[1, 1], [], [1, 1]], [[2], [], [2]])))

    def test_solving_does_not_change_the_puzzle(self):
        puzzle = load_puzzle(os.path.join(SAMPLES, "sailboat.non"))
        rows, cols = [list(c) for c in puzzle.row_clues], [list(c) for c in puzzle.col_clues]
        solve(puzzle)
        self.assertEqual((puzzle.row_clues, puzzle.col_clues), (rows, cols))


if __name__ == "__main__":
    unittest.main()
