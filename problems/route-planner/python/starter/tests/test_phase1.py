import unittest

from transit import TimetableError, UnknownStationError, fewest_stops, load_network
from transit.samples import load_harbour_city


def runs_directly(network, a, b):
    """True when some line runs straight from a to b, judged from the timetable data."""
    for line in network.lines.values():
        for x, y in zip(line.stations, line.stations[1:]):
            if (x, y) == (a, b) or (not line.one_way and (y, x) == (a, b)):
                return True
    return False


def assert_route(test, network, route, origin, destination, stops):
    test.assertIsNotNone(route, f"riders can get from {origin} to {destination}")
    test.assertEqual(route[0], origin)
    test.assertEqual(route[-1], destination)
    for a, b in zip(route, route[1:]):
        test.assertTrue(runs_directly(network, a, b), f"no line runs from {a} to {b}")
    test.assertEqual(len(route) - 1, stops,
                     f"{origin} to {destination} is {stops} stops, got {' -> '.join(route)}")


class QuickRouteTests(unittest.TestCase):
    def setUp(self):
        self.network = load_harbour_city()

    def test_outbound_trip_on_the_red_line(self):
        route = fewest_stops(self.network, "Airport", "Museum")
        assert_route(self, self.network, route, "Airport", "Museum", 3)

    def test_return_trip_on_the_red_line(self):
        route = fewest_stops(self.network, "Museum", "Airport")
        assert_route(self, self.network, route, "Museum", "Airport", 3)

    def test_riverside_to_university_is_two_stops(self):
        route = fewest_stops(self.network, "Riverside", "University")
        assert_route(self, self.network, route, "Riverside", "University", 2)

    def test_round_trips_take_the_same_number_of_stops(self):
        for a, b in [("Airport", "Museum"), ("University", "Harbor"),
                     ("City Hall", "Airport"), ("Science Park", "Old Town")]:
            there = fewest_stops(self.network, a, b)
            back = fewest_stops(self.network, b, a)
            self.assertIsNotNone(there, f"{a} to {b}")
            self.assertIsNotNone(back, f"{b} to {a}")
            self.assertEqual(len(there), len(back), f"{a} to {b} and back should be the same length")

    def test_ferry_only_sails_one_way(self):
        self.assertEqual(fewest_stops(self.network, "Island Pier", "Harbor"),
                         ["Island Pier", "Lighthouse", "Harbor"])

    def test_same_station_is_a_zero_stop_route(self):
        self.assertEqual(fewest_stops(self.network, "Central", "Central"), ["Central"])

    def test_unknown_station_is_reported(self):
        with self.assertRaises(UnknownStationError):
            fewest_stops(self.network, "Atlantis", "Central")


class NetworkTests(unittest.TestCase):
    def setUp(self):
        self.network = load_harbour_city()

    def test_two_way_lines_connect_in_both_directions(self):
        connections = {(c.to, c.line, c.minutes) for c in self.network.connections_from("Harbor")}
        self.assertEqual(connections, {("Central", "Red", 3), ("Museum", "Red", 6),
                                       ("Riverside", "Green", 6), ("Island Pier", "Ferry", 8)})

    def test_one_way_line_runs_in_timetable_order_only(self):
        connections = {(c.to, c.line, c.minutes) for c in self.network.connections_from("Island Pier")}
        self.assertEqual(connections, {("Lighthouse", "Ferry", 5)})

    def test_neighbours_of_central(self):
        self.assertEqual(self.network.neighbours("Central"),
                         ["Airport", "Harbor", "Market Square", "Old Town", "University"])

    def test_lines_calling_at_central(self):
        self.assertEqual(self.network.lines_at("Central"), ["Red", "Blue", "Circle"])


class TimetableTests(unittest.TestCase):
    def test_multi_word_station_names_and_minutes(self):
        circle = load_harbour_city().lines["Circle"]
        self.assertEqual(circle.stations, ["Central", "Market Square", "City Hall", "Old Town", "Central"])
        self.assertEqual(circle.minutes, [2, 2, 3, 2])
        self.assertFalse(circle.one_way)

    def test_oneway_flag(self):
        ferry = load_harbour_city().lines["Ferry"]
        self.assertTrue(ferry.one_way)
        self.assertEqual(ferry.stations, ["Harbor", "Island Pier", "Lighthouse", "Harbor"])

    def test_comments_and_blank_lines_are_ignored(self):
        network = load_network("# depot shuttle\n\nline Night Owl: Depot 12 Old Mill  # weekends\n")
        self.assertEqual(list(network.lines), ["Night Owl"])
        self.assertEqual(network.lines["Night Owl"].stations, ["Depot", "Old Mill"])

    def test_malformed_entries_report_their_line_number(self):
        for entry in ["line Red Airport 4 Central", "line Red: Airport 4", "line Red: 4 Airport",
                      "line Red: Airport", "line Red: Airport 0 Central", "line: Airport 4 Central"]:
            with self.subTest(entry=entry):
                with self.assertRaises(TimetableError) as caught:
                    load_network("# header\n" + entry)
                self.assertEqual(caught.exception.line_number, 2)

    def test_duplicate_line_names_are_rejected(self):
        with self.assertRaises(TimetableError):
            load_network("line Red: A 1 B\nline Red: C 1 D\n")


if __name__ == "__main__":
    unittest.main()
