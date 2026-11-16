from datetime import timedelta

from tests.base import NOW, ApiTestCase, make_account, make_event

from ticketing.models import Hold, Order


class CheckoutBase(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.rosa = make_account("Rosa Diaz", role="organiser")
        self.mia, self.leo = make_account("Mia Chen"), make_account("Leo Park")
        self.event = make_event(self.rosa, sections=(("Floor", 2, 5, 4500), ("Balcony", 1, 5, 2800)))
        self.seats = list(self.event.seats.all())

    def hold(self, account, seats, event=None):
        response = self.as_account(account).post(f"/events/{(event or self.event).id}/holds/", {"seat_ids": [s.id for s in seats]}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return [h["id"] for h in response.json()]

    def checkout(self, account, hold_ids):
        return self.as_account(account).post("/orders/", {"hold_ids": hold_ids}, format="json")


class CheckoutTests(CheckoutBase):
    def test_checkout_turns_holds_into_an_order(self):
        holds = self.hold(self.mia, [self.seats[0], self.seats[10]])  # Floor A1 and Balcony A1
        self.set_now(NOW + timedelta(minutes=4))
        response = self.checkout(self.mia, holds)
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["event_id"], self.event.id)
        self.assertEqual(body["account"], {"id": self.mia.id, "name": "Mia Chen"})
        self.assertEqual(body["seats"], ["Floor A1", "Balcony A1"])
        self.assertEqual((body["subtotal_cents"], body["fee_cents"], body["total_cents"]), (7300, 300, 7600))
        seats = {s["id"]: s["status"] for s in self.as_account(self.leo).get(f"/events/{self.event.id}/seats/").json()}
        self.assertEqual((seats[self.seats[0].id], seats[self.seats[10].id], seats[self.seats[1].id]), ("sold", "sold", "available"))
        self.assertEqual([o["id"] for o in self.as_account(self.mia).get("/orders/").json()], [body["id"]])
        self.assertEqual(self.as_account(self.leo).get("/orders/").json(), [])

    def test_a_sold_seat_stays_sold_after_the_hold_time(self):
        holds = self.hold(self.mia, self.seats[:1])
        self.assertEqual(self.checkout(self.mia, holds).status_code, 201)
        self.set_now(NOW + timedelta(hours=3))
        response = self.as_account(self.leo).post(f"/events/{self.event.id}/holds/", {"seat_ids": [self.seats[0].id]}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "seats_unavailable")

    def test_an_expired_hold_cannot_be_checked_out(self):
        fresh = self.hold(self.mia, self.seats[:1])
        self.set_now(NOW + timedelta(minutes=6))
        later = self.hold(self.mia, self.seats[1:2])
        self.set_now(NOW + timedelta(minutes=10))  # the first hold ends exactly now
        response = self.checkout(self.mia, fresh + later)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["error"]["code"], "hold_expired")
        self.assertEqual(response.json()["error"]["holds"], fresh)
        self.assertEqual(Order.objects.count(), 0)
        self.assertTrue(Hold.objects.filter(order__isnull=False).count() == 0)

    def test_holds_cannot_be_paid_for_twice(self):
        holds = self.hold(self.mia, self.seats[:2])
        self.assertEqual(self.checkout(self.mia, holds).status_code, 201)
        response = self.checkout(self.mia, holds)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "already_ordered")
        self.assertEqual(Order.objects.count(), 1)

    def test_someone_elses_hold_is_forbidden(self):
        mine, theirs = self.hold(self.mia, self.seats[:1]), self.hold(self.leo, self.seats[1:2])
        response = self.checkout(self.mia, mine + theirs)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "forbidden")
        self.assertEqual(Order.objects.count(), 0)

    def test_bad_checkout_requests(self):
        other = make_event(self.rosa, name="Another night")
        holds = self.hold(self.mia, self.seats[:1]) + self.hold(self.mia, [other.seats.first()], event=other)
        response = self.checkout(self.mia, holds)
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertIn("hold_ids", response.json()["error"]["fields"])
        response = self.checkout(self.mia, [holds[0], 9999])
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["holds"], [9999])
        self.assertEqual(self.checkout(self.mia, []).status_code, 400)
        self.assertEqual(self.checkout(None, holds[:1]).status_code, 401)
        self.assertEqual(Order.objects.count(), 0)


class EventOrdersTests(CheckoutBase):
    def setUp(self):
        super().setUp()
        self.first = self.checkout(self.mia, self.hold(self.mia, self.seats[:2])).json()
        self.second = self.checkout(self.leo, self.hold(self.leo, self.seats[5:6])).json()

    def test_the_organiser_sees_every_order_for_the_event(self):
        response = self.as_account(self.rosa).get(f"/events/{self.event.id}/orders/")
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual([o["id"] for o in body], [self.first["id"], self.second["id"]])
        self.assertEqual([o["account"]["name"] for o in body], ["Mia Chen", "Leo Park"])
        self.assertEqual(body[0]["seats"], ["Floor A1", "Floor A2"])

    def test_attendees_and_other_organisers_are_refused(self):
        for account in (self.mia, make_account("Sam Ortiz", role="organiser")):
            response = self.as_account(account).get(f"/events/{self.event.id}/orders/")
            self.assertEqual(response.status_code, 403, account.name)
            self.assertEqual(response.json()["error"]["code"], "forbidden")
        self.assertEqual(self.as_account(None).get(f"/events/{self.event.id}/orders/").status_code, 401)

    def test_unknown_event_is_a_404(self):
        response = self.as_account(self.rosa).get("/events/9999/orders/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_an_events_orders_do_not_include_other_events(self):
        other = make_event(self.rosa, name="Another night")
        self.checkout(self.mia, self.hold(self.mia, [other.seats.first()], event=other))
        body = self.as_account(self.rosa).get(f"/events/{self.event.id}/orders/").json()
        self.assertEqual(len(body), 2)
