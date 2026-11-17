"""Reading ingestion and summaries."""
from datetime import date, timezone

from app.errors import not_found
from app.repository import InMemoryRepository
from app.schemas import Reading, ReadingCreate
from app.services.units import to_celsius


class ReadingService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def _require_station(self, station_id: str) -> None:
        if self.repo.get_station(station_id) is None:
            raise not_found("Station", station_id)

    def ingest(self, station_id: str, data: ReadingCreate) -> Reading:
        """Stores one reading, normalised to UTC and Celsius."""
        self._require_station(station_id)
        reading = Reading(
            station_id=station_id,
            timestamp=data.timestamp.astimezone(timezone.utc),
            temperature_c=to_celsius(data.temperature, data.unit),
            humidity=data.humidity,
            pressure_hpa=data.pressure_hpa,
        )
        self.repo.add_reading(reading)
        return reading

    def list_readings(self, station_id: str, limit: int) -> list[Reading]:
        """The latest `limit` readings, oldest first."""
        self._require_station(station_id)
        ordered = sorted(self.repo.readings_for(station_id), key=lambda r: r.timestamp)
        return ordered[-limit:]

    def daily_summary(self, station_id: str, start: date, end: date):
        """Per-UTC-day min/max/mean temperature and reading count, from `start` to `end` inclusive."""
        raise NotImplementedError("Phase 2: daily summaries are not built yet")
