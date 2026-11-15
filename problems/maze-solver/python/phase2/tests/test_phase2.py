import unittest

from maze import Level, collect_all_gems, solve
from maze.levels import TOWER, TREASURY, TUTORIAL

# Nearest-gem-first walks left, then all the way right, then back: 22 moves.
# Going right first is shorter.
CORRIDOR = """
#############
#E$..S.....$#
#############
"""

# The gem is only reachable through the eastbound gate, and the only way back
# to the exit is the long loop through the westbound gate.
ONE_WAY_LOOP = """
#########
#S.>.$..#
#.#####.#
#E..<...#
#########
"""

SEALED_GEM = """
#######
#S..E.#
#####.#
#$#...#
#######
"""

SEALED_EXIT = """
#######
#S.$#E#
#######
"""


def assert_valid_run(test, level, run):
    """A run starts at S, ends at E, takes legal steps and visits every gem."""
    gates = {">": (0, 1), "<": (0, -1), "^": (-1, 0), "v": (1, 0)}
    path = run.path
    test.assertEqual(run.moves, len(path) - 1, "moves must equal len(path) - 1")
    test.assertEqual(tuple(path[0]), tuple(level.start), "run must begin on the start tile")
    test.assertEqual(tuple(path[-1]), tuple(level.exit), "run must end on the exit tile")
    for a, b in zip(path, path[1:]):
        delta = (b.row - a.row, b.col - a.col)
        test.assertIn(delta, gates.values(), f"{a} -> {b} is not a single step")
        test.assertTrue(0 <= b.row < level.height and 0 <= b.col < level.width, f"{b} is off the map")
        here, there = level.rows[a.row][a.col], level.rows[b.row][b.col]
        test.assertNotEqual(there, "#", f"{b} is a wall")
        if here in gates:
            test.assertEqual(delta, gates[here], f"left gate at {a} the wrong way")
        if there in gates:
            test.assertEqual(delta, gates[there], f"entered gate at {b} the wrong way")
    visited = {tuple(p) for p in path}
    for gem in level.gems:
        test.assertIn(tuple(gem), visited, f"gem at {gem} was never collected")


class CollectAllGemsTests(unittest.TestCase):
    def test_level_without_gems_matches_plain_solve(self):
        level = Level.parse(TUTORIAL)
        run = collect_all_gems(level)
        self.assertIsNotNone(run)
        self.assertEqual(run.moves, solve(level).moves)
        assert_valid_run(self, level, run)

    def test_single_gem_detour(self):
        level = Level.parse(TOWER)
        run = collect_all_gems(level)
        self.assertEqual(run.moves, 13)
        assert_valid_run(self, level, run)

    def test_order_matters(self):
        level = Level.parse(CORRIDOR)
        run = collect_all_gems(level)
        self.assertEqual(run.moves, 16, "collect the far gem first")
        assert_valid_run(self, level, run)

    def test_legs_are_directional(self):
        level = Level.parse(ONE_WAY_LOOP)
        run = collect_all_gems(level)
        self.assertIsNotNone(run)
        self.assertEqual(run.moves, 14)
        assert_valid_run(self, level, run)

    def test_treasury_three_gems(self):
        level = Level.parse(TREASURY)
        run = collect_all_gems(level)
        self.assertEqual(run.moves, 28)
        assert_valid_run(self, level, run)

    def test_unreachable_gem_means_no_run(self):
        self.assertIsNone(collect_all_gems(Level.parse(SEALED_GEM)))

    def test_unreachable_exit_means_no_run(self):
        self.assertIsNone(collect_all_gems(Level.parse(SEALED_EXIT)))


if __name__ == "__main__":
    unittest.main()
