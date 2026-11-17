"""The rules of the reviews service. Views call these functions and stay thin."""
from django.db import IntegrityError, transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce

from reviews import clock
from reviews.errors import AlreadyReviewed, AlreadyVoted, NotAuthor, NotFound, OwnReview
from reviews.models import HelpfulVote, Product, Review


def products_with_ratings():
    """Products carrying the two numbers their rating summary is made of, computed by the database.

    `rating_total` is the sum of the published ratings and `rating_count` how many there are, both
    from one grouped query, so a page of products costs the same however many reviews exist.
    """
    published = Q(reviews__state=Review.PUBLISHED)
    return Product.objects.annotate(
        rating_total=Coalesce(Sum("reviews__rating", filter=published), 0),
        rating_count=Count("reviews", filter=published),
    )


def get_product(product_id, with_ratings=False):
    try:
        return (products_with_ratings() if with_ratings else Product.objects).get(pk=product_id)
    except Product.DoesNotExist:
        raise NotFound("No such product.") from None


def get_review(review_id):
    try:
        return Review.objects.select_related("author").get(pk=review_id)
    except Review.DoesNotExist:
        raise NotFound("No such review.") from None


def moderate_review(review_id, state):
    """A moderator hides a review (or publishes it again)."""
    review = get_review(review_id)
    review.state = state
    review.save(update_fields=["state"])
    return review


def delete_review(account, review_id):
    """Authors can delete their own reviews; moderators can delete any."""
    review = get_review(review_id)
    if review.author_id != account.id and not account.is_moderator:
        raise NotAuthor("You can only delete your own reviews.")
    review.delete()


# --- Phase 2 -----------------------------------------------------------------

SORT_ORDERS = {
    "recent": ("-created_at", "-id"),
    "helpful": ("-helpful_total", "-created_at", "-id"),
    "rating": ("-rating", "-helpful_total", "-created_at", "-id"),
}


def create_review(account, product_id, rating, text):
    """Adds `account`'s review of a product. One review per account per product."""
    product = get_product(product_id)
    already = AlreadyReviewed("You have already reviewed this product.")
    if Review.objects.filter(product=product, author=account).exists():
        raise already
    now = clock.now()
    try:
        # The unique constraint is the real guard: two simultaneous requests cannot both pass it.
        with transaction.atomic():
            return Review.objects.create(product=product, author=account, rating=rating, text=text,
                                         created_at=now, updated_at=now)
    except IntegrityError:
        raise already from None


def update_review(account, review_id, **changes):
    """Edits the `rating` and/or `text` of a review. Only its author may."""
    review = get_review(review_id)
    if review.author_id != account.id:
        raise NotAuthor("You can only edit your own reviews.")
    for field in ("rating", "text"):
        if field in changes:
            setattr(review, field, changes[field])
    review.updated_at = clock.now()
    review.save(update_fields=["rating", "text", "updated_at"])
    return review


def add_helpful_vote(account, review_id):
    """Records that `account` found a review helpful and returns the new vote total."""
    review = get_review(review_id)
    if review.state != Review.PUBLISHED:
        raise NotFound("No such review.")
    if review.author_id == account.id:
        raise OwnReview("You cannot vote for your own review.")
    try:
        with transaction.atomic():
            HelpfulVote.objects.create(review=review, account=account, created_at=clock.now())
    except IntegrityError:
        raise AlreadyVoted("You have already voted for this review.") from None
    return review.votes.count()


def list_reviews(product_id, sort):
    """Published reviews of a product as an ordered queryset: `sort` is helpful, recent or rating."""
    product = get_product(product_id)
    return (Review.objects.published().filter(product=product).select_related("author")
            .annotate(helpful_total=Count("votes")).order_by(*SORT_ORDERS[sort]))
