"""Request and response models (Pydantic v2)."""
import datetime as dt
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

STATION_PATTERN = r"^[a-z0-9][a-z0-9-]{2,31}$"

Unit = Literal["C", "F"]


class StationCreate(BaseModel):
    id: str = Field(pattern=STATION_PATTERN, examples=["ridge-01"])
    name: str = Field(min_length=1, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class Station(StationCreate):
    pass


class ReadingCreate(BaseModel):
    """Body of POST /stations/{id}/readings, as sent by a station."""

    timestamp: AwareDatetime = Field(description="When the reading was taken, with a UTC offset.")
    temperature: float = Field(ge=-100, le=150, description="In the unit given by `unit`.")
    unit: Unit = "C"
    humidity: float = Field(ge=0, le=100, description="Relative humidity, percent.")
    pressure_hpa: float | None = Field(default=None, ge=300, le=1100)


class Reading(BaseModel):
    """A stored reading: always UTC, always Celsius."""

    station_id: str
    timestamp: datetime
    temperature_c: float
    humidity: float
    pressure_hpa: float | None = None


class DailySummary(BaseModel):
    """One UTC day of readings."""

    date: dt.date
    min_c: float
    max_c: float
    mean_c: float
    count: int


class DailySummaryResponse(BaseModel):
    station_id: str
    days: list[DailySummary]
