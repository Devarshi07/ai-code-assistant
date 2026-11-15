import unittest

from armada import (Battle, Coord, Fleet, Ocean, OffBoardError, PlacementError, ScriptedBot,
                    ShotResult, parse_label, play_match, random_fleet)

MISS, HIT, SUNK = ShotResult.MISS, ShotResult.HIT, ShotResult.SUNK

# random_fleet(7) as recorded by QA. The JavaScript harness produces the same chart.
SEED_7_CHART = """
     1  2  3  4  5  6  7  8  9 10
 A   .  .  A  A  A  A  A  .  .  .
 B   .  .  .  .  .  .  .  .  .  .
 C   .  .  .  .  .  .  .  .  .  .
 D   .  .  .  C  .  .  .  .  .  .
 E   .  .  .  C  .  .  .  .  .  .
 F   .  .  E  C  .  .  B  B  B  B
 G   .  .  E  .  D  .  .  .  .  .
 H   .  .  .  .  D  .  .  .  .  .
 I   .  .  .  .  D  .  .  .  .  .
 J   .  .  .  .  .  .  .  .  .  .
"""

# QA ticket #212: an experimental bot that kept re-firing at the same squares.
STUCK_BOT_SHOTS = ["C5", "A3", "A3", "A3", "A3", "A3", "F7", "F7", "F7", "F7",
                   "D4", "D4", "D4", "G5", "G5", "G5", "F3", "F3"]


def small_fleet():
    """6x6 board: a destroyer on A1-A2 and a vertical cruiser on C4-E4."""
    fleet = Fleet(Ocean(6))
    fleet.place(2, "A1")
    fleet.place(3, "C4", vertical=True)
    return fleet


def assert_valid_fleet(test, fleet, size, lengths):
    """Ships are straight, unbroken, on the board and never share a cell."""
    test.assertEqual(sorted(len(ship.cells) for ship in fleet.ships), sorted(lengths))
    seen = set()
    for ship in fleet.ships:
        cells = sorted((c.row, c.col) for c in ship.cells)
        r0, c0 = cells[0]
        across = [(r0, c0 + i) for i in range(len(cells))]
        down = [(r0 + i, c0) for i in range(len(cells))]
        test.assertIn(cells, (across, down), f"{ship.name} is not a straight unbroken line: {cells}")
        for cell in cells:
            test.assertTrue(0 <= cell[0] < size and 0 <= cell[1] < size, f"{ship.name} hangs off the board at {cell}")
            test.assertNotIn(cell, seen, f"{ship.name} overlaps another ship at {cell}")
            seen.add(cell)


class ShotTests(unittest.TestCase):
    def test_fresh_shots_report_miss_hit_and_sunk(self):
        battle = Battle(small_fleet())
        self.assertEqual([battle.fire(c) for c in ("A3", "A1", "A2")], [MISS, HIT, SUNK])
        self.assertEqual(battle.shots_fired, 3)
        self.assertFalse(battle.fleet_sunk)

    def test_repeat_shot_into_water_is_a_wasted_miss(self):
        battle = Battle(small_fleet())
        self.assertEqual([battle.fire("B5"), battle.fire("B5")], [MISS, MISS])
        self.assertEqual(battle.shots_fired, 2)
        self.assertTrue(battle.log[-1].repeat)
        self.assertEqual(battle.repeats, 1)

    def test_repeat_shot_at_a_hit_is_a_wasted_miss(self):
        battle = Battle(small_fleet())
        self.assertEqual(battle.fire("D4"), HIT)
        self.assertEqual(battle.fire("D4"), MISS, "a second shot at a cell that was already hit must be a MISS")
        self.assertEqual(battle.shots_fired, 2)
        self.assertTrue(battle.log[-1].repeat, "the second shot must be logged as a repeat")

    def test_double_tap_does_not_sink_a_destroyer(self):
        fleet = small_fleet()
        battle = Battle(fleet)
        self.assertEqual([battle.fire("A1"), battle.fire("A1")], [HIT, MISS])
        self.assertFalse(fleet.ship_at("A1").is_sunk, "only one of the destroyer's two cells has been hit")
        self.assertEqual(battle.fire("A2"), SUNK)

    def test_firing_at_a_sunk_ship_again_is_a_miss(self):
        battle = Battle(small_fleet())
        for cell in ("C4", "D4", "E4"):
            battle.fire(cell)
        self.assertEqual(battle.fire("E4"), MISS)
        self.assertEqual(battle.repeats, 1)

    def test_fleet_is_sunk_only_when_every_ship_is(self):
        battle = Battle(small_fleet())
        for cell in ("A1", "A2", "C4", "D4"):
            battle.fire(cell)
        self.assertFalse(battle.fleet_sunk)
        self.assertEqual(battle.fire("E4"), SUNK)
        self.assertTrue(battle.fleet_sunk)

    def test_off_board_shot_raises_and_is_not_counted(self):
        battle = Battle(small_fleet())
        with self.assertRaises(OffBoardError):
            battle.fire("G1")
        with self.assertRaises(OffBoardError):
            battle.fire(Coord(0, 6))
        self.assertEqual(battle.shots_fired, 0)


class MatchTests(unittest.TestCase):
    def test_stuck_bot_cannot_win_by_repeating(self):
        bot = ScriptedBot(10, STUCK_BOT_SHOTS)
        report = play_match(bot, random_fleet(7), budget=len(STUCK_BOT_SHOTS))
        self.assertEqual(report.shots, 18)
        self.assertFalse(report.won, "the bot only ever hit five distinct cells")
        self.assertEqual(report.repeats, 12)

    def test_row_by_row_replay_wins_without_repeats(self):
        shots = [Coord(r, c) for r in range(10) for c in range(10)]
        report = play_match(ScriptedBot(10, shots), random_fleet(7))
        self.assertTrue(report.won)
        self.assertEqual(report.shots, 85, "the last ship cell in row order is I5")
        self.assertEqual(report.repeats, 0)


class PlacementTests(unittest.TestCase):
    def test_overlapping_ship_is_rejected(self):
        fleet = small_fleet()
        with self.assertRaises(PlacementError):
            fleet.place(3, "D3")
        self.assertEqual(len(fleet.ships), 2)

    def test_ship_running_off_the_board_is_rejected(self):
        fleet = Fleet(Ocean(6))
        with self.assertRaises(PlacementError):
            fleet.place(4, "A4")
        with self.assertRaises(PlacementError):
            fleet.place(3, "E2", vertical=True)

    def test_seeded_fleets_are_valid_and_reproducible(self):
        for size, lengths in ((10, (5, 4, 3, 3, 2)), (6, (4, 3, 2)), (15, (5, 4, 4, 3, 3, 2, 1))):
            for seed in range(1, 41):
                fleet = random_fleet(seed, size, lengths)
                assert_valid_fleet(self, fleet, size, lengths)
                again = random_fleet(seed, size, lengths)
                self.assertEqual([s.cells for s in fleet.ships], [s.cells for s in again.ships])

    def test_seed_7_matches_the_recorded_chart(self):
        self.assertEqual(random_fleet(7).render(), SEED_7_CHART.strip("\n"))

    def test_labels(self):
        self.assertEqual(parse_label("B7"), Coord(1, 6))
        self.assertEqual(parse_label(" j10 "), Coord(9, 9))
        self.assertEqual(str(Coord(0, 0)), "A1")


if __name__ == "__main__":
    unittest.main()
