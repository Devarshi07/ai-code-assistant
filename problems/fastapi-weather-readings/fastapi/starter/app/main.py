"""Application factory for the Weather Station API."""
from fastapi import FastAPI

from app.errors import install_error_handlers
from app.repository import InMemoryRepository
from app.routers import readings, stations
from app.services.readings import ReadingService
from app.services.stations import StationService


def create_app(repository: InMemoryRepository | None = None) -> FastAPI:
    """Builds an app with its own in-memory store (or the one you pass in).

    Tests and the demo call this to get an isolated instance. Nothing here
    listens on a port; in production uvicorn serves ``app.main:app``.
    """
    repo = repository if repository is not None else InMemoryRepository()
    app = FastAPI(title="Weather Station API", version="0.3.0")
    app.state.stations = StationService(repo)
    app.state.readings = ReadingService(repo)
    install_error_handlers(app)

    app.include_router(stations.router)
    app.include_router(readings.router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
