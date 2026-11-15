import unittest

from transit import UnknownStationError, fastest_journey, format_journey, load_network
from transit.samples import load_harbour_city

# Pier to Point: 12 min on Coastal with no change, or 4 min of riding on
# Hopper + Uptown with one change at Market.
COAST = """
line Coastal: Pier 3 Beach 3 Cliffs 3 Dunes 3 Point
line Hopper: Pier 2 Market
line Uptown: Market 2 Point
"""

# The Shuttle reaches Bridge first, but only the Local continues to Quarry.
VALLEY = """
line Local: Dock 2 Mill 2 Bridge 2 Quarry
line Shuttle: Dock 1 Depot 1 Bridge
"""

# The cable car only goes up, and the coast road is a separate network.
MOUNTAIN = """
line Valley: North Gate 4 Mill 3 South Gate
line Cable Car oneway: Mill 12 Summit
line Coast Road: Harbour 6 Lighthouse
"""


def hop_minutes(network, line_name, a, b):
    """Running time of one hop a -> b on the named line, read from the timetable data."""
    line = network.lines[line_name]
    for i, minutes in enumerate(line.minutes):
        x, y = line.stations[i], line.stations[i + 1]
        if (x, y) == (a, b) or (not line.one_way and (y, x) == (a, b)):
            return minutes
    return None


def assert_valid_journey(test, network, journey, origin, destination, transfer_minutes):
    """Legs must chain from origin to destination over real hops, with consistent minutes."""
    test.assertIsNotNone(journey, f"there is a journey from {origin} to {destination}")
    test.assertEqual(journey.origin, origin)
    test.assertEqual(journey.destination, destination)
    test.assertEqual(journey.transfer_minutes, transfer_minutes)
    legs = list(journey.legs)
    here = origin
    for i, leg in enumerate(legs):
        stations = list(leg.stations)
        test.assertGreaterEqual(len(stations), 2, f"leg {i + 1} must ride at least one hop")
        test.assertEqual(stations[0], here, f"leg {i + 1} must start where the journey is")
        if i:
            test.assertNotEqual(leg.line, legs[i - 1].line, "consecutive hops on one line belong in one leg")
        riding = 0
        for a, b in zip(stations, stations[1:]):
            minutes = hop_minutes(network, leg.line, a, b)
            test.assertIsNotNone(minutes, f"{leg.line} does not run from {a} to {b}")
            riding += minutes
        test.assertEqual(leg.minutes, riding, f"leg {i + 1} on {leg.line} rides {riding} min")
        here = stations[-1]
    test.assertEqual(here, destination, "the last leg must end at the destination")
    changes = max(len(legs) - 1, 0)
    test.assertEqual(journey.transfers, changes)
    test.assertEqual(journey.total_minutes, sum(leg.minutes for leg in legs) + changes * transfer_minutes)


def summary(journey):
    return [(leg.line, list(leg.stations), leg.minutes) for leg in journey.legs]


