"""The SlotKeeper booking engine. README.md has the full brief.

Conventions used by every method:

* Times are integer minutes since Monday 00:00 of week 0 (see ``timeutil``).
* Intervals are half-open: ``[start, end)``.
* Methods that depend on the current time take ``now`` explicitly.
* A method that raises leaves the service exactly as it was.
"""

from .errors import (  # noqa: F401  (you will need these)
    ConflictError,
    DailyLimitError,
    NotFoundError,
    SlotUnavailableError,
    TooSoonError,
    ValidationError,
)
from .timeutil import MINUTES_PER_DAY, SLOT_MINUTES, day_of, weekday_of  # noqa: F401


class SlotKeeper:
    """In-memory booking engine for hosts, meeting types and bookings."""

    def __init__(self):
        pass  # set up your state here

    # ------------------------------------------------------------------
    # Part 1 · Core
    # ------------------------------------------------------------------

    def add_host(self, host_id, windows):
        """Register a host with a weekly availability pattern.

        ``windows`` is a list of ``(weekday, start, end)`` tuples: ``weekday``
        is 0-6 (0 = Monday) and ``start``/``end`` are minutes of the day with
        ``0 <= start < end <= 1440``. The host is free from ``start``
        (inclusive) to ``end`` (exclusive) on every such weekday. Windows may
        overlap or touch; a day's availability is the union of its windows.
        An empty list is allowed.

        Raises ValidationError for a duplicate ``host_id`` or a malformed window.
        """
        raise NotImplementedError("Part 1: add_host")

    def add_meeting_type(self, host_id, type_id, duration, *, buffer_before=0, buffer_after=0, min_notice=0):
        """Define a meeting type offered by ``host_id``. All numbers are minutes.

        ``type_id`` is unique across the whole service. Buffers are stored in
        Part 1 and enforced in Part 2.

        Raises NotFoundError for an unknown host. Raises ValidationError for a
        duplicate ``type_id``, a ``duration`` outside 1..1440, or a negative
        buffer or ``min_notice``.
        """
        raise NotImplementedError("Part 1: add_meeting_type")

    def list_slots(self, type_id, first_day, last_day, now):
        """Return every start time ``book`` would accept right now, ascending.

        Covers the day indices ``first_day`` to ``last_day``, both inclusive.
        Candidate starts are the multiples of 15 minutes within those days.

        Raises NotFoundError for an unknown type, ValidationError if
        ``last_day < first_day``.
        """
        raise NotImplementedError("Part 1: list_slots")

    def book(self, type_id, start, invitee, now):
        """Book ``[start, start + duration)`` for ``invitee``; return the new id.

        Ids are 1, 2, 3, ... in order of successful bookings and are never
        reused. Checks run in this order and the first failure is raised:

        1. NotFoundError         unknown ``type_id``
        2. ValidationError       ``start`` is not a multiple of 15
        3. TooSoonError          ``start < now + min_notice``
        4. SlotUnavailableError  the meeting is not inside the host's
                                 availability on the day containing ``start``
                                 (meetings never cross midnight)
        5. ConflictError         overlaps another booking of the same host
                                 (Part 2: including buffers)
        6. DailyLimitError       Part 2: the host's daily limit is reached
        """
        raise NotImplementedError("Part 1: book")

    def get_booking(self, booking_id):
        """Return ``{"id", "type_id", "host_id", "start", "end", "invitee"}``.

        Raises NotFoundError for an unknown or cancelled id.
        """
        raise NotImplementedError("Part 1: get_booking")

    def list_bookings(self, host_id):
        """Return the host's active bookings (dicts as above), sorted by start.

        Raises NotFoundError for an unknown host.
        """
        raise NotImplementedError("Part 1: list_bookings")

    # ------------------------------------------------------------------
    # Part 2 · Buffers, changes and limits
    # ------------------------------------------------------------------

    def cancel(self, booking_id):
        """Remove a booking, freeing its time and its place in the daily count.

        Raises NotFoundError for an unknown or already cancelled id.
        """
        raise NotImplementedError("Part 2: cancel")

    def reschedule(self, booking_id, new_start, now):
        """Move a booking to ``new_start``, keeping its id, type and invitee.

        Raises NotFoundError first for an unknown or cancelled id, then runs
        checks 2-6 of ``book`` using the booking's meeting type and ignoring
        the booking being moved. Atomic: on any error the booking keeps its
        original time.
        """
        raise NotImplementedError("Part 2: reschedule")

    def set_daily_limit(self, host_id, limit):
        """Allow at most ``limit`` bookings per day for this host; ``None`` removes the cap.

        A booking counts towards the day containing its start, whatever its
        meeting type. Existing bookings are never cancelled by a lower cap.

        Raises NotFoundError for an unknown host, ValidationError if ``limit``
        is not None and less than 1.
        """
        raise NotImplementedError("Part 2: set_daily_limit")

    # ------------------------------------------------------------------
    # Part 3 · Stretch
    # ------------------------------------------------------------------

    def set_override(self, host_id, day, windows):
        """Replace the weekly pattern for one day index.

        ``windows`` is a list of ``(start, end)`` minute-of-day tuples with the
        same rules as weekly windows; an empty list makes the day a day off.
        Setting an override again replaces the earlier one. Existing bookings
        are kept.

        Raises NotFoundError for an unknown host, ValidationError for a
        malformed window.
        """
        raise NotImplementedError("Part 3: set_override")

    def clear_override(self, host_id, day):
        """Return ``day`` to the weekly pattern. Does nothing if there is no override.

        Raises NotFoundError for an unknown host.
        """
        raise NotImplementedError("Part 3: clear_override")

    def busiest_days(self, host_id, k):
        """Return up to ``k`` ``(day, count)`` tuples, busiest first.

        Only days with at least one active booking appear. Sorted by count
        descending, then day ascending.

        Raises NotFoundError for an unknown host, ValidationError if ``k < 1``.
        """
        raise NotImplementedError("Part 3: busiest_days")
