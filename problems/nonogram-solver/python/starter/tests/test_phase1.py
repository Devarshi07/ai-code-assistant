import os
import unittest

from nonogram import (Puzzle, PuzzleError, find_mismatches, format_puzzle, is_solution,
                      line_clue, load_puzzle, parse_grid, parse_puzzle, puzzle_from_picture, render)

SAMPLES = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "samples")

# A correct answer to samples/sailboat.non, checked by hand against every clue.
SAILBOAT_ANSWER = """
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


def sample(name):
    with open(os.path.join(SAMPLES, name), encoding="utf-8") as handle:
        return handle.read()


class LineClueTests(unittest.TestCase):
    def test_blocks_separated_by_gaps(self):
        self.assertEqual(line_clue([0, 1, 1, 0, 1, 0, 0]), [2, 1])

    def test_empty_line_has_empty_clue(self):
        self.assertEqual(line_clue([0, 0, 0, 0]), [])

    def test_long_and_short_blocks(self):
        self.assertEqual(line_clue([0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0]), [5, 1, 2])


class PublishingTests(unittest.TestCase):
    def test_mug_drawing_clues(self):
        puzzle = puzzle_from_picture(sample("mug.pic"), title="Mug")
        self.assertEqual((puzzle.width, puzzle.height), (10, 10))
        self.assertEqual(puzzle.row_clues, [[1, 1], [1, 1], [1, 1], [], [7], [1, 3], [1, 1, 1], [1, 3], [5], []])
        self.assertEqual(puzzle.col_clues, [[4], [1, 1, 1], [1, 1, 1, 1], [1, 1], [1, 1, 1],
                                            [1, 1, 1, 1], [4], [1, 1], [3], []])

    def test_heart_drawing_publishes(self):
        puzzle = puzzle_from_picture(sample("heart.pic"), title="Heart")
        self.assertEqual(puzzle.row_clues, [[1, 1], [5], [5], [3], [1]])
        self.assertEqual(puzzle.col_clues, [[2], [4], [4], [4], [2]])

    def test_lighthouse_drawing_publishes(self):
        puzzle = puzzle_from_picture(sample("lighthouse.pic"), title="Lighthouse")
        self.assertEqual((puzzle.width, puzzle.height), (12, 13))
        self.assertEqual(puzzle.row_clues, [[2], [4, 3], [1, 2], [4, 3], [2], [4], [1, 1], [4], [1, 1],
                                            [4], [6], [1, 8, 1], [12]])
        self.assertEqual(puzzle.col_clues, [[2], [1], [2], [3], [3, 8], [2, 3, 1, 4], [2, 3, 1, 4], [3, 8],
                                            [1, 3], [1, 1, 2], [1, 1, 1], [1, 1, 2]])
        self.assertEqual(puzzle.filled_cells, 65)


class VerifierTests(unittest.TestCase):
    def test_accepts_correct_sailboat_answer(self):
        puzzle = load_puzzle(os.path.join(SAMPLES, "sailboat.non"))
        answer = parse_grid(SAILBOAT_ANSWER)
        self.assertEqual(find_mismatches(puzzle, answer), [])
        self.assertTrue(is_solution(puzzle, answer))

    def test_drawing_solves_its_own_puzzle(self):
        picture = parse_grid(sample("mug.pic"))
        self.assertTrue(is_solution(puzzle_from_picture(picture), picture))

    def test_reports_exactly_the_wrong_lines(self):
        picture = parse_grid(sample("mug.pic"))
        puzzle = puzzle_from_picture(picture)
        picture[5][3] = 1
        problems = find_mismatches(puzzle, picture)
        self.assertEqual([(p.kind, p.index) for p in problems], [("row", 5), ("column", 3)])
        self.assertFalse(is_solution(puzzle, picture))

    def test_rejects_grid_of_the_wrong_shape(self):
        puzzle = puzzle_from_picture(sample("mug.pic"))
        self.assertFalse(is_solution(puzzle, parse_grid(sample("mug.pic"))[:-1]))


class PuzzleFileTests(unittest.TestCase):
    def test_reads_contributor_file(self):
        puzzle = load_puzzle(os.path.join(SAMPLES, "sailboat.non"))
        self.assertEqual((puzzle.title, puzzle.author), ("Sailboat", "R. Okafor"))
        self.assertEqual((puzzle.width, puzzle.height), (10, 10))
        self.assertEqual(puzzle.row_clues[6], [10])
        self.assertEqual(puzzle.row_clues[9], [1, 1, 1, 1, 1])
        self.assertEqual(puzzle.col_clues[5], [4, 4])

    def test_zero_marks_an_empty_line(self):
        puzzle = parse_puzzle("rows: 3 | 0 | 1 1\ncols: 2 | 1 | 2")
        self.assertEqual(puzzle.row_clues, [[3], [], [1, 1]])

    def test_format_round_trip(self):
        original = parse_puzzle("# draft\ntitle: Steps\nrows: 1 | 2 | 0\ncols: 2 | 1 | 0")
        again = parse_puzzle(format_puzzle(original))
        self.assertEqual((again.title, again.row_clues, again.col_clues),
                         ("Steps", [[1], [2], []], [[2], [1], []]))

    def test_clue_totals_must_agree(self):
        with self.assertRaises(PuzzleError):
            parse_puzzle("rows: 2 | 1\ncols: 1 | 1")

    def test_clue_longer_than_its_line_is_rejected(self):
        with self.assertRaises(PuzzleError):
            Puzzle([[2, 1]], [[1], [1], [1]])


class RenderTests(unittest.TestCase):
    def test_board_with_clues(self):
        puzzle = Puzzle([[1, 1], [1], [1, 1]], [[1, 1], [], [3]], title="Tiny")
        grid = [[1, 0, 1], [0, 0, 1], [1, 0, 1]]
        self.assertEqual(render(puzzle, grid), "\n".join([
            "    1",
            "    1 0 3",
            "1 1 # . #",
            "  1 . . #",
            "1 1 # . #",
        ]))

    def test_unsolved_board_shows_question_marks(self):
        puzzle = Puzzle([[1], []], [[], [1]])
        self.assertEqual(render(puzzle).splitlines()[1:], ["1 ? ?", "0 ? ?"])


if __name__ == "__main__":
    unittest.main()
