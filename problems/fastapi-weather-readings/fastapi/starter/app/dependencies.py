"""FastAPI dependencies shared by the routers."""
from typing import Annotated

from fastapi import Depends, Request

from app.services.readings import ReadingService
from app.services.stations import StationService


def get_stations(request: Request) -> StationService:
    return request.app.state.stations


def get_readings(request: Request) -> ReadingService:
    return request.app.state.readings


Stations = Annotated[StationService, Depends(get_stations)]
Readings = Annotated[ReadingService, Depends(get_readings)]
