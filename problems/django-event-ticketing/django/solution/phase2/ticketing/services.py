"""Sales rules: seating plans, seat status, holds and orders.

Views stay thin and call these functions. Anything that depends on the time
takes an optional `now` and otherwise asks `ticketing.clock`.
"""
from collections import OrderedDict
from datetime import timedelta

from django.conf import settings
from django.db import transaction

from ticketing import clock
from ticketing.errors import AlreadyOrdered, Forbidden, HoldExpired, InvalidRequest, NotFound, SeatsUnavailable
from ticketing.models import Event, Hold, Order, Seat

ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def get_event(event_id):
    try:
        return Event.objects.select_related("organiser").get(pk=event_id)
    except Event.DoesNotExist:
        raise NotFound(f"Event {event_id} does not exist.")


@transaction.atomic
def create_event(organiser, *, name, venue, starts_at, sections):
    """Creates an event and every seat in its plan. Rows are lettered A, B, C... in each section."""
    event = Event.objects.create(organiser=organiser, name=name, venue=venue, starts_at=starts_at)
    Seat.objects.bulk_create(
        Seat(event=event, section=section["name"], row=ROW_LETTERS[r], number=n, price_cents=section["price_cents"])
        for section in sections
        for r in range(section["rows"])
        for n in range(1, section["seats_per_row"] + 1)
    )
    return event


def seat_status(seat, now):
    """'sold', 'held' or 'available' (see the Hold docstring)."""
    if seat.holds.filter(order__isnull=False).exists():
        return "sold"
    if seat.holds.filter(order__isnull=True, expires_at__gt=now).exists():
        return "held"
    return "available"


def seat_map(event, now=None):
    """Every seat of the event with its status, in seat order: [(seat, status), ...]."""
    now = now or clock.now()
    return [(seat, seat_status(seat, now)) for seat in event.seats.all()]


def availability(event, now=None):
    """Seat counts per section and for the whole event: the body of GET /events/<id>/availability/."""
    sections = OrderedDict()
    for seat, status in seat_map(event, now):
        entry = sections.setdefault(seat.section, {"section": seat.section, "seats": 0, "available": 0, "held": 0, "sold": 0, "from_price_cents": None})
        entry["seats"] += 1
        entry[status] += 1
        if status == "available" and (entry["from_price_cents"] is None or seat.price_cents < entry["from_price_cents"]):
            entry["from_price_cents"] = seat.price_cents
    rows = sorted(sections.values(), key=lambda s: s["section"])
    totals = {key: sum(s[key] for s in rows) for key in ("seats", "available", "held", "sold")}
    return {"event_id": event.id, "sections": rows, "totals": totals}


def place_hold(account, event_id, seat_ids, now=None):
    """Holds the given seats of an event for HOLD_MINUTES, all or nothing."""
    now = now or clock.now()
    event = get_event(event_id)
    wanted = list(dict.fromkeys(seat_ids))
    seats = list(event.seats.filter(id__in=wanted))
    missing = sorted(set(wanted) - {seat.id for seat in seats})
    if missing:
        raise NotFound(f"These seats are not part of {event.name}.", seats=missing)
    with transaction.atomic():
        taken = [seat.id for seat in seats if seat_status(seat, now) != "available"]
        if taken:
            raise SeatsUnavailable("Some of these seats are held or sold.", seats=taken)
        expires_at = now + timedelta(minutes=settings.HOLD_MINUTES)
        return [Hold.objects.create(seat=seat, account=account, created_at=now, expires_at=expires_at) for seat in seats]


def release_hold(account, hold_id):
    """Gives a held seat back before the hold runs out."""
    try:
        hold = Hold.objects.get(pk=hold_id)
    except Hold.DoesNotExist:
        raise NotFound(f"Hold {hold_id} does not exist.")
    if hold.account_id != account.id:
        raise Forbidden("This hold belongs to someone else.")
    if hold.order_id is not None:
        raise AlreadyOrdered("This seat has been paid for; it can't be released.", order_id=hold.order_id)
    hold.delete()


def orders_for(account):
    """The caller's own orders, oldest first."""
    return account.orders.select_related("account")


@transaction.atomic
def checkout(account, hold_ids, now=None):
    """Turns the caller's holds into one order: the body of POST /orders/.

    All or nothing: every hold must exist, belong to the caller, be unpaid and
    unexpired, and be for the same event.
    """
    now = now or clock.now()
    wanted = list(dict.fromkeys(hold_ids))
    holds = list(Hold.objects.select_related("seat").filter(id__in=wanted))
    missing = sorted(set(wanted) - {hold.id for hold in holds})
    if missing:
        raise NotFound("Some of these holds do not exist.", holds=missing)
    if any(hold.account_id != account.id for hold in holds):
        raise Forbidden("Some of these holds belong to someone else.")
    paid = [hold.id for hold in holds if hold.order_id is not None]
    if paid:
        raise AlreadyOrdered("Some of these holds have already been paid for.", holds=paid)
    expired = [hold.id for hold in holds if hold.expires_at <= now]
    if expired:
        raise HoldExpired("Some holds ran out before checkout. Hold the seats again.", holds=expired)
    events = {hold.seat.event_id for hold in holds}
    if len(events) != 1:
        raise InvalidRequest("An order covers one event.", fields={"hold_ids": ["All holds must be for the same event."]})
    subtotal = sum(hold.seat.price_cents for hold in holds)
    fee = settings.BOOKING_FEE_CENTS * len(holds)
    order = Order.objects.create(event_id=events.pop(), account=account, subtotal_cents=subtotal, fee_cents=fee,
                                 total_cents=subtotal + fee, created_at=now)
    # Claim only holds that are still unpaid, in case another checkout got there first.
    claimed = Hold.objects.filter(id__in=wanted, order__isnull=True).update(order=order)
    if claimed != len(wanted):
        raise AlreadyOrdered("Some of these holds have already been paid for.")
    return order


def event_orders(event):
    """Every order for an event, oldest first (for its organiser)."""
    return event.orders.select_related("account")
