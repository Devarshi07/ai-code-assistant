from datetime import timedelta

from tests.base import NOW, ApiTestCase, make_account, make_product, make_review

from reviews.models import HelpfulVote, Review


class WriteReviewTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.mug = make_product("Trail Mug")
        self.lamp = make_product("Camp Lamp")
        self.ann, self.bo = make_account("Ann Lee"), make_account("Bo Kim")
        self.moderator = make_account("Mo Derator", role="moderator")

    def write(self, account, product=None, **body):
        body = {"rating": 4, "text": "Solid mug.", **body}
        return self.as_account(account).post(f"/products/{(product or self.mug).id}/reviews/", body, format="json")

    def test_writing_a_review_returns_it(self):
        response = self.write(self.ann, rating=5, text="Keeps coffee hot.")
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["product"], self.mug.id)
        self.assertEqual(body["author"], {"id": self.ann.id, "name": "Ann Lee"})
        self.assertEqual((body["rating"], body["text"]), (5, "Keeps coffee hot."))
        self.assertEqual((body["state"], body["helpful_count"]), ("published", 0))
        self.assertEqual(body["created_at"], "2026-03-02T12:00:00Z")
        self.assertEqual(Review.objects.get(pk=body["id"]).author, self.ann)

    def test_the_new_review_counts_towards_the_summary(self):
        self.write(self.ann, rating=5)
        self.write(self.bo, rating=2)
        body = self.client.get(f"/products/{self.mug.id}/").json()
        self.assertEqual((body["average_rating"], body["review_count"]), (3.5, 2))

    def test_second_review_of_a_product_is_a_conflict(self):
        self.assertEqual(self.write(self.ann).status_code, 201)
        response = self.write(self.ann, rating=1, text="Changed my mind.")
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["error"]["code"], "already_reviewed")
        self.assertEqual(Review.objects.filter(product=self.mug, author=self.ann).count(), 1)

    def test_a_hidden_review_still_blocks_a_second_one(self):
        make_review(self.mug, self.ann, rating=1, state="hidden")
        self.assertEqual(self.write(self.ann).status_code, 409)

    def test_the_same_shopper_can_review_different_products(self):
        self.assertEqual(self.write(self.ann, self.mug).status_code, 201)
        self.assertEqual(self.write(self.ann, self.lamp).status_code, 201)

    def test_two_shoppers_can_review_the_same_product(self):
        self.assertEqual(self.write(self.ann).status_code, 201)
        self.assertEqual(self.write(self.bo).status_code, 201)

    def test_anonymous_callers_get_401(self):
        response = self.write(None)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(Review.objects.count(), 0)

    def test_unknown_product_is_404(self):
        response = self.as_account(self.ann).post("/products/999/reviews/", {"rating": 4, "text": "Hi"}, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_invalid_bodies_are_validation_errors(self):
        for body, field in [({"rating": 0, "text": "x"}, "rating"), ({"rating": 6, "text": "x"}, "rating"),
                            ({"rating": "great", "text": "x"}, "rating"), ({"rating": 4.5, "text": "x"}, "rating"),
                            ({"rating": 4}, "text"), ({"rating": 4, "text": ""}, "text"),
                            ({"rating": 4, "text": "x" * 2001}, "text"), ({"text": "x"}, "rating")]:
            response = self.as_account(self.ann).post(f"/products/{self.mug.id}/reviews/", body, format="json")
            self.assertEqual(response.status_code, 400, (body, response.content))
            error = response.json()["error"]
            self.assertEqual(error["code"], "validation_error")
            self.assertIn(field, error["fields"], body)
        self.assertEqual(Review.objects.count(), 0)


class EditReviewTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.mug = make_product()
        self.ann, self.bo = make_account("Ann Lee"), make_account("Bo Kim")
        self.moderator = make_account("Mo Derator", role="moderator")
        self.review = make_review(self.mug, self.ann, rating=3, text="Okay.")

    def edit(self, account, body, review=None):
        return self.as_account(account).patch(f"/reviews/{(review or self.review).id}/", body, format="json")

    def test_the_author_can_change_the_rating_and_text(self):
        later = NOW + timedelta(days=2)
        self.set_now(later)
        response = self.edit(self.ann, {"rating": 5, "text": "Better after a week."})
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertEqual((body["rating"], body["text"]), (5, "Better after a week."))
        self.assertEqual(body["created_at"], "2026-03-02T12:00:00Z")
        self.assertEqual(body["updated_at"], "2026-03-04T12:00:00Z")

    def test_a_partial_edit_leaves_the_other_field_alone(self):
        self.assertEqual(self.edit(self.ann, {"rating": 1}).status_code, 200)
        review = Review.objects.get(pk=self.review.pk)
        self.assertEqual((review.rating, review.text), (1, "Okay."))

    def test_editing_someone_elses_review_is_forbidden(self):
        response = self.edit(self.bo, {"rating": 1})
        self.assertEqual(response.status_code, 403, response.content)
        self.assertEqual(response.json()["error"]["code"], "not_author")
        self.assertEqual(Review.objects.get(pk=self.review.pk).rating, 3)

    def test_moderators_cannot_edit_either(self):
        self.assertEqual(self.edit(self.moderator, {"rating": 1}).status_code, 403)

    def test_edits_cannot_change_state_or_author(self):
        response = self.edit(self.ann, {"rating": 4, "state": "hidden", "author": self.bo.id})
        self.assertEqual(response.status_code, 200)
        review = Review.objects.get(pk=self.review.pk)
        self.assertEqual((review.state, review.author), ("published", self.ann))

    def test_an_edit_moves_the_product_average(self):
        make_review(self.mug, self.bo, rating=5)
        self.edit(self.ann, {"rating": 4})
        self.assertEqual(self.client.get(f"/products/{self.mug.id}/").json()["average_rating"], 4.5)

    def test_anonymous_callers_get_401(self):
        self.assertEqual(self.edit(None, {"rating": 1}).status_code, 401)

    def test_unknown_review_is_404(self):
        response = self.as_account(self.ann).patch("/reviews/999/", {"rating": 1}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_an_invalid_edit_is_rejected(self):
        response = self.edit(self.ann, {"rating": 9})
        self.assertEqual(response.status_code, 400)
        self.assertIn("rating", response.json()["error"]["fields"])
        self.assertEqual(Review.objects.get(pk=self.review.pk).rating, 3)


class HelpfulVoteTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.mug = make_product()
        self.ann, self.bo, self.cy = make_account("Ann Lee"), make_account("Bo Kim"), make_account("Cy Ortiz")
        self.review = make_review(self.mug, self.ann, rating=5)

    def vote(self, account, review=None):
        return self.as_account(account).post(f"/reviews/{(review or self.review).id}/helpful/")

    def test_a_vote_returns_the_new_total(self):
        response = self.vote(self.bo)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json(), {"review_id": self.review.id, "helpful_count": 1})
        self.assertEqual(self.vote(self.cy).json()["helpful_count"], 2)

    def test_voting_twice_is_a_conflict(self):
        self.vote(self.bo)
        response = self.vote(self.bo)
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["error"]["code"], "already_voted")
        self.assertEqual(HelpfulVote.objects.filter(review=self.review).count(), 1)

    def test_you_cannot_vote_for_your_own_review(self):
        response = self.vote(self.ann)
        self.assertEqual(response.status_code, 403, response.content)
        self.assertEqual(response.json()["error"]["code"], "own_review")
        self.assertEqual(HelpfulVote.objects.count(), 0)

    def test_hidden_reviews_cannot_be_voted_for(self):
        hidden = make_review(self.mug, self.bo, rating=1, state="hidden")
        self.assertEqual(self.vote(self.cy, hidden).status_code, 404)

    def test_anonymous_callers_get_401(self):
        self.assertEqual(self.vote(None).status_code, 401)

    def test_unknown_review_is_404(self):
        self.assertEqual(self.as_account(self.bo).post("/reviews/999/helpful/").status_code, 404)

    def test_the_review_shows_its_helpful_count(self):
        self.vote(self.bo)
        self.vote(self.cy)
        review = self.client.get(f"/products/{self.mug.id}/reviews/").json()["results"][0]
        self.assertEqual(review["helpful_count"], 2)


class ListReviewsTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.mug = make_product("Trail Mug")
        self.other = make_product("Camp Lamp")
        self.people = [make_account(f"Shopper {i}") for i in range(8)]
        # (rating, hours after NOW, helpful votes): oldest first.
        spec = [(3, 0, 0), (5, 1, 2), (5, 2, 0), (2, 3, 3), (4, 4, 2), (5, 5, 2)]
        self.reviews = []
        for author, (rating, hours, votes) in zip(self.people, spec):
            review = make_review(self.mug, author, rating=rating, text=f"Review by {author.name}", created_at=NOW + timedelta(hours=hours))
            self.reviews.append(review)
            for i in range(votes):
                HelpfulVote.objects.create(review=review, account=make_account(f"Voter {review.id}-{i}"))
        make_review(self.mug, self.people[6], rating=1, state="hidden", created_at=NOW + timedelta(hours=9))
        make_review(self.other, self.people[0], rating=5, created_at=NOW + timedelta(hours=9))

    def ids(self, **params):
        response = self.client.get(f"/products/{self.mug.id}/reviews/", params)
        self.assertEqual(response.status_code, 200, response.content)
        return [r["id"] for r in response.json()["results"]], response.json()

    def test_default_order_is_newest_first(self):
        ids, body = self.ids()
        self.assertEqual(ids, [r.id for r in reversed(self.reviews)])
        self.assertEqual((body["count"], body["page"], body["page_size"]), (6, 1, 10))

    def test_sort_by_recent(self):
        self.assertEqual(self.ids(sort="recent")[0], [r.id for r in reversed(self.reviews)])

    def test_sort_by_helpful_breaks_ties_with_newest(self):
        r = self.reviews
        # votes: r3=3, then r1, r4, r5 with 2 each (newest first), then r0 and r2 with none.
        self.assertEqual(self.ids(sort="helpful")[0], [r[3].id, r[5].id, r[4].id, r[1].id, r[2].id, r[0].id])

    def test_sort_by_rating_breaks_ties_with_helpful_then_newest(self):
        r = self.reviews
        # 5 stars: r5 (2 votes), r1 (2 votes, older), r2 (0 votes); then 4 stars r4, 3 stars r0, 2 stars r3.
        self.assertEqual(self.ids(sort="rating")[0], [r[5].id, r[1].id, r[2].id, r[4].id, r[0].id, r[3].id])

    def test_hidden_reviews_and_other_products_are_left_out(self):
        ids, body = self.ids(page_size=100)
        self.assertEqual(len(ids), 6)
        self.assertEqual(body["count"], 6)
        self.assertEqual({r["state"] for r in body["results"]}, {"published"})

    def test_pages_cover_the_list_without_overlap(self):
        everything = self.ids(sort="helpful")[0]
        first, meta = self.ids(sort="helpful", page=1, page_size=4)
        second, _ = self.ids(sort="helpful", page=2, page_size=4)
        self.assertEqual((len(first), len(second), meta["count"], meta["page_size"]), (4, 2, 6, 4))
        self.assertEqual(first + second, everything)

    def test_a_page_past_the_end_is_empty(self):
        ids, body = self.ids(page=5, page_size=4)
        self.assertEqual(ids, [])
        self.assertEqual(body["count"], 6)

    def test_bad_parameters_are_validation_errors(self):
        for params, field in [({"sort": "funny"}, "sort"), ({"page": 0}, "page"), ({"page_size": 0}, "page_size"),
                              ({"page_size": 101}, "page_size"), ({"page": "two"}, "page")]:
            response = self.client.get(f"/products/{self.mug.id}/reviews/", params)
            self.assertEqual(response.status_code, 400, (params, response.content))
            error = response.json()["error"]
            self.assertEqual(error["code"], "validation_error")
            self.assertIn(field, error["fields"])

    def test_unknown_product_is_404(self):
        self.assertEqual(self.client.get("/products/999/reviews/").status_code, 404)

    def test_hiding_a_review_removes_it_from_the_list(self):
        mod = make_account("Mo Derator", role="moderator")
        self.as_account(mod).post(f"/reviews/{self.reviews[5].id}/moderate/", {"state": "hidden"}, format="json")
        ids, body = self.ids()
        self.assertNotIn(self.reviews[5].id, ids)
        self.assertEqual(body["count"], 5)
