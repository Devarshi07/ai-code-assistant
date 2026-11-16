"""The service's clock. Tests pin it with `unittest.mock.patch("ticketing.clock.now", ...)`."""
from django.utils import timezone


def now():
    return timezone.now()
