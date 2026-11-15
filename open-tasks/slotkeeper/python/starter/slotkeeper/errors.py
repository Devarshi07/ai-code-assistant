"""Errors raised by the booking engine.

Everything SlotKeeper raises on purpose is a ``BookingError``, so the web layer
can catch the whole family at once and turn it into a friendly message. Tests
check the exact subclass, never the message text.
"""


class BookingError(Exception):
    """Base class for every error SlotKeeper raises on purpose."""


class ValidationError(BookingError):
    """Malformed input: a bad window, duration, buffer, range or limit, an
    off-grid start time, or a duplicate host or meeting-type id."""


class NotFoundError(BookingError):
    """Unknown host, meeting type or booking id. Cancelled bookings count as unknown."""


class TooSoonError(BookingError):
    """The start time is earlier than ``now + min_notice``."""


class SlotUnavailableError(BookingError):
    """The meeting does not fit inside the host's availability for that day."""


class ConflictError(BookingError):
    """The meeting, or a buffer around it, collides with another booking of the same host."""


class DailyLimitError(BookingError):
    """The host already has as many bookings on that day as their daily limit allows."""
