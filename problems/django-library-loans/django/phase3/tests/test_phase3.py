import random
from datetime import date, timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.base import ApiTestCase

from library.models import Book, Loan, Member


def seed(members=20, books=40, loans=150, seed_value=11):
    """A busy branch: returned, overdue and active loans spread over many members and titles."""
    rng = random.Random(seed_value)
    start = Member.objects.count()
    people = Member.objects.bulk_create(
        Member(name=f"Reader {start + i}", email=f"reader{start + i}@example.org", joined_on=date(2025, 1, 1)) for i in range(members))
    first = Book.objects.count()
    titles = Book.objects.bulk_create(
        Book(title=f"Title {first + i}", author=f"Author {i % 7}", isbn=f"979-{first + i:010d}", copies=rng.randint(1, 4)) for i in range(books))
    rows = []
    for _ in range(loans):
        lent = date(2026, 1, 1) + timedelta(days=rng.randint(0, 60))
        returned = lent + timedelta(days=rng.randint(3, 25)) if rng.random() < 0.5 else None
        due = lent + timedelta(days=14)
        fine = min(max((returned - due).days, 0) * 25, 1000) if returned else 0
        rows.append(Loan(member=rng.choice(people), book=rng.choice(titles), lent_on=lent, due_on=due, returned_on=returned, fine_cents=fine))
    Loan.objects.bulk_create(rows)
    return people, titles


class QueryBudgetTests(ApiTestCase):
    def get(self, url, params=None):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url, params or {})
        self.assertEqual(response.status_code, 200, response.content[:300])
        return len(queries), response.json()

    def test_loan_list_uses_at_most_two_queries(self):
        seed()
        count, body = self.get("/loans/")
        self.assertEqual(len(body), 150)
        first = Loan.objects.order_by("id").select_related("member", "book").first()
        self.assertEqual(body[0]["member"], {"id": first.member.id, "name": first.member.name})
        self.assertEqual(body[0]["book"]["title"], first.book.title)
        self.assertLessEqual(count, 2, f"GET /loans/ ran {count} queries for 150 loans")

    def test_loan_list_cost_does_not_grow_with_the_data(self):
        seed(members=5, books=5, loans=10)
        small, _ = self.get("/loans/")
        seed(members=30, books=50, loans=300, seed_value=12)
        large, body = self.get("/loans/")
        self.assertEqual(len(body), 310)
        self.assertEqual(small, large, f"10 loans took {small} queries but 310 took {large}")

    def test_filtered_loan_list_stays_within_budget(self):
        people, _ = seed()
        count, body = self.get("/loans/", {"status": "overdue"})
        self.assertTrue(body and all(item["status"] == "overdue" for item in body))
        self.assertLessEqual(count, 2)
        count, body = self.get("/loans/", {"member": people[0].id})
        self.assertTrue(all(item["member"]["id"] == people[0].id for item in body))
        self.assertLessEqual(count, 2)

    def test_catalogue_counts_copies_in_one_query(self):
        _, titles = seed(books=60, loans=200)
        count, body = self.get("/books/")
        self.assertLessEqual(count, 2, f"GET /books/ ran {count} queries for 60 titles")
        out = {}
        for loan in Loan.objects.filter(returned_on__isnull=True):
            out[loan.book_id] = out.get(loan.book_id, 0) + 1
        expected = {book.id: max(book.copies - out.get(book.id, 0), 0) for book in titles}
        self.assertEqual({item["id"]: item["available"] for item in body}, expected)

    def test_member_fines_stay_within_budget(self):
        people, _ = seed(members=2, books=50, loans=80)
        member = max(people, key=lambda m: m.loans.count())
        count, body = self.get(f"/members/{member.id}/fines/")
        self.assertGreater(len(body["items"]), 10)
        self.assertEqual(body["total_cents"], sum(item["fine_cents"] for item in body["items"]))
        self.assertLessEqual(count, 3, f"GET /members/<id>/fines/ ran {count} queries for {len(body['items'])} fines")
