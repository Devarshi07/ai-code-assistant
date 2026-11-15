"""Time helpers.

SlotKeeper measures time in integer minutes since the epoch, which is Monday
00:00 of week 0. There are no time zones, no daylight saving and no seconds.
Day index ``d`` covers minutes ``[d * 1440, (d + 1) * 1440)`` and its weekday is
``d % 7`` (0 = Monday ... 6 = Sunday).
"""

MINUTES_PER_DAY = 1440
SLOT_MINUTES = 15
WEEKDAY_NAMES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def at(day, hour=0, minute=0):
    """Minutes since the epoch for ``hour:minute`` on day index ``day``.

    >>> at(7, 9, 30)   # Monday of week 1, 09:30
    10650
    """
    return day * MINUTES_PER_DAY + hour * 60 + minute


def day_of(t):
    """Day index that contains minute ``t``."""
    return t // MINUTES_PER_DAY


def weekday_of(day):
    """Weekday of a day index: 0 = Monday ... 6 = Sunday."""
    return day % 7


def minute_of_day(t):
    """Minutes since midnight of the day that contains ``t``."""
    return t % MINUTES_PER_DAY


def describe(t):
    """Readable label such as ``'Mon d7 09:30'`` for logs and error messages."""
    day, minute = day_of(t), minute_of_day(t)
    return f"{WEEKDAY_NAMES[weekday_of(day)]} d{day} {minute // 60:02d}:{minute % 60:02d}"
