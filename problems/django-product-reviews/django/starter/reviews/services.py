"""The rules of the reviews service. Views call these functions and stay thin."""
from reviews.errors import NotAuthor, NotFound
from reviews.models import Product, Review


def get_product(product_id):
    try:
        return Product.objects.get(pk=product_id)
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

def create_review(account, product_id, rating, text):
    """Adds `account`'s review of a product. One review per account per product."""
    raise NotImplementedError("Phase 2: create a review, refusing a second one by the same account")


def update_review(account, review_id, **changes):
    """Edits the `rating` and/or `text` of a review. Only its author may."""
    raise NotImplementedError("Phase 2: edit your own review")


def add_helpful_vote(account, review_id):
    """Records that `account` found a review helpful and returns the new vote total."""
    raise NotImplementedError("Phase 2: helpful votes")


def list_reviews(product_id, sort):
    """Published reviews of a product as an ordered queryset: `sort` is helpful, recent or rating."""
    raise NotImplementedError("Phase 2: list a product's reviews in the requested order")
