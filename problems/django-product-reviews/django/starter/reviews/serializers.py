from rest_framework import serializers

from accounts.models import Account
from reviews.models import Product, Review


class ProductSerializer(serializers.ModelSerializer):
    """A product with its rating summary: `average_rating` (or null) and `review_count`."""

    class Meta:
        model = Product
        fields = ["id", "name", "sku"]

    def to_representation(self, product):
        data = super().to_representation(product)
        data.update(product.rating_summary())
        return data


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "name"]


class ReviewSerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)
    helpful_count = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "product", "author", "rating", "text", "state", "helpful_count", "created_at", "updated_at"]

    def get_helpful_count(self, review):
        # List queries may annotate `helpful_total` so each review needs no extra query.
        total = getattr(review, "helpful_total", None)
        return review.votes.count() if total is None else total


class ModerationSerializer(serializers.Serializer):
    """Body of POST /reviews/<id>/moderate/."""

    state = serializers.ChoiceField(choices=[Review.PUBLISHED, Review.HIDDEN])
