"""/stations: the registry of weather stations."""
from fastapi import APIRouter

from app.dependencies import Stations
from app.schemas import Station, StationCreate

router = APIRouter(prefix="/stations", tags=["stations"])


@router.post("", response_model=Station, status_code=201)
def create_station(payload: StationCreate, stations: Stations) -> Station:
    return stations.create(payload)


@router.get("", response_model=list[Station])
def list_stations(stations: Stations) -> list[Station]:
    return stations.list()


@router.get("/{station_id}", response_model=Station)
def get_station(station_id: str, stations: Stations) -> Station:
    return stations.get(station_id)
