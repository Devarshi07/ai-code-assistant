import time
import unittest

from transit import fastest_journey, load_network
from tests.generator import generate_timetable, pick_queries

# Reference results on the medium network, checked against an independent
# brute-force planner: (origin, destination, transfer minutes, (total minutes,
# transfers) or None when unreachable).
MEDIUM_CASES = [
    ("S18-21", "S9-8", 5, (139, 8)),
    ("S17-12", "S13-1", 0, (47, 4)),
    ("S1-19", "S2-2", 10, (67, 2)),
    ("S23-3", "S4-16", 2, None),
    ("S13-1", "S5-21", 5, (78, 3)),
    ("S11-15", "S2-20", 0, (59, 8)),
    ("S2-1", "S7-4", 10, (43, 2)),
    ("S19-16", "S22-13", 2, (17, 1)),
    ("S5-5", "S13-18", 5, (215, 10)),
    ("S6-15", "S16-22", 0, (70, 8)),
    ("S2-4", "S13-17", 10, (243, 8)),
    ("S12-17", "S1-20", 2, (145, 10)),
]

BATCH_SIZE = 6
BATCH_LIMIT_SECONDS = 1.0


def hop_minutes(network, line_name, a, b):
    line = network.lines[line_name]
    for i, minutes in enumerate(line.minutes):
        x, y = line.stations[i], line.stations[i + 1]
        if (x, y) == (a, b) or (not line.one_way and (y, x) == (a, b)):
            return minutes
    return None


def assert_valid_journey(test, network, journey, origin, destination, transfer_minutes):
    """Legs must chain from origin to destination over real hops, with consistent minutes."""
    test.assertEqual(journey.origin, origin)
    test.assertEqual(journey.destination, destination)
    legs = list(journey.legs)
    here = origin
    for i, leg in enumerate(legs):
        stations = list(leg.stations)
        test.assertGreaterEqual(len(stations), 2)
        test.assertEqual(stations[0], here, f"leg {i + 1} must start where the journey is")
        if i:
            test.assertNotEqual(leg.line, legs[i - 1].line, "consecutive hops on one line belong in one leg")
        riding = 0
        for a, b in zip(stations, stations[1:]):
            minutes = hop_minutes(network, leg.line, a, b)
            test.assertIsNotNone(minutes, f"{leg.line} does not run from {a} to {b}")
            riding += minutes
        test.assertEqual(leg.minutes, riding)
        here = stations[-1]
    test.assertEqual(here, destination)
    changes = max(len(legs) - 1, 0)
    test.assertEqual(journey.transfers, changes)
    test.assertEqual(journey.total_minutes, sum(leg.minutes for leg in legs) + changes * transfer_minutes)


class ScaleTests(unittest.TestCase):
    def test_medium_network_matches_reference_results(self):
        text, _ = generate_timetable(11, 24, 40, 8, 20)
        network = load_network(text)
        for origin, destination, transfer, expected in MEDIUM_CASES:
            with self.subTest(origin=origin, destination=destination, transfer=transfer):
                journey = fastest_journey(network, origin, destination, transfer)
                if expected is None:
                    self.assertIsNone(journey)
                    continue
                self.assertIsNotNone(journey)
                assert_valid_journey(self, network, journey, origin, destination, transfer)
                self.assertEqual((journey.total_minutes, journey.transfers), expected)

    def test_regional_network_batch_is_fast(self):
        text, stations = generate_timetable(3, 80, 320, 20, 50)
        network = load_network(text)          # about 5,100 stations and 320 lines
        queries = pick_queries(17, stations, BATCH_SIZE)

        start = time.perf_counter()
        journeys = [fastest_journey(network, origin, destination) for origin, destination in queries]
        elapsed = time.perf_counter() - start

        for (origin, destination), journey in zip(queries, journeys):
            self.assertIsNotNone(journey, f"{origin} to {destination}")
            assert_valid_journey(self, network, journey, origin, destination, 5)
        self.assertEqual((journeys[0].total_minutes, journeys[0].transfers), (116, 6))
        self.assertEqual(sum(j.total_minutes for j in journeys), 621)
        self.assertEqual(sum(j.transfers for j in journeys), 28)
        self.assertLess(elapsed, BATCH_LIMIT_SECONDS,
                        f"{BATCH_SIZE} queries took {elapsed:.2f}s; the batch must finish in under "
                        f"{BATCH_LIMIT_SECONDS:.1f}s")


if __name__ == "__main__":
    unittest.main()
