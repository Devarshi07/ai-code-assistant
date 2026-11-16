from datetime import date, timedelta

from tests.base import ApiTestCase, make_book, make_member

from library.models import Loan


def loan(member, book, lent_on, returned_on=None, fine_cents=0):
    return Loan.objects.create(member=member, book=book, lent_on=lent_on, due_on=lent_on + timedelta(days=14),
                               returned_on=returned_on, fine_cents=fine_cents)


class ReturnTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.member, self.book = make_member(), make_book(copies=1)
        self.loan = loan(self.member, self.book, date(2026, 2, 16))  # due 2026-03-02, which is "today"

    def give_back(self, loan_id):
        return self.client.post(f"/loans/{loan_id}/return/", format="json")

    def test_returning_on_the_due_date_has_no_fine(self):
        response = self.give_back(self.loan.id)
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual(body["returned_on"], "2026-03-02")
        self.assertEqual(body["fine_cents"], 0)
        self.assertEqual(body["status"], "returned")
        self.assertEqual(self.client.get("/books/").json()[0]["available"], 1)

    def test_each_late_day_costs_25_cents(self):
        self.set_today(date(2026, 3, 7))
        body = self.give_back(self.loan.id).json()
        self.assertEqual(body["fine_cents"], 125)
        self.loan.refresh_from_db()
        self.assertEqual((self.loan.returned_on, self.loan.fine_cents), (date(2026, 3, 7), 125))

    def test_a_fine_is_capped_at_ten_dollars(self):
        self.set_today(date(2026, 6, 1))
        self.assertEqual(self.give_back(self.loan.id).json()["fine_cents"], 1000)

    def test_returning_twice_is_a_conflict(self):
        self.assertEqual(self.give_back(self.loan.id).status_code, 200)
        self.set_today(date(2026, 3, 20))
        response = self.give_back(self.loan.id)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "already_returned")
        self.loan.refresh_from_db()
        self.assertEqual((self.loan.returned_on, self.loan.fine_cents), (date(2026, 3, 2), 0))

    def test_returning_an_unknown_loan_is_a_404(self):
        response = self.give_back(4040)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


class FinesTests(ApiTestCase):
    def test_fines_list_recorded_and_accruing_fines(self):
        member = make_member()
        other = make_member("Someone Else")
        paid_late = loan(member, make_book(title="Returned late"), date(2026, 1, 5), returned_on=date(2026, 1, 22), fine_cents=75)
        loan(member, make_book(title="Returned on time"), date(2026, 1, 5), returned_on=date(2026, 1, 10))
        still_out = loan(member, make_book(title="Still out"), date(2026, 2, 1))  # due 02-15, 15 days late
        loan(member, make_book(title="Not due yet"), date(2026, 2, 25))  # due 03-11
        loan(other, make_book(title="Not this member"), date(2026, 1, 1))
        response = self.client.get(f"/members/{member.id}/fines/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json(), {
            "member_id": member.id,
            "total_cents": 75 + 375,
            "items": [
                {"loan_id": paid_late.id, "title": "Returned late", "due_on": "2026-01-19", "days_late": 3, "fine_cents": 75, "accruing": False},
                {"loan_id": still_out.id, "title": "Still out", "due_on": "2026-02-15", "days_late": 15, "fine_cents": 375, "accruing": True},
            ],
        })

    def test_a_member_with_nothing_late_owes_nothing(self):
        member = make_member()
        loan(member, make_book(), date(2026, 2, 25))
        self.assertEqual(self.client.get(f"/members/{member.id}/fines/").json(), {"member_id": member.id, "total_cents": 0, "items": []})

    def test_fines_for_an_unknown_member_is_a_404(self):
        response = self.client.get("/members/777/fines/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")


class LoanFilterTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.ada, self.bo = make_member(), make_member("Bo Lindqvist")
        self.returned = loan(self.ada, make_book(title="A"), date(2026, 1, 5), returned_on=date(2026, 1, 12))
        self.overdue = loan(self.ada, make_book(title="B"), date(2026, 2, 1))  # due 02-15
        self.due_today = loan(self.bo, make_book(title="C"), date(2026, 2, 16))  # due 03-02: not overdue yet
        self.active = loan(self.ada, make_book(title="D"), date(2026, 2, 27))

    def ids(self, **params):
        response = self.client.get("/loans/", params)
        self.assertEqual(response.status_code, 200, response.content)
        return [item["id"] for item in response.json()]

    def test_status_filter(self):
        self.assertEqual(self.ids(status="returned"), [self.returned.id])
        self.assertEqual(self.ids(status="overdue"), [self.overdue.id])
        self.assertEqual(self.ids(status="active"), [self.due_today.id, self.active.id])
        self.assertEqual(self.ids(), [self.returned.id, self.overdue.id, self.due_today.id, self.active.id])

    def test_status_and_member_filters_combine(self):
        self.assertEqual(self.ids(status="active", member=self.ada.id), [self.active.id])
        self.assertEqual(self.ids(status="overdue", member=self.bo.id), [])

    def test_unknown_status_is_a_validation_error(self):
        response = self.client.get("/loans/", {"status": "lost"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertIn("status", response.json()["error"]["fields"])
