"""Reading ingestion and summaries."""
from datetime import date, timezone

from app.errors import conflict, invalid, not_found
from app.repository import InMemoryRepository
from app.schemas import DailySummary, DailySummaryResponse, Reading, ReadingCreate
from app.services.units import mean_c, to_celsius, to_hundredths

MAX_RANGE_DAYS = 366


class ReadingService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def _require_station(self, station_id: str) -> None:
        if self.repo.get_station(station_id) is None:
            raise not_found("Station", station_id)

    def ingest(self, station_id: str, data: ReadingCreate) -> Reading:
        """Stores one reading, normalised to UTC and Celsius."""
        self._require_station(station_id)
        timestamp = data.timestamp.astimezone(timezone.utc)
        if self.repo.has_reading(station_id, timestamp):
            raise conflict("duplicate_reading",
                           f"Station '{station_id}' already has a reading at {timestamp.isoformat()}.",
                           station_id=station_id, timestamp=timestamp.isoformat())
        reading = Reading(
            station_id=station_id,
            timestamp=timestamp,
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

    def daily_summary(self, station_id: str, start: date, end: date) -> DailySummaryResponse:
        """Per-UTC-day min/max/mean temperature and reading count, from `start` to `end` inclusive."""
        if end < start:
            raise invalid({"query.to": "'to' must not be before 'from'."})
        if (end - start).days >= MAX_RANGE_DAYS:
            raise invalid({"query.to": f"The range may span at most {MAX_RANGE_DAYS} days."})
        self._require_station(station_id)

        by_day: dict[date, list[int]] = {}
        for reading in self.repo.readings_for(station_id):
            day = reading.timestamp.date()
            if start <= day <= end:
                by_day.setdefault(day, []).append(to_hundredths(reading.temperature_c))
        days = [
            DailySummary(date=day, min_c=min(values) / 100, max_c=max(values) / 100,
                         mean_c=mean_c(sum(values), len(values)), count=len(values))
            for day, values in sorted(by_day.items())
        ]
        return DailySummaryResponse(station_id=station_id, days=days)
