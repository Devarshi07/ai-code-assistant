"""In-memory storage for stations and readings.

The production service keeps the same interface over PostgreSQL; this version
keeps everything in dictionaries so the API runs without a database.
"""
from datetime import datetime

from app.schemas import Reading, Station


class InMemoryRepository:
    def __init__(self) -> None:
        self.stations: dict[str, Station] = {}
        # station id -> readings in the order they arrived.
        self.readings: dict[str, list[Reading]] = {}
        # (station id, UTC timestamp) of every stored reading, for the duplicate check.
        self._seen: set[tuple[str, datetime]] = set()

    # Stations

    def get_station(self, station_id: str) -> Station | None:
        return self.stations.get(station_id)

    def add_station(self, station: Station) -> None:
        self.stations[station.id] = station
        self.readings.setdefault(station.id, [])

    def list_stations(self) -> list[Station]:
        return [self.stations[key] for key in sorted(self.stations)]

    # Readings

    def add_reading(self, reading: Reading) -> None:
        self.readings[reading.station_id].append(reading)
        self._seen.add((reading.station_id, reading.timestamp))

    def has_reading(self, station_id: str, timestamp: datetime) -> bool:
        return (station_id, timestamp) in self._seen

    def readings_for(self, station_id: str) -> list[Reading]:
        """Every reading of one station, in arrival order."""
        return self.readings.get(station_id, [])
