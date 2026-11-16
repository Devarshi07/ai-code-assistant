"""Time, injected so that retry schedules and signature windows can be tested."""
from datetime import datetime, timedelta, timezone
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(timezone.utc)


class FakeClock:
    """A clock that only moves when told to."""

    def __init__(self, start: datetime | None = None) -> None:
        self._now = start or datetime(2026, 3, 2, 9, 0, tzinfo=timezone.utc)

    def now(self) -> datetime:
        return self._now

    def advance(self, seconds: float) -> datetime:
        self._now += timedelta(seconds=seconds)
        return self._now
