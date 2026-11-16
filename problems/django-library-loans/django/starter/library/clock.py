"""The library's idea of "today".

Everything that depends on the date (due dates, overdue checks, fines) asks
this module, so tests can pin the date with
`unittest.mock.patch("library.clock.today", return_value=date(...))`.
"""
from django.utils import timezone


def today():
    return timezone.localdate()
