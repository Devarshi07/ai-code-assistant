"""Clock helpers for the kitchen display.

The ticket printer stamps every ticket with a 12-hour wall-clock time such as
``11:58am`` or ``1:05pm``. Everything inside the kitchen model works in whole
minutes since midnight at the start of service: ``0`` is 12:00am, ``750`` is
12:30pm. A late service can run past midnight, and those minutes keep counting
up, so ``1450`` is 12:10am the next day.
"""
import re

MINUTES_PER_DAY = 24 * 60

_STAMP = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*$", re.IGNORECASE)


class ClockError(ValueError):
    """Raised for a time stamp the ticket printer could not have produced."""


def parse_clock(text):
    """Turn a printer stamp like '9:05am' or '6:30pm' into minutes since midnight."""
    match = _STAMP.match(text)
    if not match:
        raise ClockError(f"not a clock time: {text!r}")
    hours, minutes = int(match.group(1)), int(match.group(2))
    if not 1 <= hours <= 12 or minutes > 59:
        raise ClockError(f"not a clock time: {text!r}")
    if match.group(3).lower() == "pm":
        hours += 12
    return hours * 60 + minutes


def format_clock(minutes):
    """Inverse of parse_clock: 750 -> '12:30pm'. Later days get a '+N' marker."""
    day, minute_of_day = divmod(minutes, MINUTES_PER_DAY)
    hours, mins = divmod(minute_of_day, 60)
    half = "am" if hours < 12 else "pm"
    stamp = f"{hours % 12 or 12}:{mins:02d}{half}"
    return stamp if day == 0 else f"{stamp} +{day}"


def format_duration(minutes):
    """Compact duration for reports: 7 -> '7m', 65 -> '1h05m'."""
    hours, mins = divmod(minutes, 60)
    return f"{mins}m" if hours == 0 else f"{hours}h{mins:02d}m"
