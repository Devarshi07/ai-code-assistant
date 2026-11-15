import unittest

from armada import DEFAULT_FLEET, Coord, Fleet, Ocean, SeekerBot, ShotResult, play_match, random_fleet


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


class SeekerBotTests(unittest.TestCase):
    def test_sinks_standard_fleets_without_repeats(self):
        for seed in range(1, 26):
            with self.subTest(seed=seed):
                shots = referee(self, SeekerBot(10, DEFAULT_FLEET), random_fleet(seed))
                self.assertLessEqual(shots, 100)

    def test_ships_hiding_along_the_far_edges(self):
        fleet = Fleet(Ocean(10))
        fleet.place(5, "J6")                  # J6-J10, the bottom row
        fleet.place(4, "E10", vertical=True)  # E10-H10, the right-hand column
        fleet.place(3, "A8")                  # A8-A10
        fleet.place(3, "H1", vertical=True)   # H1-J1
        fleet.place(2, "J4")                  # J4-J5
        referee(self, SeekerBot(10, DEFAULT_FLEET), fleet)

    def test_small_board(self):
        for seed in range(1, 21):
            with self.subTest(seed=seed):
                referee(self, SeekerBot(5, (3, 2)), random_fleet(seed, 5, (3, 2)))

    def test_crowded_board(self):
        for seed in range(1, 11):
            with self.subTest(seed=seed):
                referee(self, SeekerBot(7, DEFAULT_FLEET), random_fleet(seed, 7, DEFAULT_FLEET))

    def test_large_board(self):
        lengths = (5, 4, 4, 3, 3, 2)
        for seed in range(1, 6):
            with self.subTest(seed=seed):
                referee(self, SeekerBot(20, lengths), random_fleet(seed, 20, lengths))

    def test_fleet_with_a_one_cell_patrol_boat(self):
        lengths = (4, 3, 1)
        for seed in range(1, 21):
            with self.subTest(seed=seed):
                referee(self, SeekerBot(8, lengths), random_fleet(seed, 8, lengths))

    def test_full_match_through_the_runner(self):
        report = play_match(SeekerBot(10, DEFAULT_FLEET), random_fleet(7))
        self.assertTrue(report.won)
        self.assertEqual(report.repeats, 0)
        self.assertLessEqual(report.shots, 100)


if __name__ == "__main__":
    unittest.main()
