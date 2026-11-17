"""The service's idea of "now".

Review timestamps come from here, so tests can pin the time with
`unittest.mock.patch("reviews.clock.now", return_value=...)`.
"""
from django.utils import timezone


def now():
    return timezone.now()
