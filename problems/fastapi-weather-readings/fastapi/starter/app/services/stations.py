"""Station registry rules."""
from app.errors import conflict, not_found
from app.repository import InMemoryRepository
from app.schemas import Station, StationCreate


class StationService:
    def __init__(self, repo: InMemoryRepository) -> None:
        self.repo = repo

    def create(self, data: StationCreate) -> Station:
        if self.repo.get_station(data.id) is not None:
            raise conflict("duplicate_station", f"Station '{data.id}' already exists.")
        station = Station(**data.model_dump())
        self.repo.add_station(station)
        return station

    def get(self, station_id: str) -> Station:
        station = self.repo.get_station(station_id)
        if station is None:
            raise not_found("Station", station_id)
        return station

    def list(self) -> list[Station]:
        return self.repo.list_stations()
