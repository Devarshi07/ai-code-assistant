from tests.base import ApiTestCase, make_account, make_product, make_review, make_reviews

from reviews.models import Review


class ProductSummaryTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.mug = make_product("Trail Mug")
        self.moderator = make_account("Mo Derator", role="moderator")

    def detail(self, product=None):
        response = self.client.get(f"/products/{(product or self.mug).id}/")
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def test_summary_of_published_reviews(self):
        make_reviews(self.mug, [5, 4, 4])
        body = self.detail()
        self.assertEqual(body["review_count"], 3)
        self.assertEqual(body["average_rating"], 4.3)

    def test_product_without_reviews_has_no_average(self):
        body = self.detail()
        self.assertIsNone(body["average_rating"])
        self.assertEqual(body["review_count"], 0)

    def test_average_is_rounded_half_up_to_one_decimal(self):
        # 49 stars over 20 reviews is 2.45; 23 over 20 is 1.15.
        make_reviews(self.mug, [3] * 9 + [2] * 11)  # 27 + 22 = 49
        self.assertEqual(self.detail()["average_rating"], 2.5)
        other = make_product("Camp Stove")
        make_reviews(other, [1] * 17 + [2] * 3)  # 17 + 6 = 23
        self.assertEqual(self.detail(other)["average_rating"], 1.2)

    def test_hidden_reviews_are_left_out_of_the_average(self):
        make_reviews(self.mug, [5, 5])
        make_reviews(self.mug, [1], state="hidden")
        self.assertEqual(self.detail()["average_rating"], 5.0)

    def test_hidden_reviews_are_left_out_of_the_review_count(self):
        make_reviews(self.mug, [4, 2])
        make_reviews(self.mug, [1, 1], state="hidden")
        self.assertEqual(self.detail()["review_count"], 2)

    def test_a_product_with_only_hidden_reviews_has_no_average(self):
        make_reviews(self.mug, [1, 2], state="hidden")
        body = self.detail()
        self.assertIsNone(body["average_rating"])
        self.assertEqual(body["review_count"], 0)

    def test_product_list_shows_the_same_summary(self):
        make_reviews(self.mug, [5, 3])
        make_reviews(self.mug, [1], state="hidden")
        body = self.client.get("/products/").json()
        self.assertEqual(body["count"], 1)
        row = body["results"][0]
        self.assertEqual((row["average_rating"], row["review_count"]), (4.0, 2))


class ModerationTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.mug = make_product()
        self.moderator = make_account("Mo Derator", role="moderator")
        self.ann, self.bo = make_account("Ann Lee"), make_account("Bo Kim")
        self.good = make_review(self.mug, self.ann, rating=5)
        self.bad = make_review(self.mug, self.bo, rating=1)

    def moderate(self, review, state, account=...):
        return self.as_account(self.moderator if account is ... else account).post(f"/reviews/{review.id}/moderate/", {"state": state}, format="json")

    def summary(self):
        body = self.client.get(f"/products/{self.mug.id}/").json()
        return body["average_rating"], body["review_count"]

    def test_hiding_a_review_updates_the_product_summary(self):
        self.assertEqual(self.summary(), (3.0, 2))
        response = self.moderate(self.bad, "hidden")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["state"], "hidden")
        self.assertEqual(self.summary(), (5.0, 1))

    def test_publishing_a_hidden_review_brings_it_back(self):
        self.moderate(self.bad, "hidden")
        self.moderate(self.bad, "published")
        self.assertEqual(self.summary(), (3.0, 2))

    def test_shoppers_cannot_moderate(self):
        response = self.moderate(self.bad, "hidden", account=self.ann)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "permission_denied")
        self.assertEqual(Review.objects.get(pk=self.bad.pk).state, "published")

    def test_anonymous_callers_get_401(self):
        response = self.moderate(self.bad, "hidden", account=None)
        self.assertEqual(response.status_code, 401)

    def test_unknown_state_is_a_validation_error(self):
        response = self.moderate(self.bad, "deleted")
        self.assertEqual(response.status_code, 400)
        self.assertIn("state", response.json()["error"]["fields"])

    def test_deleting_your_own_review_updates_the_summary(self):
        response = self.as_account(self.bo).delete(f"/reviews/{self.bad.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.summary(), (5.0, 1))

    def test_deleting_someone_elses_review_is_forbidden(self):
        response = self.as_account(self.ann).delete(f"/reviews/{self.bad.id}/")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "not_author")
        self.assertTrue(Review.objects.filter(pk=self.bad.pk).exists())
