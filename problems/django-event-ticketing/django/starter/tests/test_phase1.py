from datetime import datetime, timedelta

from tests.base import NOW, ApiTestCase, make_account, make_event

from ticketing.models import Hold, Order


def parse(stamp):
    return datetime.fromisoformat(stamp.replace("Z", "+00:00"))


class HoldTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.organiser = make_account("Rosa Diaz", role="organiser")
        self.mia, self.leo = make_account("Mia Chen"), make_account("Leo Park")
        self.event = make_event(self.organiser)
        self.seats = list(self.event.seats.all())

    def hold(self, account, seats, event=None):
        return self.as_account(account).post(f"/events/{(event or self.event).id}/holds/", {"seat_ids": [s.id for s in seats]}, format="json")

    def statuses(self):
        return {s["id"]: s["status"] for s in self.as_account(self.mia).get(f"/events/{self.event.id}/seats/").json()}

    def test_holding_free_seats_returns_the_holds(self):
        response = self.hold(self.mia, self.seats[:2])
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual([h["seat"] for h in body], ["Floor A1", "Floor A2"])
        self.assertEqual(Hold.objects.filter(account=self.mia).count(), 2)
        self.assertEqual(self.statuses()[self.seats[0].id], "held")

    def test_a_hold_lasts_ten_minutes_from_when_it_is_placed(self):
        body = self.hold(self.mia, self.seats[:1]).json()
        self.assertEqual(parse(body[0]["created_at"]), NOW)
        self.assertEqual(parse(body[0]["expires_at"]), NOW + timedelta(minutes=10))

    def test_a_seat_held_by_someone_else_is_a_conflict(self):
        self.assertEqual(self.hold(self.mia, self.seats[:2]).status_code, 201)
        response = self.hold(self.leo, self.seats[1:3])
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["error"]["code"], "seats_unavailable")
        self.assertEqual(response.json()["error"]["seats"], [self.seats[1].id])
        self.assertEqual(Hold.objects.filter(account=self.leo).count(), 0)

    def test_a_lapsed_hold_frees_its_seat(self):
        Hold.objects.create(seat=self.seats[0], account=self.mia, created_at=NOW - timedelta(minutes=15), expires_at=NOW - timedelta(minutes=5))
        self.assertEqual(self.statuses()[self.seats[0].id], "available")
        response = self.hold(self.leo, self.seats[:1])
        self.assertEqual(response.status_code, 201, response.content)

    def test_a_sold_seat_stays_sold(self):
        order = Order.objects.create(event=self.event, account=self.mia, subtotal_cents=4500, fee_cents=150, total_cents=4650, created_at=NOW - timedelta(days=1))
        Hold.objects.create(seat=self.seats[0], account=self.mia, created_at=NOW - timedelta(days=1), expires_at=NOW - timedelta(days=1), order=order)
        self.assertEqual(self.statuses()[self.seats[0].id], "sold")
        self.assertEqual(self.hold(self.leo, self.seats[:1]).status_code, 409)

    def test_requests_are_checked_before_anything_is_held(self):
        other = make_event(self.organiser, name="Another night")
        response = self.hold(self.mia, [other.seats.first()])
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")
        response = self.hold(self.mia, self.seats[:9])
        self.assertEqual(response.status_code, 400)
        self.assertIn("seat_ids", response.json()["error"]["fields"])
        response = self.hold(None, self.seats[:1])
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "not_authenticated")
        self.assertEqual(Hold.objects.count(), 0)


class EventTests(ApiTestCase):
    def test_organisers_create_events_with_a_seating_plan(self):
        organiser = make_account("Rosa Diaz", role="organiser")
        body = {"name": "Late Show", "venue": "Harbour Hall", "starts_at": "2027-01-20T20:00:00Z",
                "sections": [{"name": "Floor", "rows": 3, "seats_per_row": 4, "price_cents": 3000},
                             {"name": "Balcony", "rows": 2, "seats_per_row": 5, "price_cents": 2000}]}
        response = self.as_account(organiser).post("/events/", body, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["seat_count"], 22)
        response = self.as_account(make_account("Mia Chen")).post("/events/", body, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "forbidden")
