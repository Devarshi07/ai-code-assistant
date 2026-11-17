from django.db import models
from django.db.models import Count, Sum

from accounts.models import Account
from reviews import clock, ratings


def _now():
    return clock.now()


class Product(models.Model):
    """Something the shop sells. Its reviews live in `Review`."""

    name = models.CharField(max_length=200)
    sku = models.CharField(max_length=32, unique=True)
    created_at = models.DateTimeField(default=_now)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name

    def rating_summary(self):
        """`{"average_rating", "review_count"}` worked out from this product's reviews."""
        totals = self.reviews.published().aggregate(total=Sum("rating"), count=Count("id"))
        return ratings.summary(totals["total"] or 0, totals["count"])


class ReviewQuerySet(models.QuerySet):
    def published(self):
        """Reviews shoppers can see: not hidden by a moderator."""
        return self.filter(state=Review.PUBLISHED)


class Review(models.Model):
    """One shopper's opinion of one product. A shopper writes at most one per product."""

    PUBLISHED = "published"
    HIDDEN = "hidden"
    STATES = [(PUBLISHED, "Published"), (HIDDEN, "Hidden")]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews")
    author = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    text = models.TextField()
    state = models.CharField(max_length=10, choices=STATES, default=PUBLISHED)
    created_at = models.DateTimeField(default=_now)
    updated_at = models.DateTimeField(default=_now)

    objects = ReviewQuerySet.as_manager()

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["product", "author"], name="one_review_per_author_per_product"),
        ]

    def __str__(self):
        return f"{self.rating}/5 by {self.author_id} on product {self.product_id}"


class HelpfulVote(models.Model):
    """A shopper's "this review helped me". One per account per review."""

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="votes")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="helpful_votes")
    created_at = models.DateTimeField(default=_now)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["review", "account"], name="one_vote_per_account_per_review"),
        ]
