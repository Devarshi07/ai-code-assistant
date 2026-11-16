import random
import time
from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.base import NOW, ApiTestCase, make_account, make_event

from ticketing.models import Hold, Order

SECTIONS = (("Floor", 26, 40, 6500), ("Lower", 20, 40, 4800), ("Upper", 16, 35, 3200), ("Box", 4, 25, 9000))


class BigEventTests(ApiTestCase):
    """An arena on-sale: 2,500 seats, a few hundred sold, held and lapsed."""

    def setUp(self):
        super().setUp()
        self.rosa = make_account("Rosa Diaz", role="organiser")
        self.fans = [make_account(f"Fan {i}") for i in range(12)]
        self.event = make_event(self.rosa, sections=SECTIONS, name="Arena Night")
        seats = list(self.event.seats.all())
        rng = random.Random(2026)
        rng.shuffle(seats)
        sold, held, lapsed = seats[:600], seats[600:1100], seats[1100:1500]
        orders = Order.objects.bulk_create(
            Order(event=self.event, account=rng.choice(self.fans), subtotal_cents=0, fee_cents=0, total_cents=0, created_at=NOW - timedelta(days=1))
            for _ in range(150))
        holds = [Hold(seat=s, account=rng.choice(self.fans), created_at=NOW - timedelta(days=1), expires_at=NOW - timedelta(days=1), order=orders[i % 150]) for i, s in enumerate(sold)]
        holds += [Hold(seat=s, account=rng.choice(self.fans), created_at=NOW - timedelta(minutes=3), expires_at=NOW + timedelta(minutes=7)) for s in held]
        holds += [Hold(seat=s, account=rng.choice(self.fans), created_at=NOW - timedelta(minutes=30), expires_at=NOW - timedelta(minutes=20)) for s in lapsed]
        # A seat that was held, lapsed, then sold to someone else.
        holds += [Hold(seat=s, account=self.fans[0], created_at=NOW - timedelta(days=2), expires_at=NOW - timedelta(days=2)) for s in sold[:50]]
        Hold.objects.bulk_create(holds)
        self.expected = {s.id: "sold" for s in sold} | {s.id: "held" for s in held}
        self.seats = seats

    def timed_get(self, url):
        client = self.as_account(self.fans[1])
        with CaptureQueriesContext(connection) as queries:
            started = time.perf_counter()
            response = client.get(url)
            elapsed = time.perf_counter() - started
        self.assertEqual(response.status_code, 200, response.content[:300])
        return response.json(), len(queries), elapsed

    def test_seat_map_uses_a_fixed_number_of_queries(self):
        body, queries, elapsed = self.timed_get(f"/events/{self.event.id}/seats/")
        self.assertEqual(len(body), 2500)
        self.assertEqual({s["id"]: s["status"] for s in body}, {s.id: self.expected.get(s.id, "available") for s in self.seats})
        self.assertEqual([s["id"] for s in body], sorted(s.id for s in self.seats))
        self.assertLessEqual(queries, 4, f"GET /events/<id>/seats/ ran {queries} queries for 2,500 seats")
        self.assertLess(elapsed, 2.0, f"GET /events/<id>/seats/ took {elapsed:.2f}s")

    def test_availability_is_quick_and_exact(self):
        body, queries, elapsed = self.timed_get(f"/events/{self.event.id}/availability/")
        expected = {}
        for seat in self.seats:
            status = self.expected.get(seat.id, "available")
            entry = expected.setdefault(seat.section, {"section": seat.section, "seats": 0, "available": 0, "held": 0, "sold": 0, "from_price_cents": None})
            entry["seats"] += 1
            entry[status] += 1
            if status == "available":
                entry["from_price_cents"] = seat.price_cents
        self.assertEqual(body["sections"], [expected[name] for name in sorted(expected)])
        self.assertEqual(body["totals"], {"seats": 2500, "available": 1400, "held": 500, "sold": 600})
        self.assertLessEqual(queries, 4, f"GET /events/<id>/availability/ ran {queries} queries")
        self.assertLess(elapsed, 1.0, f"GET /events/<id>/availability/ took {elapsed:.2f}s")

    def test_holding_on_a_busy_event_still_sees_every_conflict(self):
        client = self.as_account(self.fans[2])
        held = next(s for s in self.seats if self.expected.get(s.id) == "held")
        free = next(s for s in self.seats if s.id not in self.expected)
        response = client.post(f"/events/{self.event.id}/holds/", {"seat_ids": [free.id, held.id]}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["seats"], [held.id])


class IdempotentCheckoutTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.rosa = make_account("Rosa Diaz", role="organiser")
        self.mia, self.leo = make_account("Mia Chen"), make_account("Leo Park")
        self.event = make_event(self.rosa)
        self.seats = list(self.event.seats.all())

    def hold(self, account, seats):
        response = self.as_account(account).post(f"/events/{self.event.id}/holds/", {"seat_ids": [s.id for s in seats]}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return [h["id"] for h in response.json()]

    def checkout(self, account, hold_ids, key=None):
        headers = {"HTTP_IDEMPOTENCY_KEY": key} if key else {}
        return self.as_account(account).post("/orders/", {"hold_ids": hold_ids}, format="json", **headers)

    def test_a_retried_checkout_returns_the_same_order(self):
        holds = self.hold(self.mia, self.seats[:2])
        first = self.checkout(self.mia, holds, key="basket-7f3a")
        self.assertEqual(first.status_code, 201, first.content)
        self.set_now(NOW + timedelta(minutes=30))  # even after the holds would have run out
        again = self.checkout(self.mia, list(reversed(holds)), key="basket-7f3a")
        self.assertEqual(again.status_code, 201, again.content)
        self.assertEqual(again.json(), first.json())
        self.assertEqual(Order.objects.count(), 1)

    def test_reusing_a_key_for_different_holds_is_rejected(self):
        first = self.hold(self.mia, self.seats[:1])
        self.assertEqual(self.checkout(self.mia, first, key="basket-1").status_code, 201)
        second = self.hold(self.mia, self.seats[1:2])
        response = self.checkout(self.mia, second, key="basket-1")
        self.assertEqual(response.status_code, 422, response.content)
        self.assertEqual(response.json()["error"]["code"], "idempotency_mismatch")
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(Hold.objects.get(pk=second[0]).order_id, None)

    def test_keys_belong_to_one_account(self):
        mine, theirs = self.hold(self.mia, self.seats[:1]), self.hold(self.leo, self.seats[1:2])
        a = self.checkout(self.mia, mine, key="checkout-1")
        b = self.checkout(self.leo, theirs, key="checkout-1")
        self.assertEqual((a.status_code, b.status_code), (201, 201))
        self.assertNotEqual(a.json()["id"], b.json()["id"])
        self.assertEqual(b.json()["account"]["name"], "Leo Park")

    def test_a_failed_checkout_does_not_use_up_the_key(self):
        holds = self.hold(self.mia, self.seats[:1])
        self.set_now(NOW + timedelta(minutes=11))
        self.assertEqual(self.checkout(self.mia, holds, key="basket-9").status_code, 409)
        fresh = self.hold(self.mia, self.seats[:1])
        response = self.checkout(self.mia, fresh, key="basket-9")
        self.assertEqual(response.status_code, 201, response.content)

    def test_without_a_key_a_retry_is_still_a_conflict(self):
        holds = self.hold(self.mia, self.seats[:1])
        self.assertEqual(self.checkout(self.mia, holds).status_code, 201)
        self.assertEqual(self.checkout(self.mia, holds).status_code, 409)
