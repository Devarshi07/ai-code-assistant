import json
import unittest
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.clock import FakeClock
from app.config import Settings
from app.main import create_app
from app.signatures import signature_header
from app.transport import ScriptedTransport, TransportError, TransportResponse

SECRET = "ingest-secret-for-tests"
BOOKS = "https://books.example.com/hooks"
CRM = "https://crm.example.com/relay"


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


class RelayTestCase(unittest.TestCase):
    settings = Settings(ingest_secret=SECRET)

    def setUp(self):
        self.clock = FakeClock()
        self.transport = ScriptedTransport()
        self.app = create_app(self.settings, self.clock, self.transport)
        self.client = TestClient(self.app)

    def subscribe(self, url, events=("*",)):
        response = self.client.post("/subscriptions", json={"url": url, "events": list(events),
                                                            "secret": "whsec_" + "x" * 20})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def publish(self, event_type="invoice.paid", **data):
        body = json.dumps({"type": event_type, "data": data}).encode()
        header = signature_header(SECRET, int(self.clock.now().timestamp()), body)
        response = self.client.post("/events", content=body, headers={"X-Relay-Signature": header})
        self.assertEqual(response.status_code, 202, response.text)
        return response.json()

    def dispatch(self, **expected):
        response = self.client.post("/dispatch")
        self.assertEqual(response.status_code, 200, response.text)
        summary = response.json()
        for key, value in expected.items():
            self.assertEqual(summary[key], value, f"{key} in {summary}")
        return summary

    def delivery(self, delivery_id="DL-000001"):
        response = self.client.get(f"/deliveries/{delivery_id}")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()


class RetryTests(RelayTestCase):
    def test_success_marks_the_delivery_delivered(self):
        self.subscribe(BOOKS)
        self.publish()
        self.dispatch(attempted=1, delivered=1, retried=0)
        d = self.delivery()
        self.assertEqual((d["status"], d["attempts"], d["next_attempt_at"]), ("delivered", 1, None))
        self.assertEqual(parse_time(d["delivered_at"]), self.clock.now())
        self.assertEqual([a["status_code"] for a in d["history"]], [200])

    def test_server_errors_back_off_exponentially_then_give_up(self):
        self.subscribe(BOOKS)
        self.transport.always(BOOKS, 500)
        self.publish()
        for attempt, delay in enumerate([30, 60, 120, 240, 480, 960, 1920], start=1):
            with self.subTest(attempt=attempt):
                self.dispatch(attempted=1, retried=1)
                d = self.delivery()
                self.assertEqual((d["status"], d["attempts"], d["last_status_code"]), ("pending", attempt, 500))
                self.assertEqual(parse_time(d["next_attempt_at"]), self.clock.now() + timedelta(seconds=delay))
                self.clock.advance(delay - 1)
                self.dispatch(attempted=0)
                self.clock.advance(1)
        self.dispatch(attempted=1, dead=1, retried=0)
        d = self.delivery()
        self.assertEqual((d["status"], d["attempts"], d["next_attempt_at"]), ("dead", 8, None))
        self.assertEqual(len(d["history"]), 8)
        self.clock.advance(86400)
        self.dispatch(attempted=0)

    def test_recovers_after_temporary_failures(self):
        self.subscribe(BOOKS)
        self.transport.script(BOOKS, 503, TransportError("connection refused"), 200)
        self.publish()
        self.dispatch(retried=1)
        self.clock.advance(30)
        self.dispatch(retried=1)
        d = self.delivery()
        self.assertEqual((d["last_status_code"], d["last_error"]), (None, "connection refused"))
        self.assertEqual(parse_time(d["next_attempt_at"]), self.clock.now() + timedelta(seconds=60))
        self.clock.advance(60)
        self.dispatch(delivered=1)
        d = self.delivery()
        self.assertEqual(d["status"], "delivered")
        self.assertEqual([a["status_code"] for a in d["history"]], [503, None, 200])
        self.assertEqual(d["last_error"], None)

    def test_408_and_429_are_retried_but_other_client_errors_are_not(self):
        for status, outcome in [(408, "retried"), (429, "retried"), (400, "failed"), (401, "failed"),
                                (404, "failed"), (422, "failed"), (301, "failed")]:
            with self.subTest(status=status):
                self.setUp()
                self.subscribe(BOOKS)
                self.transport.always(BOOKS, status)
                self.publish()
                self.dispatch(**{outcome: 1})
                d = self.delivery()
                if outcome == "failed":
                    self.assertEqual((d["status"], d["next_attempt_at"]), ("failed", None))
                    self.clock.advance(86400)
                    self.dispatch(attempted=0)
                else:
                    self.assertEqual(d["status"], "pending")

    def test_retry_after_is_honoured_when_it_is_longer_than_the_backoff(self):
        for retry_after, expected in [("600", 600), ("5", 30), ("99999", 3600), ("soon", 30)]:
            with self.subTest(retry_after=retry_after):
                self.setUp()
                self.subscribe(BOOKS)
                self.transport.script(BOOKS, TransportResponse(429, {"Retry-After": retry_after}))
                self.publish()
                self.dispatch(retried=1)
                self.assertEqual(parse_time(self.delivery()["next_attempt_at"]),
                                 self.clock.now() + timedelta(seconds=expected))

    def test_gone_pauses_the_subscription(self):
        books = self.subscribe(BOOKS, ["invoice.paid"])
        self.subscribe(CRM)
        self.transport.always(BOOKS, 410)
        self.publish()
        self.dispatch(attempted=2, failed=1, delivered=1)
        self.assertFalse(self.client.get(f"/subscriptions/{books}").json()["active"])
        self.assertEqual(self.publish()["deliveries"], 1, "a paused subscription gets no new deliveries")


