import time
import unittest

from armada import DEFAULT_FLEET, Coord, Fleet, Ocean, SeekerBot, ShotResult, random_fleet

# Hand-drawn QA fleets where ships touch. '.' is water; each letter is one ship.
STACKED = """
AAAAA.....
BBBB......
CCC.......
DDD.......
EE........
..........
..........
..........
..........
..........
"""

PALISADE = """
..........
..........
..........
..........
..........
.....A....
.....AB...
.....ABCD.
.....ABCDE
.....ABCDE
"""

HARBOUR = """
..........
..........
..........
...AAAAA..
...BBBBE..
...CCCDE..
......D...
......D...
..........
..........
"""

CORNER = """
AAA..
BB...
C....
D....
.....
"""


def chart_fleet(text):
    """Build a Fleet from a hand-drawn chart (an independent parser, not the codebase's)."""
    rows = [line for line in text.strip("\n").splitlines()]
    fleet = Fleet(Ocean(len(rows)))
    ships = {}
    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            if ch != ".":
                ships.setdefault(ch, []).append(Coord(r, c))
    for letter in sorted(ships):
        cells = ships[letter]
        vertical = len(cells) > 1 and cells[0].col == cells[1].col
        fleet.place(len(cells), cells[0], vertical)
    return fleet


def referee(test, bot, fleet):
    """Play bot against fleet with an independent referee and return the shot count.

    Results are worked out from the ships' cells here, not by Battle. The bot
    must stay on the board, never fire at a cell twice, and sink every ship
    within one shot per cell.
    """
    size = fleet.ocean.size
    owner = {(c.row, c.col): i for i, ship in enumerate(fleet.ships) for c in ship.cells}
    afloat = [len(ship.cells) for ship in fleet.ships]
    fired = set()
    while any(afloat):
        test.assertLess(len(fired), size * size, f"the fleet is still afloat after {size * size} shots")
        row, col = bot.next_shot()
        test.assertTrue(0 <= row < size and 0 <= col < size, f"shot ({row}, {col}) is off the {size}x{size} board")
        test.assertNotIn((row, col), fired, f"cell ({row}, {col}) was fired at twice")
        fired.add((row, col))
        result = ShotResult.MISS
        if (row, col) in owner:
            ship = owner[row, col]
            afloat[ship] -= 1
            result = ShotResult.SUNK if afloat[ship] == 0 else ShotResult.HIT
        bot.observe(Coord(row, col), result)
    return len(fired)


class EfficiencyTests(unittest.TestCase):
    def test_standard_board_averages_under_70_shots(self):
        start = time.perf_counter()
        shots = [referee(self, SeekerBot(10, DEFAULT_FLEET), random_fleet(seed)) for seed in range(1, 61)]
        elapsed = time.perf_counter() - start
        average = sum(shots) / len(shots)
        self.assertLess(average, 70, f"averaged {average:.1f} shots over 60 standard fleets; must be under 70")
        self.assertLess(elapsed, 3.0, f"60 matches took {elapsed:.2f}s; the benchmark must finish in under 3.0s")

    def test_large_board_averages_under_135_shots(self):
        shots = [referee(self, SeekerBot(15, DEFAULT_FLEET), random_fleet(seed, 15)) for seed in range(1, 31)]
        average = sum(shots) / len(shots)
        self.assertLess(average, 135, f"averaged {average:.1f} shots over 30 fleets on 15x15; must be under 135")


class RobustnessTests(unittest.TestCase):
    def test_touching_ships_are_all_sunk(self):
        for name, chart in (("stacked", STACKED), ("palisade", PALISADE), ("harbour", HARBOUR), ("corner", CORNER)):
            with self.subTest(fleet=name):
                fleet = chart_fleet(chart)
                referee(self, SeekerBot(fleet.ocean.size, fleet.ship_sizes), fleet)

    def test_one_cell_ships_are_found(self):
        for size, lengths in ((6, (3, 2, 1, 1)), (9, (4, 3, 1, 1, 1)), (12, DEFAULT_FLEET + (1,))):
            for seed in range(1, 16):
                with self.subTest(size=size, seed=seed):
                    referee(self, SeekerBot(size, lengths), random_fleet(seed, size, lengths))

    def test_many_board_sizes(self):
        for size in range(5, 17):
            lengths = (3, 2) if size < 7 else (4, 3, 2, 2) if size < 10 else DEFAULT_FLEET if size < 14 else (5, 4, 4, 3, 3, 2, 2)
            for seed in range(1, 9):
                with self.subTest(size=size, seed=seed):
                    referee(self, SeekerBot(size, lengths), random_fleet(seed, size, lengths))


if __name__ == "__main__":
    unittest.main()
