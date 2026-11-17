import unittest

from fastapi.testclient import TestClient

from app.main import create_app

RIDGE = {"id": "ridge-01", "name": "Ridge Road", "latitude": 46.87, "longitude": -114.01}


def reading(**overrides):
    body = {"timestamp": "2025-03-10T12:00:00+00:00", "temperature": 10.0, "humidity": 60.0}
    body.update(overrides)
    return body


class IngestTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        self.assertEqual(self.client.post("/stations", json=RIDGE).status_code, 201)

    def post(self, **overrides):
        return self.client.post("/stations/ridge-01/readings", json=reading(**overrides))

    def test_celsius_reading_is_stored_as_sent(self):
        response = self.post(temperature=21.5, pressure_hpa=1008.5)
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        self.assertEqual(body["temperature_c"], 21.5)
        self.assertEqual(body["pressure_hpa"], 1008.5)
        self.assertEqual(body["station_id"], "ridge-01")

    def test_fahrenheit_reading_is_converted_to_celsius(self):
        response = self.post(temperature=68.0, unit="F")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["temperature_c"], 20.0)

    def test_fahrenheit_freezing_point_and_a_hot_day(self):
        self.assertEqual(self.post(timestamp="2025-03-10T01:00:00+00:00", temperature=32.0, unit="F")
                         .json()["temperature_c"], 0.0)
        self.assertEqual(self.post(timestamp="2025-03-10T02:00:00+00:00", temperature=104.0, unit="F")
                         .json()["temperature_c"], 40.0)

    def test_below_zero_fahrenheit_is_converted(self):
        self.assertEqual(self.post(temperature=-40.0, unit="F").json()["temperature_c"], -40.0)
        self.assertEqual(self.post(timestamp="2025-03-10T13:00:00+00:00", temperature=14.0, unit="F")
                         .json()["temperature_c"], -10.0)

    def test_stored_temperature_is_rounded_to_two_decimals(self):
        self.assertEqual(self.post(temperature=70.0, unit="F").json()["temperature_c"], 21.11)

    def test_missing_pressure_is_null(self):
        response = self.post()
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIsNone(response.json()["pressure_hpa"])

    def test_timestamp_is_reported_in_utc(self):
        response = self.post(timestamp="2025-03-10T22:30:00-08:00")
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["timestamp"], "2025-03-11T06:30:00Z")

    def test_timestamp_without_an_offset_is_rejected(self):
        response = self.post(timestamp="2025-03-10T12:00:00")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertIn("body.timestamp", response.json()["error"]["fields"])

    def test_humidity_out_of_range_is_rejected(self):
        response = self.post(humidity=140)
        self.assertEqual(response.status_code, 422)
        self.assertIn("body.humidity", response.json()["error"]["fields"])

    def test_unknown_station_is_404(self):
        response = self.client.post("/stations/nowhere-99/readings", json=reading())
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


class ListingTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())
        self.client.post("/stations", json=RIDGE)

    def test_duplicate_station_is_409(self):
        response = self.client.post("/stations", json=RIDGE)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "duplicate_station")

    def test_latest_readings_come_back_oldest_first(self):
        for hour in (9, 3, 7, 5):
            self.client.post("/stations/ridge-01/readings",
                             json=reading(timestamp=f"2025-03-10T{hour:02d}:00:00+00:00", temperature=float(hour)))
        response = self.client.get("/stations/ridge-01/readings", params={"limit": 3})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([r["temperature_c"] for r in response.json()], [5.0, 7.0, 9.0])

    def test_unknown_station_listing_is_404(self):
        self.assertEqual(self.client.get("/stations/nowhere-99/readings").status_code, 404)