class FastestJourneyTests(unittest.TestCase):
    def setUp(self):
        self.network = load_harbour_city()

    def plan(self, origin, destination, transfer_minutes=5, network=None):
        network = network or self.network
        journey = fastest_journey(network, origin, destination, transfer_minutes)
        assert_valid_journey(self, network, journey, origin, destination, transfer_minutes)
        return journey

    def test_single_line_trip_has_no_boarding_penalty(self):
        journey = self.plan("Airport", "Museum")
        self.assertEqual(journey.total_minutes, 13)
        self.assertEqual(summary(journey), [("Red", ["Airport", "Central", "Harbor", "Museum"], 13)])

    def test_default_transfer_penalty_is_five_minutes(self):
        journey = fastest_journey(self.network, "Airport", "Science Park")
        assert_valid_journey(self, self.network, journey, "Airport", "Science Park", 5)
        self.assertEqual(journey.total_minutes, 17)

    def test_direct_express_beats_changing_lines(self):
        journey = self.plan("Airport", "University")
        self.assertEqual(journey.total_minutes, 9)
        self.assertEqual(summary(journey), [("Express", ["Airport", "University"], 9)])

    def test_one_transfer(self):
        journey = self.plan("Airport", "Science Park")
        self.assertEqual((journey.total_minutes, journey.transfers), (17, 1))
        self.assertEqual(summary(journey), [("Express", ["Airport", "University"], 9),
                                            ("Green", ["University", "Science Park"], 3)])

    def test_two_transfers_using_the_circle_line(self):
        journey = self.plan("Old Town", "Island Pier")
        self.assertEqual((journey.total_minutes, journey.transfers), (23, 2))
        self.assertEqual(summary(journey), [("Circle", ["Old Town", "Central"], 2),
                                            ("Red", ["Central", "Harbor"], 3),
                                            ("Ferry", ["Harbor", "Island Pier"], 8)])

    def test_custom_transfer_penalty(self):
        journey = self.plan("Old Town", "Island Pier", transfer_minutes=2)
        self.assertEqual((journey.total_minutes, journey.transfers), (17, 2))

    def test_one_way_ferry_goes_round_the_loop(self):
        journey = self.plan("Island Pier", "Harbor")
        self.assertEqual(journey.total_minutes, 15)
        self.assertEqual(summary(journey), [("Ferry", ["Island Pier", "Lighthouse", "Harbor"], 15)])

    def test_reverse_of_a_one_way_trip(self):
        self.assertEqual(self.plan("Lighthouse", "Museum").total_minutes, 21)
        self.assertEqual(self.plan("Museum", "Lighthouse").total_minutes, 24)

    def test_transfer_penalty_decides_the_route(self):
        coast = load_network(COAST)
        cheap = self.plan("Pier", "Point", transfer_minutes=5, network=coast)
        self.assertEqual((cheap.total_minutes, [leg.line for leg in cheap.legs]), (9, ["Hopper", "Uptown"]))
        costly = self.plan("Pier", "Point", transfer_minutes=10, network=coast)
        self.assertEqual((costly.total_minutes, [leg.line for leg in costly.legs]), (12, ["Coastal"]))

    def test_equal_times_prefer_fewer_transfers(self):
        # With an 8 minute change both routes take 12 minutes.
        journey = self.plan("Pier", "Point", transfer_minutes=8, network=load_network(COAST))
        self.assertEqual((journey.total_minutes, journey.transfers), (12, 0))

    def test_free_transfers(self):
        journey = self.plan("Pier", "Point", transfer_minutes=0, network=load_network(COAST))
        self.assertEqual((journey.total_minutes, journey.transfers), (4, 1))

    def test_staying_on_board_can_beat_an_earlier_arrival(self):
        valley = load_network(VALLEY)
        journey = self.plan("Dock", "Quarry", network=valley)
        self.assertEqual(journey.total_minutes, 6)
        self.assertEqual(summary(journey), [("Local", ["Dock", "Mill", "Bridge", "Quarry"], 6)])
        self.assertEqual(self.plan("Dock", "Bridge", network=valley).total_minutes, 2)

    def test_same_origin_and_destination(self):
        journey = self.plan("Central", "Central")
        self.assertEqual(list(journey.legs), [])
        self.assertEqual(journey.total_minutes, 0)

    def test_unreachable_destination_returns_none(self):
        mountain = load_network(MOUNTAIN)
        self.assertEqual(self.plan("North Gate", "Summit", network=mountain).total_minutes, 21)
        self.assertIsNone(fastest_journey(mountain, "Summit", "Mill"))
        self.assertIsNone(fastest_journey(mountain, "North Gate", "Lighthouse"))

    def test_unknown_station_raises(self):
        with self.assertRaises(UnknownStationError):
            fastest_journey(self.network, "Airport", "Atlantis")

    def test_journey_card_text(self):
        journey = fastest_journey(self.network, "Airport", "Science Park")
        self.assertEqual(format_journey(journey),
                         "Take Express from Airport to University (9 min), transfer (5 min), "
                         "take Green from University to Science Park (3 min). Total 17 min, 1 transfer.")


if __name__ == "__main__":
    unittest.main()
