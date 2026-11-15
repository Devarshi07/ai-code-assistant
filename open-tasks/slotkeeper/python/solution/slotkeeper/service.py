"""The SlotKeeper booking engine (reference solution).

Conventions used by every method:

* Times are integer minutes since Monday 00:00 of week 0 (see ``timeutil``).
* Intervals are half-open: ``[start, end)``.
* Methods that depend on the current time take ``now`` explicitly.
* A method that raises leaves the service exactly as it was.
"""

from collections import Counter

from .errors import (
    ConflictError,
    DailyLimitError,
    NotFoundError,
    SlotUnavailableError,
    TooSoonError,
    ValidationError,
)
from .timeutil import MINUTES_PER_DAY, SLOT_MINUTES, day_of, describe, weekday_of


def _is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def _span(start, end):
    """Validate one minute-of-day span."""
    if not (_is_int(start) and _is_int(end) and 0 <= start < end <= MINUTES_PER_DAY):
        raise ValidationError(f"a window needs 0 <= start < end <= 1440, got ({start!r}, {end!r})")
    return (start, end)


def _merge(spans):
    """Union of spans as a sorted list of disjoint, non-touching spans."""
    merged = []
    for start, end in sorted(spans):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [tuple(span) for span in merged]


def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


class _Host:
    def __init__(self, weekly):
        self.weekly = weekly      # weekday -> merged spans
        self.overrides = {}       # day index -> merged spans
        self.daily_limit = None


class _MeetingType:
    def __init__(self, host_id, type_id, duration, before, after, notice):
        self.host_id = host_id
        self.type_id = type_id
        self.duration = duration
        self.before = before
        self.after = after
        self.notice = notice


