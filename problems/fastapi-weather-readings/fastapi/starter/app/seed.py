"""A small sample network for the demo and for local development."""
from datetime import datetime, timedelta, timezone

from app.schemas import ReadingCreate, StationCreate
from app.services.readings import ReadingService
from app.services.stations import StationService

STATIONS = [
    StationCreate(id="ridge-01", name="Ridge Road", latitude=46.87, longitude=-114.01),
    StationCreate(id="harbor-02", name="Harbor Pier", latitude=47.61, longitude=-122.34),
]


def seed_demo(stations: StationService, readings: ReadingService) -> None:
    for station in STATIONS:
        stations.create(station)
    tz = timezone(timedelta(hours=-8))
    # Evening readings at -08:00 fall on the next UTC day.
    for hour, temp in [(8, 4.5), (13, 9.0), (18, 6.5), (21, 3.0)]:
        readings.ingest("ridge-01", ReadingCreate(
            timestamp=datetime(2025, 3, 10, hour, 0, tzinfo=tz), temperature=temp, humidity=71.5,
            pressure_hpa=1013.2 if hour != 13 else None))
    for hour, temp in [(7, 41.0), (15, 50.0)]:
        readings.ingest("harbor-02", ReadingCreate(
            timestamp=datetime(2025, 3, 11, hour, 0, tzinfo=timezone.utc), temperature=temp, unit="F", humidity=88.0))
