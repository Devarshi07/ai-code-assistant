import random
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from tests.base import NOW, ApiTestCase, make_account, make_product, make_review

from accounts.models import Account
from reviews.models import Product, Review

# Products that sit exactly on a rounding boundary: 49 stars over 20 reviews is 2.45 and 23 over 20 is 1.15.
SPECIALS = [("Boundary Kettle", [3] * 9 + [2] * 11, 2.5), ("Boundary Lamp", [1] * 17 + [2] * 3, 1.2)]


def seed(products=2500, shoppers=40, seed_value=5):
    """A busy catalogue written straight to the database, the way a data import would.

    Returns the shoppers. Roughly one review in five is hidden.
    """
    rng = random.Random(seed_value)
    people = Account.objects.bulk_create(
        Account(name=f"Seed {i}", email=f"seed{i}@example.org", api_key=f"seed-key-{i}") for i in range(shoppers))
    people = list(Account.objects.filter(email__startswith="seed"))
    names = [name for name, _, _ in SPECIALS] + [f"Product {i}" for i in range(products)]
    Product.objects.bulk_create(Product(name=n, sku=f"SEED-{i:05d}", created_at=NOW) for i, n in enumerate(names))
    catalogue = list(Product.objects.order_by("id"))
    rows = []
    for product in catalogue:
        special = next((r for name, r, _ in SPECIALS if name == product.name), None)
        stars = special if special is not None else [rng.randint(1, 5) for _ in range(rng.choice([0, 0, 1, 2, 3, 5, 8, 12]))]
        for author, rating in zip(rng.sample(people, len(stars)), stars):
            hidden = special is None and rng.random() < 0.2
            rows.append(Review(product=product, author=author, rating=rating, text="Seeded.",
                               state="hidden" if hidden else "published", created_at=NOW, updated_at=NOW))
    Review.objects.bulk_create(rows, batch_size=500)
    return people


def expected_summaries():
    """{product_id: (average_rating, review_count)} worked out from the rows with exact decimal arithmetic."""
    stars = defaultdict(list)
    for product_id, rating in Review.objects.filter(state="published").values_list("product_id", "rating"):
        stars[product_id].append(rating)
    result = {}
    for product_id in Product.objects.values_list("id", flat=True):
        given = stars.get(product_id, [])
        mean = (Decimal(sum(given)) / len(given)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP) if given else None
        result[product_id] = (None if mean is None else float(mean), len(given))
    return result


class CatalogueBudgetTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.shoppers = seed()
        self.moderator = make_account("Mo Derator", role="moderator")
        self.kettle = Product.objects.get(name="Boundary Kettle")
        self.lamp = Product.objects.get(name="Boundary Lamp")

    def get(self, url, params=None):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url, params or {})
        self.assertEqual(response.status_code, 200, response.content[:300])
        return len(queries), response.json()

    def row(self, product, page_size=100):
        _, body = self.get("/products/", {"page_size": page_size})
        return next(r for r in body["results"] if r["id"] == product.id)

    def assert_exact(self, product):
        average, count = expected_summaries()[product.id]
        for label, shown in (("list", self.row(product)), ("detail", self.get(f"/products/{product.id}/")[1])):
            self.assertEqual((shown["average_rating"], shown["review_count"]), (average, count), f"{label} of {product.name}")

    def test_a_page_of_products_uses_at_most_three_queries(self):
        count, body = self.get("/products/", {"page_size": 100})
        self.assertEqual(len(body["results"]), 100)
        self.assertLessEqual(count, 3, f"GET /products/ ran {count} queries for 100 products")

    def test_query_count_does_not_grow_with_the_page_size(self):
        small, _ = self.get("/products/", {"page_size": 5})
        large, _ = self.get("/products/", {"page_size": 100})
        self.assertLessEqual(large, small, f"{small} queries for 5 products but {large} for 100")

    def test_product_detail_uses_at_most_two_queries(self):
        count, body = self.get(f"/products/{self.kettle.id}/")
        self.assertEqual(body["review_count"], 20)
        self.assertLessEqual(count, 2, f"GET /products/<id>/ ran {count} queries")

    def test_every_product_in_the_catalogue_has_the_exact_summary(self):
        expected = expected_summaries()
        seen, page = 0, 1
        while True:
            _, body = self.get("/products/", {"page": page, "page_size": 100})
            if not body["results"]:
                break
            for row in body["results"]:
                self.assertEqual((row["average_rating"], row["review_count"]), expected[row["id"]], row["name"])
            seen += len(body["results"])
            page += 1
        self.assertEqual(seen, len(expected))

    def test_averages_on_a_rounding_boundary_round_half_up(self):
        self.assertEqual(self.row(self.kettle)["average_rating"], 2.5)
        self.assertEqual(self.row(self.lamp)["average_rating"], 1.2)
        self.assertEqual(self.get(f"/products/{self.lamp.id}/")[1]["average_rating"], 1.2)

    def test_numbers_stay_exact_as_reviews_are_written_edited_hidden_and_deleted(self):
        newcomer = make_account("Newcomer")
        self.assert_exact(self.lamp)
        response = self.as_account(newcomer).post(f"/products/{self.lamp.id}/reviews/", {"rating": 5, "text": "Late to the party."}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assert_exact(self.lamp)
        review_id = response.json()["id"]
        self.as_account(newcomer).patch(f"/reviews/{review_id}/", {"rating": 1}, format="json")
        self.assert_exact(self.lamp)
        self.as_account(self.moderator).post(f"/reviews/{review_id}/moderate/", {"state": "hidden"}, format="json")
        self.assert_exact(self.lamp)
        self.assertEqual(self.row(self.lamp)["review_count"], 20)
        self.as_account(self.moderator).post(f"/reviews/{review_id}/moderate/", {"state": "published"}, format="json")
        self.assert_exact(self.lamp)
        self.assertEqual(self.as_account(newcomer).delete(f"/reviews/{review_id}/").status_code, 204)
        self.assert_exact(self.lamp)
        self.assertEqual(self.row(self.lamp)["average_rating"], 1.2)

    def test_changes_made_outside_the_api_show_up_too(self):
        Review.objects.filter(product=self.kettle).update(state="hidden")
        Review.objects.filter(product=self.lamp).delete()
        for product in (self.kettle, self.lamp):
            shown = self.row(product)
            self.assertEqual((shown["average_rating"], shown["review_count"]), (None, 0), product.name)
        make_review(self.lamp, self.shoppers[0], rating=4)
        self.assert_exact(self.lamp)

    def test_review_endpoints_keep_working(self):
        newcomer = make_account("Newcomer")
        url = f"/products/{self.kettle.id}/reviews/"
        self.assertEqual(self.as_account(newcomer).post(url, {"rating": 5, "text": "Boils fast."}, format="json").status_code, 201)
        again = self.as_account(newcomer).post(url, {"rating": 1, "text": "Hmm."}, format="json")
        self.assertEqual((again.status_code, again.json()["error"]["code"]), (409, "already_reviewed"))
        body = self.client.get(url, {"sort": "rating", "page_size": 5}).json()
        self.assertEqual((body["count"], len(body["results"])), (21, 5))
        self.assertEqual(body["results"][0]["rating"], 5)
        quick = make_product("Spare Mug")
        make_review(quick, self.shoppers[1], rating=3)
        self.assertEqual(self.client.get(f"/products/{quick.id}/").json()["average_rating"], 3.0)
