from django.db import models


class Account(models.Model):
    """Someone who uses the API: a shopper who writes reviews, or a moderator who polices them."""

    SHOPPER = "shopper"
    MODERATOR = "moderator"
    ROLES = [(SHOPPER, "Shopper"), (MODERATOR, "Moderator")]

    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=ROLES, default=SHOPPER)
    api_key = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.name} ({self.role})"

    # DRF's IsAuthenticated asks the request's user this.
    is_authenticated = True

    @property
    def is_moderator(self):
        return self.role == self.MODERATOR
