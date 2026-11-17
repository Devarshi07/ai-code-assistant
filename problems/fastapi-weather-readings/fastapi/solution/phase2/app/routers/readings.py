"""/stations/{id}/readings: what stations post, and what the dashboard reads back."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.dependencies import Readings
from app.schemas import DailySummaryResponse, Reading, ReadingCreate

router = APIRouter(prefix="/stations", tags=["readings"])


@router.post("/{station_id}/readings", response_model=Reading, status_code=201)
def post_reading(station_id: str, payload: ReadingCreate, readings: Readings) -> Reading:
    return readings.ingest(station_id, payload)


@router.get("/{station_id}/readings", response_model=list[Reading])
def list_readings(station_id: str, readings: Readings,
                  limit: int = Query(default=100, ge=1, le=1000)) -> list[Reading]:
    return readings.list_readings(station_id, limit)


@router.get("/{station_id}/daily", response_model=DailySummaryResponse)
def daily_summary(station_id: str, readings: Readings,
                  start: Annotated[date, Query(alias="from")],
                  end: Annotated[date, Query(alias="to")]) -> DailySummaryResponse:
    return readings.daily_summary(station_id, start, end)
