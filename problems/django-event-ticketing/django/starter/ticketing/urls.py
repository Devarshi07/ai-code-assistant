from django.urls import path

from ticketing import views

urlpatterns = [
    path("events/", views.EventListCreate.as_view()),
    path("events/<int:event_id>/seats/", views.SeatList.as_view()),
    path("events/<int:event_id>/availability/", views.Availability.as_view()),
    path("events/<int:event_id>/holds/", views.HoldCreate.as_view()),
    path("events/<int:event_id>/orders/", views.EventOrders.as_view()),
    path("holds/<int:hold_id>/", views.HoldDetail.as_view()),
    path("orders/", views.OrderListCreate.as_view()),
]
