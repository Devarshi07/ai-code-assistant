from django.db import models

from accounts.models import Account


class Event(models.Model):
    organiser = models.ForeignKey(Account, related_name="events", on_delete=models.PROTECT)
    name = models.CharField(max_length=200)
    venue = models.CharField(max_length=200)
    starts_at = models.DateTimeField()

    class Meta:
        ordering = ["starts_at", "id"]

    def __str__(self):
        return self.name


class Seat(models.Model):
    """One numbered seat. Seats are created with their event and never change."""

    event = models.ForeignKey(Event, related_name="seats", on_delete=models.CASCADE)
    section = models.CharField(max_length=40)
    row = models.CharField(max_length=2)
    number = models.PositiveIntegerField()
    price_cents = models.PositiveIntegerField()

    class Meta:
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["event", "section", "row", "number"], name="unique_seat_position")]

    @property
    def label(self):
        return f"{self.section} {self.row}{self.number}"

    def __str__(self):
        return self.label


class Order(models.Model):
    """A completed purchase. Its seats are the holds that point at it."""

    event = models.ForeignKey(Event, related_name="orders", on_delete=models.PROTECT)
    account = models.ForeignKey(Account, related_name="orders", on_delete=models.PROTECT)
    subtotal_cents = models.PositiveIntegerField()
    fee_cents = models.PositiveIntegerField()
    total_cents = models.PositiveIntegerField()
    created_at = models.DateTimeField()

    class Meta:
        ordering = ["id"]


class Hold(models.Model):
    """Keeps one seat for one account until `expires_at`, or for good once it belongs to an order.

    A seat is
      sold      - if any of its holds has an order,
      held      - if it has a hold without an order that has not expired,
      available - otherwise.
    """

    seat = models.ForeignKey(Seat, related_name="holds", on_delete=models.CASCADE)
    account = models.ForeignKey(Account, related_name="holds", on_delete=models.CASCADE)
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    order = models.ForeignKey(Order, related_name="holds", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["id"]

    def is_active(self, now):
        return self.order_id is None and self.expires_at > now
