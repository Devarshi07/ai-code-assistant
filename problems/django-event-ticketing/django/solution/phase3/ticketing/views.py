from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ticketing import services
from ticketing.models import Event
from ticketing.permissions import IsEventOrganiser, IsOrganiser
from ticketing.serializers import (EventCreateSerializer, EventSerializer, HoldIdsSerializer, HoldSerializer,
                                   OrderSerializer, SeatIdsSerializer, seat_json)


class EventListCreate(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsOrganiser()]
        return [IsAuthenticated()]

    def get(self, request):
        events = Event.objects.select_related("organiser")
        return Response(EventSerializer(events, many=True).data)

    def post(self, request):
        body = EventCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        event = services.create_event(request.user, **body.validated_data)
        return Response({**EventSerializer(event).data, "seat_count": event.seats.count()}, status=status.HTTP_201_CREATED)


class SeatList(APIView):
    def get(self, request, event_id):
        event = services.get_event(event_id)
        return Response([seat_json(seat, state) for seat, state in services.seat_map(event)])


class Availability(APIView):
    def get(self, request, event_id):
        return Response(services.availability(services.get_event(event_id)))


class HoldCreate(APIView):
    def post(self, request, event_id):
        body = SeatIdsSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        holds = services.place_hold(request.user, event_id, body.validated_data["seat_ids"])
        return Response(HoldSerializer(holds, many=True).data, status=status.HTTP_201_CREATED)


class HoldDetail(APIView):
    def delete(self, request, hold_id):
        services.release_hold(request.user, hold_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderListCreate(APIView):
    def get(self, request):
        return Response(OrderSerializer(services.orders_for(request.user), many=True).data)

    def post(self, request):
        body = HoldIdsSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        key = request.headers.get("Idempotency-Key") or None
        if key is not None and len(key) > 80:
            raise serializers.ValidationError({"Idempotency-Key": ["At most 80 characters."]})
        order = services.checkout(request.user, body.validated_data["hold_ids"], idempotency_key=key)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class EventOrders(APIView):
    permission_classes = [IsAuthenticated, IsEventOrganiser]

    def get(self, request, event_id):
        event = services.get_event(event_id)
        self.check_object_permissions(request, event)
        return Response(OrderSerializer(services.event_orders(event), many=True).data)
