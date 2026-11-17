from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from reviews import services
from reviews.models import Product
from reviews.pagination import paginate
from reviews.permissions import IsModerator
from reviews.serializers import ModerationSerializer, ProductSerializer, ReviewSerializer


class ProductList(APIView):
    """GET /products/ pages through the catalogue; POST adds a product (moderators)."""

    def get_permissions(self):
        return [IsModerator()] if self.request.method == "POST" else []

    def get(self, request):
        items, meta = paginate(Product.objects.all(), request.query_params)
        return Response({**meta, "results": ProductSerializer(items, many=True).data})

    def post(self, request):
        body = ProductSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        return Response(ProductSerializer(body.save()).data, status=status.HTTP_201_CREATED)


class ProductDetail(APIView):
    def get(self, request, product_id):
        return Response(ProductSerializer(services.get_product(product_id)).data)


class ReviewModerate(APIView):
    permission_classes = [IsModerator]

    def post(self, request, review_id):
        body = ModerationSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        review = services.moderate_review(review_id, body.validated_data["state"])
        return Response(ReviewSerializer(review).data)


class ReviewDetail(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, review_id):
        services.delete_review(request.user, review_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
