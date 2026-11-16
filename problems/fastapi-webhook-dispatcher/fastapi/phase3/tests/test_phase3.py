import json
import random
import time
import unittest

from fastapi.testclient import TestClient

from app.clock import FakeClock
from app.config import Settings
from app.main import create_app
from app.schemas import EventIn, SubscriptionCreate
from app.signatures import signature_header
from app.transport import ScriptedTransport

SECRET = "ingest-secret-for-tests"
BOOKS = "https://books.example.com/hooks"
CRM = "https://crm.example.com/relay"
SHIPPING = "https://ship.example.com/webhooks"
N_EVENTS = 20_000
BATCHES = 500
BATCH_SIZE = 10
LIMIT_SECONDS = 0.6


def sent_ids(transport, start=0):
    return [request.headers["X-Relay-Delivery"] for request in transport.sent[start:]]


class DispatchQueueAtScaleTests(unittest.TestCase):
    """A backlog after an outage: about 33,000 pending deliveries, drained in small batches."""

    @classmethod
    def setUpClass(cls):
        cls.clock = FakeClock()
        cls.transport = ScriptedTransport()
        cls.app = create_app(Settings(ingest_secret=SECRET), cls.clock, cls.transport)
        subscriptions = cls.app.state.subscriptions
        for url, events in [(BOOKS, ["*"]), (CRM, ["order.created"]), (SHIPPING, ["order.shipped"])]:
            subscriptions.create(SubscriptionCreate(url=url, events=events, secret="whsec_" + "s" * 20))
        cls.transport.always(CRM, 503)
        rng = random.Random(2026)
        for i in range(N_EVENTS):
            cls.app.state.events.publish(EventIn(type=rng.choice(["invoice.paid", "order.created", "order.shipped"]),
                                                 data={"sequence": i}))
            cls.clock.advance(1)
        cls.all_ids = sorted(cls.app.state.repo.deliveries)

    def test_1_draining_the_backlog_stays_fast(self):
        dispatcher = self.app.state.dispatcher
        started = time.perf_counter()
        for _ in range(BATCHES):
            dispatcher.dispatch_due(limit=BATCH_SIZE)
        elapsed = time.perf_counter() - started
        self.assertLess(elapsed, LIMIT_SECONDS,
                        f"{BATCHES} dispatch batches took {elapsed:.2f}s; must be under {LIMIT_SECONDS}s")
        self.assertEqual(sent_ids(self.transport), self.all_ids[:BATCHES * BATCH_SIZE],
                         "deliveries must go out oldest first, each exactly once")

    def test_2_retries_wait_their_turn_behind_older_deliveries(self):
        repo = self.app.state.repo
        retried = [d for d in repo.deliveries.values() if d.attempts == 1 and d.status == "pending"]
        self.assertTrue(retried, "CRM deliveries should be waiting for a retry")
        self.clock.advance(30)
        before = len(self.transport.sent)
        self.app.state.dispatcher.dispatch_due(limit=5)
        done = BATCHES * BATCH_SIZE
        self.assertEqual(sent_ids(self.transport, before), self.all_ids[done:done + 5])

    def test_3_the_listing_still_filters_correctly(self):
        client = TestClient(self.app)
        page = client.get("/deliveries", params={"status": "delivered", "limit": 3}).json()
        delivered = [i for i in self.all_ids if self.app.state.repo.deliveries[i].status == "delivered"]
        self.assertEqual([i["id"] for i in page["items"]], delivered[:3])


class DispatchOrderTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.transport = ScriptedTransport()
        self.app = create_app(Settings(ingest_secret=SECRET), self.clock, self.transport)
        self.app.state.subscriptions.create(SubscriptionCreate(url=BOOKS, events=["*"], secret="whsec_" + "b" * 20))

    def publish(self):
        return self.app.state.events.publish(EventIn(type="invoice.paid", data={}))

    def dispatch(self, limit=10):
        return self.app.state.dispatcher.dispatch_due(limit=limit)

    def test_rescheduled_deliveries_are_ordered_by_their_new_time(self):
        self.transport.script(BOOKS, 500)
        self.publish()                      # DL-000001 due at t0, fails, retry at t0+30
        self.assertEqual(self.dispatch().retried, 1)
        self.clock.advance(10)
        self.publish()                      # DL-000002 due at t0+10
        self.clock.advance(25)
        self.publish()                      # DL-000003 due at t0+35
        summary = self.dispatch()
        self.assertEqual(summary.delivered, 3)
        self.assertEqual(sent_ids(self.transport), ["DL-000001", "DL-000002", "DL-000001", "DL-000003"])
        self.clock.advance(3600)
        self.assertEqual(self.dispatch().attempted, 0, "nothing may be sent twice")

    def test_a_delivery_is_not_attempted_before_it_is_due(self):
        self.transport.script(BOOKS, 500, 500)
        self.publish()
        self.dispatch()
        self.clock.advance(29)
        self.assertEqual(self.dispatch().attempted, 0)
        self.clock.advance(1)
        self.assertEqual(self.dispatch().retried, 1)
        self.clock.advance(59)
        self.assertEqual(self.dispatch().attempted, 0)
        self.clock.advance(1)
        self.assertEqual(self.dispatch().delivered, 1)

    def test_batches_respect_the_limit(self):
        for _ in range(7):
            self.publish()
        self.assertEqual(self.dispatch(limit=3).attempted, 3)
        self.assertEqual(self.dispatch(limit=3).attempted, 3)
        self.assertEqual(self.dispatch(limit=3).attempted, 1)
        self.assertEqual(sent_ids(self.transport), [f"DL-00000{n}" for n in range(1, 8)])

    def test_paused_subscriptions_are_cancelled_not_sent(self):
        self.publish()
        self.app.state.subscriptions.set_active("SB-000001", False)
        summary = self.dispatch()
        self.assertEqual((summary.cancelled, summary.attempted), (1, 0))
        self.assertEqual(self.app.state.repo.deliveries["DL-000001"].status, "cancelled")


class EventDeduplicationTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.app = create_app(Settings(ingest_secret=SECRET), self.clock, ScriptedTransport())
        self.client = TestClient(self.app)
        for url in (BOOKS, CRM):
            self.client.post("/subscriptions", json={"url": url, "events": ["*"], "secret": "whsec_" + "d" * 20})

    def post(self, event, key=None, compact=False, signed=True):
        body = json.dumps(event, separators=(",", ":") if compact else None).encode()
        headers = {"Content-Type": "application/json"}
        if signed:
            headers["X-Relay-Signature"] = signature_header(SECRET, int(self.clock.now().timestamp()), body)
        if key:
            headers["Idempotency-Key"] = key
        return self.client.post("/events", content=body, headers=headers)

    def delivery_count(self):
        return len(self.client.get("/deliveries", params={"limit": 100}).json()["items"])

    def test_a_retried_publish_is_recognised(self):
        event = {"type": "order.created", "data": {"order": "SO-5521"}}
        first = self.post(event, key="orders-SO-5521-created")
        self.assertEqual(first.status_code, 202, first.text)
        self.assertFalse(first.json()["duplicate"])
        self.clock.advance(5)
        again = self.post(event, key="orders-SO-5521-created", compact=True)
        self.assertEqual(again.status_code, 200, again.text)
        self.assertTrue(again.json()["duplicate"])
        self.assertEqual(again.json()["event"], first.json()["event"])
        self.assertEqual(again.json()["deliveries"], 2)
        self.assertEqual(self.delivery_count(), 2, "a duplicate must not create deliveries")

    def test_the_same_key_for_a_different_event_is_a_conflict(self):
        self.assertEqual(self.post({"type": "order.created", "data": {"order": "A"}}, key="k-1").status_code, 202)
        response = self.post({"type": "order.created", "data": {"order": "B"}}, key="k-1")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "idempotency_conflict")
        self.assertEqual(self.delivery_count(), 2)

    def test_signature_is_still_checked_for_retries(self):
        event = {"type": "order.created", "data": {"order": "C"}}
        self.assertEqual(self.post(event, key="k-2").status_code, 202)
        self.assertEqual(self.post(event, key="k-2", signed=False).status_code, 401)

    def test_without_a_key_every_publish_is_a_new_event(self):
        event = {"type": "invoice.paid", "data": {"invoice": "INV-9"}}
        ids = {self.post(event).json()["event"]["id"], self.post(event).json()["event"]["id"]}
        self.assertEqual(len(ids), 2)
        self.assertEqual(self.delivery_count(), 4)


if __name__ == "__main__":
    unittest.main()
