import random
import time
import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import create_app
from app.repository import InMemoryRepository
from app.schemas import ReadingCreate, StationCreate

N_READINGS = 300_000
START = datetime(2024, 3, 1, tzinfo=timezone.utc)
STEP = timedelta(seconds=100)            # 300,000 readings span about 347 days
LIMIT_SECONDS = 1.0
OFFSETS = [timezone(timedelta(hours=h)) for h in (0, -8, 5.5, 9, -3)]


class CountingRepository(InMemoryRepository):
    """Counts how many stored readings a caller pulls out of the repository."""

    def __init__(self):
        super().__init__()
        self.rows_read = 0

    def readings_for(self, station_id):
        rows = super().readings_for(station_id)
        self.rows_read += len(rows)
        return rows


def make_reading(when, tenths):
    """Skips request validation: the seeding below is not what is being measured."""
    return ReadingCreate.model_construct(timestamp=when, temperature=tenths / 10, unit="C",
                                         humidity=50.0, pressure_hpa=None)


class Ledger:
    """An independent record of what the summaries should say."""

    def __init__(self):
        self.days = {}

    def add(self, when, tenths):
        day = when.astimezone(timezone.utc).date()
        entry = self.days.setdefault(day, [tenths, tenths, 0, 0])
        entry[0] = min(entry[0], tenths)
        entry[1] = max(entry[1], tenths)
        entry[2] += tenths
        entry[3] += 1

    def expected(self, start, end):
        rows = []
        for day in sorted(self.days):
            if start <= day <= end:
                low, high, total, count = self.days[day]
                mean = ((2 * total * 10 + count) // (2 * count)) / 100     # tenths -> hundredths, half up
                rows.append({"date": day.isoformat(), "min_c": low / 10, "max_c": high / 10,
                             "mean_c": mean, "count": count})
        return rows


class DailySummaryAtScaleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        rng = random.Random(2024)
        cls.repo = CountingRepository()
        cls.app = create_app(cls.repo)
        cls.client = TestClient(cls.app)
        cls.readings = cls.app.state.readings
        cls.app.state.stations.create(StationCreate(id="ridge-01", name="Ridge Road"))
        cls.ledger = Ledger()
        for i in range(N_READINGS):
            when = (START + i * STEP).astimezone(rng.choice(OFFSETS))
            tenths = rng.randint(-250, 400)
            cls.readings.ingest("ridge-01", make_reading(when, tenths))
            cls.ledger.add(when, tenths)

    def daily(self, start, end, station="ridge-01"):
        return self.client.get(f"/stations/{station}/daily", params={"from": start, "to": end})

    def check_range(self, start, end):
        response = self.daily(start.isoformat(), end.isoformat())
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["days"], self.ledger.expected(start, end))

    def test_a_full_year_matches_an_independent_ledger(self):
        self.check_range(datetime(2024, 3, 1).date(), datetime(2025, 2, 28).date())

    def test_partial_ranges_match_an_independent_ledger(self):
        for start, end in (((2024, 3, 1), (2024, 3, 1)), ((2024, 4, 10), (2024, 4, 24)),
                           ((2024, 8, 31), (2024, 9, 2)), ((2025, 2, 1), (2025, 2, 28)),
                           ((2023, 1, 1), (2023, 12, 31))):
            with self.subTest(start=start, end=end):
                self.check_range(datetime(*start).date(), datetime(*end).date())

    def test_summaries_do_not_read_the_stored_readings(self):
        self.repo.rows_read = 0
        for month in range(3, 13):
            self.check_range(datetime(2024, month, 1).date(), datetime(2024, month, 28).date())
        self.assertLess(self.repo.rows_read, 5_000,
                        f"10 summaries pulled {self.repo.rows_read:,} stored readings out of the repository; "
                        "keep per-day aggregates up to date on ingest instead")

    def test_summaries_stay_quick_on_a_busy_station(self):
        started = time.perf_counter()
        for i in range(45):
            start = (START + timedelta(days=7 * i)).date()
            response = self.daily(start.isoformat(), (start + timedelta(days=59)).isoformat())
            self.assertEqual(response.status_code, 200)
        elapsed = time.perf_counter() - started
        self.assertLess(elapsed, LIMIT_SECONDS, f"45 two-month summaries took {elapsed:.2f}s; must be under {LIMIT_SECONDS}s")

    def test_validation_and_unknown_stations_still_behave(self):
        self.assertEqual(self.daily("2025-03-01", "2025-02-01").status_code, 422)
        self.assertEqual(self.daily("2024-03-01", "2024-03-02", station="nowhere-99").status_code, 404)


