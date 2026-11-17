import unittest

from fastapi.testclient import TestClient

from app.main import create_app

RIDGE = {"id": "ridge-01", "name": "Ridge Road"}
HARBOR = {"id": "harbor-02", "name": "Harbor Pier"}


def reading(timestamp, temperature, **extra):
    return {"timestamp": timestamp, "temperature": temperature, "humidity": 55.0, **extra}


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        for station in (RIDGE, HARBOR):
            self.assertEqual(self.client.post("/stations", json=station).status_code, 201)

    def post(self, timestamp, temperature, station="ridge-01", **extra):
        return self.client.post(f"/stations/{station}/readings", json=reading(timestamp, temperature, **extra))

    def post_ok(self, timestamp, temperature, station="ridge-01", **extra):
        response = self.post(timestamp, temperature, station, **extra)
        self.assertEqual(response.status_code, 201, response.text)

    def daily(self, start, end, station="ridge-01"):
        return self.client.get(f"/stations/{station}/daily", params={"from": start, "to": end})


class DailySummaryTests(ApiTestCase):
    def test_min_max_mean_and_count_for_one_day(self):
        for hour, temp in ((6, 10.0), (12, 12.5), (18, 11.0)):
            self.post_ok(f"2025-03-10T{hour:02d}:00:00+00:00", temp)
        response = self.daily("2025-03-10", "2025-03-10")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "station_id": "ridge-01",
            "days": [{"date": "2025-03-10", "min_c": 10.0, "max_c": 12.5, "mean_c": 11.17, "count": 3}],
        })

    def test_days_come_back_in_order_and_empty_days_are_left_out(self):
        self.post_ok("2025-03-12T09:00:00+00:00", 8.0)
        self.post_ok("2025-03-10T09:00:00+00:00", 4.0)
        self.post_ok("2025-03-14T09:00:00+00:00", 6.0)
        body = self.daily("2025-03-09", "2025-03-15").json()
        self.assertEqual([d["date"] for d in body["days"]], ["2025-03-10", "2025-03-12", "2025-03-14"])

    def test_range_is_inclusive_at_both_ends(self):
        for day in (9, 10, 11, 12):
            self.post_ok(f"2025-03-{day:02d}T12:00:00+00:00", float(day))
        body = self.daily("2025-03-10", "2025-03-11").json()
        self.assertEqual([d["date"] for d in body["days"]], ["2025-03-10", "2025-03-11"])

    def test_days_are_utc_days_not_local_days(self):
        # 21:00 at -08:00 is 05:00 UTC the next day; 23:30 at +05:30 is 18:00 UTC the same day.
        self.post_ok("2025-03-10T21:00:00-08:00", 3.0)
        self.post_ok("2025-03-10T23:30:00+05:30", 9.0)
        self.post_ok("2025-03-11T01:00:00+00:00", 5.0)
        body = self.daily("2025-03-10", "2025-03-11").json()
        self.assertEqual(body["days"], [
            {"date": "2025-03-10", "min_c": 9.0, "max_c": 9.0, "mean_c": 9.0, "count": 1},
            {"date": "2025-03-11", "min_c": 3.0, "max_c": 5.0, "mean_c": 4.0, "count": 2},
        ])

    def test_fahrenheit_readings_count_in_celsius(self):
        self.post_ok("2025-03-10T06:00:00+00:00", 50.0, unit="F")   # 10 C
        self.post_ok("2025-03-10T07:00:00+00:00", 14.0, unit="C")
        day = self.daily("2025-03-10", "2025-03-10").json()["days"][0]
        self.assertEqual((day["min_c"], day["max_c"], day["mean_c"]), (10.0, 14.0, 12.0))

    def test_below_freezing_days(self):
        self.post_ok("2025-01-05T03:00:00+00:00", -12.4)
        self.post_ok("2025-01-05T15:00:00+00:00", -3.1)
        day = self.daily("2025-01-05", "2025-01-05").json()["days"][0]
        self.assertEqual((day["min_c"], day["max_c"], day["mean_c"], day["count"]), (-12.4, -3.1, -7.75, 2))

    def test_mean_rounds_half_up_to_two_decimals(self):
        self.post_ok("2025-03-10T01:00:00+00:00", 0.01)
        self.post_ok("2025-03-10T02:00:00+00:00", 0.02)
        self.assertEqual(self.daily("2025-03-10", "2025-03-10").json()["days"][0]["mean_c"], 0.02)

    def test_only_the_requested_station_is_summarised(self):
        self.post_ok("2025-03-10T09:00:00+00:00", 5.0)
        self.post_ok("2025-03-10T09:00:00+00:00", 30.0, station="harbor-02")
        day = self.daily("2025-03-10", "2025-03-10", station="ridge-01").json()["days"][0]
        self.assertEqual((day["max_c"], day["count"]), (5.0, 1))

    def test_station_without_readings_has_no_days(self):
        response = self.daily("2025-03-01", "2025-03-31", station="harbor-02")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"station_id": "harbor-02", "days": []})

    def test_a_full_year_range_is_allowed(self):
        self.post_ok("2025-06-01T12:00:00+00:00", 20.0)
        self.assertEqual(self.daily("2025-01-01", "2025-12-31").status_code, 200)


