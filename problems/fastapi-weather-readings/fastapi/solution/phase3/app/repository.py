"""In-memory storage for stations and readings.

The production service keeps the same interface over PostgreSQL; this version
keeps everything in dictionaries so the API runs without a database.
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.schemas import Reading, Station
from app.services.units import to_hundredths


@dataclass
class DayAggregate:
    """Running totals for one station and one UTC day, in integer hundredths of a degree."""

    min_h: int
    max_h: int
    total_h: int
    count: int


class InMemoryRepository:
    def __init__(self) -> None:
        self.stations: dict[str, Station] = {}
        # station id -> readings in the order they arrived.
        self.readings: dict[str, list[Reading]] = {}
        # (station id, UTC timestamp) of every stored reading, for the duplicate check.
        self._seen: set[tuple[str, datetime]] = set()
        # station id -> UTC day -> aggregate, updated on every ingest.
        self._days: dict[str, dict[date, DayAggregate]] = {}

    # Stations

    def get_station(self, station_id: str) -> Station | None:
        return self.stations.get(station_id)

    def add_station(self, station: Station) -> None:
        self.stations[station.id] = station
        self.readings.setdefault(station.id, [])
        self._days.setdefault(station.id, {})

    def list_stations(self) -> list[Station]:
        return [self.stations[key] for key in sorted(self.stations)]

    # Readings

    def add_reading(self, reading: Reading) -> None:
        self.readings[reading.station_id].append(reading)
        self._seen.add((reading.station_id, reading.timestamp))
        value = to_hundredths(reading.temperature_c)
        days = self._days[reading.station_id]
        day = reading.timestamp.date()
        aggregate = days.get(day)
        if aggregate is None:
            days[day] = DayAggregate(value, value, value, 1)
        else:
            aggregate.min_h = min(aggregate.min_h, value)
            aggregate.max_h = max(aggregate.max_h, value)
            aggregate.total_h += value
            aggregate.count += 1

    def has_reading(self, station_id: str, timestamp: datetime) -> bool:
        return (station_id, timestamp) in self._seen

    def readings_for(self, station_id: str) -> list[Reading]:
        """Every reading of one station, in arrival order."""
        return self.readings.get(station_id, [])

    def day_aggregates(self, station_id: str, start: date, end: date) -> list[tuple[date, DayAggregate]]:
        """Aggregates for the days from `start` to `end` inclusive that have readings, oldest first."""
        days = self._days.get(station_id, {})
        result = []
        day = start
        while day <= end:
            aggregate = days.get(day)
            if aggregate is not None:
                result.append((day, aggregate))
            day += timedelta(days=1)
        return result
