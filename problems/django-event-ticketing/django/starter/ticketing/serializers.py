from django.conf import settings
from rest_framework import serializers

from ticketing.models import Event, Hold, Order


class SectionLayoutSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=40)
    rows = serializers.IntegerField(min_value=1, max_value=26)
    seats_per_row = serializers.IntegerField(min_value=1, max_value=60)
    price_cents = serializers.IntegerField(min_value=0)


class EventCreateSerializer(serializers.Serializer):
    """Body of POST /events/: the event and its seating plan."""

    name = serializers.CharField(max_length=200)
    venue = serializers.CharField(max_length=200)
    starts_at = serializers.DateTimeField()
    sections = SectionLayoutSerializer(many=True, allow_empty=False)

    def validate_sections(self, sections):
        names = [s["name"] for s in sections]
        if len(names) != len(set(names)):
            raise serializers.ValidationError("Section names must be unique.")
        return sections


class EventSerializer(serializers.ModelSerializer):
    organiser = serializers.CharField(source="organiser.name", read_only=True)

    class Meta:
        model = Event
        fields = ["id", "name", "venue", "starts_at", "organiser"]


def seat_json(seat, status):
    return {"id": seat.id, "label": seat.label, "section": seat.section, "row": seat.row,
            "number": seat.number, "price_cents": seat.price_cents, "status": status}


class SeatIdsSerializer(serializers.Serializer):
    """Body of POST /events/<id>/holds/."""

    seat_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False,
                                     max_length=settings.MAX_SEATS_PER_REQUEST)


class HoldIdsSerializer(serializers.Serializer):
    """Body of POST /orders/."""

    hold_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False,
                                     max_length=settings.MAX_SEATS_PER_REQUEST)


class HoldSerializer(serializers.ModelSerializer):
    seat = serializers.CharField(source="seat.label", read_only=True)

    class Meta:
        model = Hold
        fields = ["id", "seat_id", "seat", "created_at", "expires_at"]


class OrderSerializer(serializers.ModelSerializer):
    account = serializers.SerializerMethodField()
    seats = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "event_id", "account", "seats", "subtotal_cents", "fee_cents", "total_cents", "created_at"]

    def get_account(self, order):
        return {"id": order.account.id, "name": order.account.name}

    def get_seats(self, order):
        return [hold.seat.label for hold in order.holds.order_by("seat_id")]
