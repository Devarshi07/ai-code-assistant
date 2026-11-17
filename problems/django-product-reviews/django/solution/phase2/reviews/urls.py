from django.urls import path

from reviews import views

urlpatterns = [
    path("products/", views.ProductList.as_view()),
    path("products/<int:product_id>/", views.ProductDetail.as_view()),
    path("products/<int:product_id>/reviews/", views.ProductReviews.as_view()),
    path("reviews/<int:review_id>/", views.ReviewDetail.as_view()),
    path("reviews/<int:review_id>/helpful/", views.ReviewHelpful.as_view()),
    path("reviews/<int:review_id>/moderate/", views.ReviewModerate.as_view()),
]
