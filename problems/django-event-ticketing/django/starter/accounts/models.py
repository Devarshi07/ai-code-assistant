from django.db import models


class Account(models.Model):
    """Someone who uses the API: an organiser who runs events, or an attendee who buys seats."""

    ORGANISER = "organiser"
    ATTENDEE = "attendee"
    ROLES = [(ORGANISER, "Organiser"), (ATTENDEE, "Attendee")]

    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=ROLES, default=ATTENDEE)
    api_key = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.role})"

    # DRF's IsAuthenticated asks the request's user this.
    is_authenticated = True

    @property
    def is_organiser(self):
        return self.role == self.ORGANISER