class CappedRetryTests(RelayTestCase):
    settings = Settings(ingest_secret=SECRET, retry_base_seconds=1000, retry_max_delay_seconds=3000, max_attempts=5)

    def test_delay_is_capped_and_max_attempts_comes_from_settings(self):
        self.subscribe(BOOKS)
        self.transport.always(BOOKS, TransportError("timed out"))
        self.publish()
        for delay in [1000, 2000, 3000, 3000]:
            self.dispatch(retried=1)
            self.assertEqual(parse_time(self.delivery()["next_attempt_at"]), self.clock.now() + timedelta(seconds=delay))
            self.clock.advance(delay)
        self.dispatch(dead=1)
        self.assertEqual(self.delivery()["attempts"], 5)


class DeliveryListingTests(RelayTestCase):
    def setUp(self):
        super().setUp()
        self.books = self.subscribe(BOOKS)                    # SB-000001, every event
        self.crm = self.subscribe(CRM, ["order.created"])     # SB-000002
        self.transport.always(CRM, 500)
        for event_type in ["invoice.paid", "order.created", "order.created", "invoice.paid"]:
            self.publish(event_type)
        # DL-000001 books, DL-000002 books, DL-000003 crm, DL-000004 books, DL-000005 crm, DL-000006 books
        self.dispatch(attempted=6, delivered=4, retried=2)

    def list(self, **params):
        response = self.client.get("/deliveries", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def ids(self, **params):
        return [item["id"] for item in self.list(**params)["items"]]

    def test_lists_every_delivery_in_id_order(self):
        body = self.list()
        self.assertEqual([i["id"] for i in body["items"]], [f"DL-00000{n}" for n in range(1, 7)])
        self.assertIsNone(body["next_after"])
        first = body["items"][0]
        self.assertNotIn("history", first)
        self.assertEqual((first["event_id"], first["event_type"], first["subscription_id"], first["status"]),
                         ("EV-000001", "invoice.paid", self.books, "delivered"))

    def test_filters(self):
        self.assertEqual(self.ids(status="pending"), ["DL-000003", "DL-000005"])
        self.assertEqual(self.ids(subscription_id=self.crm), ["DL-000003", "DL-000005"])
        self.assertEqual(self.ids(status="delivered", event_type="invoice.paid"), ["DL-000001", "DL-000006"])
        self.assertEqual(self.ids(status="dead"), [])

    def test_cursor_pagination(self):
        page = self.list(limit=4)
        self.assertEqual([i["id"] for i in page["items"]], ["DL-000001", "DL-000002", "DL-000003", "DL-000004"])
        self.assertEqual(page["next_after"], "DL-000004")
        page = self.list(limit=4, after=page["next_after"])
        self.assertEqual([i["id"] for i in page["items"]], ["DL-000005", "DL-000006"])
        self.assertIsNone(page["next_after"])
        exact = self.list(limit=3, after="DL-000003")
        self.assertEqual([i["id"] for i in exact["items"]], ["DL-000004", "DL-000005", "DL-000006"])
        self.assertIsNone(exact["next_after"], "no next page when the last item is the last match")
        self.assertEqual(self.ids(status="delivered", limit=1, after="DL-000002"), ["DL-000004"])

    def test_invalid_parameters_use_the_error_format(self):
        for params, field in [({"status": "lost"}, "query.status"), ({"limit": 0}, "query.limit"),
                              ({"limit": 101}, "query.limit")]:
            with self.subTest(**params):
                response = self.client.get("/deliveries", params=params)
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["error"]["code"], "validation_error")
                self.assertIn(field, response.json()["error"]["fields"])

    def test_delivery_detail_still_has_history(self):
        d = self.delivery("DL-000003")
        self.assertEqual([a["status_code"] for a in d["history"]], [500])
        self.assertEqual(self.client.get("/deliveries/DL-999999").status_code, 404)


if __name__ == "__main__":
    unittest.main()
