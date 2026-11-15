import unittest

from maze import Level, LevelError, shortest_path, solve
from maze.levels import CANYON, SPIRE, TUTORIAL
from maze.render import to_moves

GATED_SQUARE = """
#######
#S..>E#
#.###.#
#.....#
#.###.#
#.....#
#######
"""

WALLED_OFF = """
#####
#S#E#
#.#.#
#.#.#
#####
"""


def assert_route(test, level, path):
    """Every step must stay on the map, avoid walls and respect gates."""
    gates = {">": (0, 1), "<": (0, -1), "^": (-1, 0), "v": (1, 0)}
    for a, b in zip(path, path[1:]):
        delta = (b.row - a.row, b.col - a.col)
        test.assertIn(delta, gates.values(), f"{a} -> {b} is not a single step")
        test.assertTrue(0 <= b.row < level.height and 0 <= b.col < level.width, f"{b} is off the map")
        here, there = level.rows[a.row][a.col], level.rows[b.row][b.col]
        test.assertNotEqual(there, "#", f"{b} is a wall")
        if here in gates:
            test.assertEqual(delta, gates[here], f"left gate {here} at {a} the wrong way")
        if there in gates:
            test.assertEqual(delta, gates[there], f"entered gate {there} at {b} the wrong way")


class SolverTests(unittest.TestCase):
    def test_square_level_shortest_route(self):
        level = Level.parse(GATED_SQUARE)
        run = solve(level)
        self.assertIsNotNone(run)
        self.assertEqual(run.moves, 4)
        self.assertEqual(to_moves(run.path), "EEEE")

    def test_gates_only_open_one_way(self):
        level = Level.parse(GATED_SQUARE)
        back = shortest_path(level, level.exit, level.start)
        self.assertEqual(len(back) - 1, 8, "the way back must go around the gate")
        assert_route(self, level, back)

    def test_unreachable_exit_returns_none(self):
        self.assertIsNone(solve(Level.parse(WALLED_OFF)))

    def test_wide_level_is_solvable(self):
        level = Level.parse(TUTORIAL, "tutorial")
        run = solve(level)
        self.assertIsNotNone(run, "the tutorial level has a route to the exit")
        self.assertEqual(run.moves, 12)
        assert_route(self, level, run.path)

    def test_wide_canyon_route(self):
        level = Level.parse(CANYON, "canyon")
        run = solve(level)
        self.assertIsNotNone(run, "the canyon level has a route to the exit")
        self.assertEqual(run.moves, 20)
        assert_route(self, level, run.path)

    def test_tall_level_stays_on_the_map(self):
        level = Level.parse(SPIRE, "spire")
        run = solve(level)
        self.assertIsNotNone(run)
        assert_route(self, level, run.path)
        self.assertEqual(run.moves, 22)


class LevelTests(unittest.TestCase):
    def test_parse_reads_dimensions_and_markers(self):
        level = Level.parse(TUTORIAL)
        self.assertEqual((level.width, level.height), (9, 5))
        self.assertEqual((level.start.row, level.start.col), (1, 1))
        self.assertEqual((level.exit.row, level.exit.col), (3, 7))

    def test_ragged_rows_are_rejected(self):
        with self.assertRaises(LevelError):
            Level.parse("#####\n#S.E#\n###")

    def test_exactly_one_start_required(self):
        with self.assertRaises(LevelError):
            Level.parse("######\n#SS.E#\n######")


if __name__ == "__main__":
    unittest.main()
