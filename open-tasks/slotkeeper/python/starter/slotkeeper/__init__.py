"""SlotKeeper: the booking engine behind a Calendly-style scheduling app."""

from .errors import (
    BookingError,
    ConflictError,
    DailyLimitError,
    NotFoundError,
    SlotUnavailableError,
    TooSoonError,
    ValidationError,
)
from .service import SlotKeeper

__all__ = [
    "SlotKeeper",
    "BookingError",
    "ValidationError",
    "NotFoundError",
    "TooSoonError",
    "SlotUnavailableError",
    "ConflictError",
    "DailyLimitError",
]
