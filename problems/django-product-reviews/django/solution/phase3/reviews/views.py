from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reviews import services
from reviews.pagination import paginate
from reviews.permissions import IsModerator
from reviews.serializers import (ModerationSerializer, ProductSerializer, ReviewInputSerializer, ReviewListParams,
                                 ReviewSerializer)


class ProductList(APIView):
    """GET /products/ pages through the catalogue; POST adds a product (moderators)."""

    def get_permissions(self):
        return [IsModerator()] if self.request.method == "POST" else []

    def get(self, request):
        items, meta = paginate(services.products_with_ratings(), request.query_params)
        return Response({**meta, "results": ProductSerializer(items, many=True).data})

    def post(self, request):
        body = ProductSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(ProductSerializer(body.save()).data, status=status.HTTP_201_CREATED)


class ProductDetail(APIView):
    def get(self, request, product_id):
        return Response(ProductSerializer(services.get_product(product_id, with_ratings=True)).data)


class ProductReviews(APIView):
    """GET lists a product's published reviews (any caller); POST writes one (signed in)."""

    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == "POST" else []

    def get(self, request, product_id):
        params = ReviewListParams(data=request.query_params)
        params.is_valid(raise_exception=True)
        queryset = services.list_reviews(product_id, params.validated_data["sort"])
        items, meta = paginate(queryset, request.query_params)
        return Response({**meta, "results": ReviewSerializer(items, many=True).data})

    def post(self, request, product_id):
        body = ReviewInputSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        review = services.create_review(request.user, product_id, **body.validated_data)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class ReviewModerate(APIView):
    permission_classes = [IsModerator]

    def post(self, request, review_id):
        body = ModerationSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        review = services.moderate_review(review_id, body.validated_data["state"])
        return Response(ReviewSerializer(review).data)


class ReviewDetail(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, review_id):
        body = ReviewInputSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        review = services.update_review(request.user, review_id, **body.validated_data)
        return Response(ReviewSerializer(review).data)

    def delete(self, request, review_id):
        services.delete_review(request.user, review_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReviewHelpful(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):
        total = services.add_helpful_vote(request.user, review_id)
        return Response({"review_id": review_id, "helpful_count": total}, status=status.HTTP_201_CREATED)
