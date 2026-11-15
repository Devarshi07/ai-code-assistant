import time
import unittest

from maze import Level, collect_all_gems
from tests.generator import generate

VAULT = """
###############
#S..#...$...>.#
#.#.#.#####.#.#
#.#$..#...#.#.#
#.#####.#.#.#.#
#...$...#..$#E#
#####v#######.#
#.....$.......#
###############
"""


def assert_valid_run(test, level, run):
    gates = {">": (0, 1), "<": (0, -1), "^": (-1, 0), "v": (1, 0)}
    path = run.path
    test.assertEqual(run.moves, len(path) - 1)
    test.assertEqual(tuple(path[0]), tuple(level.start))
    test.assertEqual(tuple(path[-1]), tuple(level.exit))
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


class ScaleTests(unittest.TestCase):
    def test_vault_with_gates_and_five_gems(self):
        level = Level.parse(VAULT)
        run = collect_all_gems(level)
        self.assertEqual(run.moves, 42)
        assert_valid_run(self, level, run)

    def test_generated_level_with_eight_gems(self):
        level = Level.parse(generate(21, 31, 8))
        run = collect_all_gems(level)
        self.assertEqual(run.moves, 178)
        assert_valid_run(self, level, run)

    def test_ten_gems_on_a_large_level_is_fast(self):
        level = Level.parse(generate(7, 61, 10))
        start = time.perf_counter()
        run = collect_all_gems(level)
        elapsed = time.perf_counter() - start
        self.assertIsNotNone(run)
        self.assertEqual(run.moves, 402)
        assert_valid_run(self, level, run)
        self.assertLess(elapsed, 0.5, f"took {elapsed:.2f}s; a 10-gem level must solve in under 0.5s")


if __name__ == "__main__":
    unittest.main()