class DailySummaryValidationTests(ApiTestCase):
    def assert_validation_error(self, response, field):
        self.assertEqual(response.status_code, 422, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "validation_error")
        self.assertIn(field, error["fields"])

    def test_end_before_start_is_rejected(self):
        self.assert_validation_error(self.daily("2025-03-12", "2025-03-01"), "query.to")

    def test_a_range_longer_than_366_days_is_rejected(self):
        self.assert_validation_error(self.daily("2024-01-01", "2025-01-01"), "query.to")

    def test_missing_parameters_are_rejected(self):
        response = self.client.get("/stations/ridge-01/daily", params={"from": "2025-03-01"})
        self.assert_validation_error(response, "query.to")
        response = self.client.get("/stations/ridge-01/daily")
        self.assert_validation_error(response, "query.from")

    def test_malformed_dates_are_rejected(self):
        self.assert_validation_error(self.daily("yesterday", "2025-03-01"), "query.from")
        self.assert_validation_error(self.daily("2025-03-01", "2025-13-45"), "query.to")

    def test_unknown_station_is_404_in_the_standard_shape(self):
        response = self.daily("2025-03-01", "2025-03-02", station="nowhere-99")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


class DuplicateReadingTests(ApiTestCase):
    def test_same_station_and_timestamp_is_409(self):
        self.post_ok("2025-03-10T09:00:00+00:00", 5.0)
        response = self.post("2025-03-10T09:00:00+00:00", 6.0)
        self.assertEqual(response.status_code, 409, response.text)
        error = response.json()["error"]
        self.assertEqual(error["code"], "duplicate_reading")
        self.assertEqual(error["details"]["station_id"], "ridge-01")

    def test_the_same_instant_in_another_offset_is_still_a_duplicate(self):
        self.post_ok("2025-03-10T09:00:00+00:00", 5.0)
        self.assertEqual(self.post("2025-03-10T01:00:00-08:00", 5.0).status_code, 409)
        self.assertEqual(self.post("2025-03-10T14:30:00+05:30", 5.0).status_code, 409)

    def test_a_rejected_duplicate_is_not_stored(self):
        self.post_ok("2025-03-10T09:00:00+00:00", 5.0)
        self.post("2025-03-10T09:00:00+00:00", 25.0)
        day = self.daily("2025-03-10", "2025-03-10").json()["days"][0]
        self.assertEqual((day["count"], day["max_c"]), (1, 5.0))
        self.assertEqual(len(self.client.get("/stations/ridge-01/readings").json()), 1)

    def test_other_stations_and_other_timestamps_are_fine(self):
        self.post_ok("2025-03-10T09:00:00+00:00", 5.0)
        self.post_ok("2025-03-10T09:00:00+00:00", 7.0, station="harbor-02")
        self.post_ok("2025-03-10T09:00:01+00:00", 5.5)

    def test_unknown_station_is_still_404_not_409(self):
        self.assertEqual(self.post("2025-03-10T09:00:00+00:00", 5.0, station="nowhere-99").status_code, 404)