class SlotKeeper:
    """In-memory booking engine for hosts, meeting types and bookings."""

    def __init__(self):
        self._hosts = {}
        self._types = {}
        self._bookings = {}   # booking id -> record dict
        self._next_id = 1

    # ---------------------------------------------------------------- lookups

    def _host(self, host_id):
        try:
            return self._hosts[host_id]
        except (KeyError, TypeError):
            raise NotFoundError(f"unknown host {host_id!r}") from None

    def _type(self, type_id):
        try:
            return self._types[type_id]
        except (KeyError, TypeError):
            raise NotFoundError(f"unknown meeting type {type_id!r}") from None

    def _booking(self, booking_id):
        try:
            return self._bookings[booking_id]
        except (KeyError, TypeError):
            raise NotFoundError(f"unknown booking {booking_id!r}") from None

    # ----------------------------------------------------------------- Part 1

    def add_host(self, host_id, windows):
        if host_id in self._hosts:
            raise ValidationError(f"host {host_id!r} already exists")
        weekly = {weekday: [] for weekday in range(7)}
        for window in windows:
            try:
                weekday, start, end = window
            except (TypeError, ValueError):
                raise ValidationError(f"a weekly window is (weekday, start, end), got {window!r}") from None
            if not (_is_int(weekday) and 0 <= weekday <= 6):
                raise ValidationError(f"weekday must be 0-6, got {weekday!r}")
            weekly[weekday].append(_span(start, end))
        self._hosts[host_id] = _Host({weekday: _merge(spans) for weekday, spans in weekly.items()})

    def add_meeting_type(self, host_id, type_id, duration, *, buffer_before=0, buffer_after=0, min_notice=0):
        self._host(host_id)
        if type_id in self._types:
            raise ValidationError(f"meeting type {type_id!r} already exists")
        if not (_is_int(duration) and 1 <= duration <= MINUTES_PER_DAY):
            raise ValidationError(f"duration must be 1-1440 minutes, got {duration!r}")
        for name, value in (("buffer_before", buffer_before), ("buffer_after", buffer_after), ("min_notice", min_notice)):
            if not (_is_int(value) and value >= 0):
                raise ValidationError(f"{name} must be a non-negative integer, got {value!r}")
        self._types[type_id] = _MeetingType(host_id, type_id, duration, buffer_before, buffer_after, min_notice)

    def list_slots(self, type_id, first_day, last_day, now):
        kind = self._type(type_id)
        if last_day < first_day:
            raise ValidationError("last_day must not be before first_day")
        slots = []
        for day in range(first_day, last_day + 1):
            base = day * MINUTES_PER_DAY
            for start in range(base, base + MINUTES_PER_DAY, SLOT_MINUTES):
                if self._problem(kind, start, now) is None:
                    slots.append(start)
        return slots

    def book(self, type_id, start, invitee, now):
        kind = self._type(type_id)
        problem = self._problem(kind, start, now)
        if problem:
            raise problem
        booking_id = self._next_id
        self._next_id += 1
        self._bookings[booking_id] = {
            "id": booking_id,
            "type_id": kind.type_id,
            "host_id": kind.host_id,
            "start": start,
            "end": start + kind.duration,
            "invitee": invitee,
        }
        return booking_id

    def get_booking(self, booking_id):
        return dict(self._booking(booking_id))

    def list_bookings(self, host_id):
        self._host(host_id)
        mine = [dict(b) for b in self._bookings.values() if b["host_id"] == host_id]
        return sorted(mine, key=lambda b: (b["start"], b["id"]))

    # ----------------------------------------------------------------- Part 2

    def cancel(self, booking_id):
        self._booking(booking_id)
        del self._bookings[booking_id]

    def reschedule(self, booking_id, new_start, now):
        booking = self._booking(booking_id)
        kind = self._types[booking["type_id"]]
        problem = self._problem(kind, new_start, now, ignore=booking_id)
        if problem:
            raise problem
        booking["start"] = new_start
        booking["end"] = new_start + kind.duration

    def set_daily_limit(self, host_id, limit):
        host = self._host(host_id)
        if limit is not None and not (_is_int(limit) and limit >= 1):
            raise ValidationError(f"limit must be None or at least 1, got {limit!r}")
        host.daily_limit = limit

    # ----------------------------------------------------------------- Part 3

    def set_override(self, host_id, day, windows):
        host = self._host(host_id)
        if not _is_int(day):
            raise ValidationError(f"day must be an integer, got {day!r}")
        spans = []
        for window in windows:
            try:
                start, end = window
            except (TypeError, ValueError):
                raise ValidationError(f"an override window is (start, end), got {window!r}") from None
            spans.append(_span(start, end))
        host.overrides[day] = _merge(spans)

    def clear_override(self, host_id, day):
        self._host(host_id).overrides.pop(day, None)

    def busiest_days(self, host_id, k):
        self._host(host_id)
        if not (_is_int(k) and k >= 1):
            raise ValidationError(f"k must be at least 1, got {k!r}")
        counts = Counter(day_of(b["start"]) for b in self._bookings.values() if b["host_id"] == host_id)
        return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:k]

    # ---------------------------------------------------------------- checks

    def _spans_for(self, host, day):
        spans = host.overrides.get(day)
        return host.weekly[weekday_of(day)] if spans is None else spans

    def _problem(self, kind, start, now, ignore=None):
        """Return the error for the first failing check (2-6), or None."""
        if not _is_int(start) or start % SLOT_MINUTES:
            return ValidationError(f"start must be a multiple of {SLOT_MINUTES} minutes, got {start!r}")
        if start < now + kind.notice:
            return TooSoonError(f"{describe(start)} is inside the {kind.notice}-minute notice period")
        end = start + kind.duration
        host = self._hosts[kind.host_id]
        day = day_of(start)
        base = day * MINUTES_PER_DAY
        if not any(base + s <= start and end <= base + e for s, e in self._spans_for(host, day)):
            return SlotUnavailableError(f"the host is not available for all of {describe(start)}-{describe(end)}")
        others = [b for b in self._bookings.values() if b["host_id"] == kind.host_id and b["id"] != ignore]
        for other in others:
            other_kind = self._types[other["type_id"]]
            if _overlaps(start - kind.before, end + kind.after, other["start"], other["end"]) or _overlaps(
                start, end, other["start"] - other_kind.before, other["end"] + other_kind.after
            ):
                return ConflictError(f"{describe(start)} collides with booking {other['id']}")
        if host.daily_limit is not None:
            if sum(1 for b in others if day_of(b["start"]) == day) >= host.daily_limit:
                return DailyLimitError(f"day {day} already has {host.daily_limit} bookings")
        return None
