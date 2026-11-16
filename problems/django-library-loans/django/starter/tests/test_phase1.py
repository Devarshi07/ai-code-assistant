from datetime import date

from tests.base import ApiTestCase, make_book, make_member

from library.models import Loan


class LendingTests(ApiTestCase):
    def lend(self, member, book):
        return self.client.post("/loans/", {"member_id": member.id, "book_id": book.id}, format="json")

    def test_lending_an_available_book_returns_the_loan(self):
        member, book = make_member(), make_book()
        response = self.lend(member, book)
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["member"], {"id": member.id, "name": member.name})
        self.assertEqual(body["book"]["id"], book.id)
        self.assertEqual(body["lent_on"], "2026-03-02")
        self.assertEqual(body["due_on"], "2026-03-16")
        self.assertEqual(body["status"], "active")

    def test_the_last_copy_cannot_go_to_two_members(self):
        book = make_book(copies=1)
        first, second = make_member("Grace Hopper"), make_member("Alan Turing")
        self.assertEqual(self.lend(first, book).status_code, 201)
        response = self.lend(second, book)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["error"]["code"], "not_available")
        self.assertEqual(Loan.objects.filter(book=book).count(), 1)

    def test_a_returned_copy_can_be_lent_again(self):
        book = make_book(copies=1)
        earlier = make_member("Grace Hopper")
        Loan.objects.create(member=earlier, book=book, lent_on=date(2026, 2, 1), due_on=date(2026, 2, 15), returned_on=date(2026, 2, 10))
        response = self.lend(make_member("Alan Turing"), book)
        self.assertEqual(response.status_code, 201, response.content)

    def test_books_list_counts_copies_on_the_shelf(self):
        book = make_book(copies=3)
        for name in ("Grace Hopper", "Katherine Johnson"):
            Loan.objects.create(member=make_member(name), book=book, lent_on=date(2026, 2, 1), due_on=date(2026, 2, 15), returned_on=date(2026, 2, 10))
        self.assertEqual(self.lend(make_member("Alan Turing"), book).status_code, 201)
        listed = {b["id"]: b for b in self.client.get("/books/").json()}
        self.assertEqual(listed[book.id]["available"], 2)

    def test_a_member_cannot_go_over_the_loan_limit(self):
        member = make_member()
        for i in range(3):
            self.assertEqual(self.lend(member, make_book(title=f"Volume {i}")).status_code, 201)
        response = self.lend(member, make_book(title="Volume 4"))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "loan_limit")

    def test_unknown_book_is_a_404_and_bad_body_is_a_400(self):
        member = make_member()
        response = self.client.post("/loans/", {"member_id": member.id, "book_id": 999}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")
        response = self.client.post("/loans/", {"member_id": member.id}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertIn("book_id", response.json()["error"]["fields"])