class AggregatesStayCorrectTests(unittest.TestCase):
    """Small stations: every way a reading can arrive must be reflected in the summary."""

    def setUp(self):
        self.client = TestClient(create_app())
        self.client.post("/stations", json={"id": "ridge-01", "name": "Ridge Road"})
        self.client.post("/stations", json={"id": "harbor-02", "name": "Harbor Pier"})

    def post(self, timestamp, temperature, station="ridge-01", **extra):
        body = {"timestamp": timestamp, "temperature": temperature, "humidity": 50.0, **extra}
        return self.client.post(f"/stations/{station}/readings", json=body)

    def day(self, date, station="ridge-01"):
        response = self.client.get(f"/stations/{station}/daily", params={"from": date, "to": date})
        self.assertEqual(response.status_code, 200, response.text)
        days = response.json()["days"]
        return days[0] if days else None

    def test_a_new_reading_shows_up_immediately(self):
        self.post("2025-03-10T08:00:00+00:00", 10.0)
        self.assertEqual(self.day("2025-03-10")["count"], 1)
        self.post("2025-03-10T09:00:00+00:00", 14.0)
        self.assertEqual(self.day("2025-03-10"), {"date": "2025-03-10", "min_c": 10.0, "max_c": 14.0,
                                                  "mean_c": 12.0, "count": 2})

    def test_a_reading_older_than_the_stored_ones_is_counted(self):
        self.post("2025-03-10T20:00:00+00:00", 10.0)
        self.post("2025-03-10T02:00:00+00:00", -4.0)
        day = self.day("2025-03-10")
        self.assertEqual((day["min_c"], day["max_c"], day["mean_c"], day["count"]), (-4.0, 10.0, 3.0, 2))

    def test_a_reading_in_another_offset_lands_on_its_utc_day(self):
        self.post("2025-03-10T22:00:00-08:00", 7.0)
        self.assertIsNone(self.day("2025-03-10"))
        self.assertEqual(self.day("2025-03-11")["count"], 1)

    def test_a_rejected_duplicate_does_not_change_the_summary(self):
        self.post("2025-03-10T08:00:00+00:00", 10.0)
        self.assertEqual(self.post("2025-03-10T00:00:00-08:00", 40.0).status_code, 409)
        day = self.day("2025-03-10")
        self.assertEqual((day["max_c"], day["mean_c"], day["count"]), (10.0, 10.0, 1))

    def test_stations_do_not_share_aggregates(self):
        self.post("2025-03-10T08:00:00+00:00", 10.0)
        self.post("2025-03-10T08:00:00+00:00", 50.0, station="harbor-02", unit="F")
        self.assertEqual(self.day("2025-03-10", "ridge-01")["mean_c"], 10.0)
        self.assertEqual(self.day("2025-03-10", "harbor-02")["mean_c"], 10.0)
        self.post("2025-03-10T09:00:00+00:00", 20.0, station="harbor-02")
        self.assertEqual(self.day("2025-03-10", "ridge-01")["count"], 1)
        self.assertEqual(self.day("2025-03-10", "harbor-02")["count"], 2)

    def test_listing_the_latest_readings_still_works(self):
        for hour in (3, 1, 2):
            self.post(f"2025-03-10T{hour:02d}:00:00+00:00", float(hour))
        response = self.client.get("/stations/ridge-01/readings", params={"limit": 2})
        self.assertEqual([r["temperature_c"] for r in response.json()], [2.0, 3.0])
