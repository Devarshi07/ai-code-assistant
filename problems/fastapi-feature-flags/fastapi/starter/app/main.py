"""Application factory for the Feature Flags API."""
from fastapi import FastAPI

from app.errors import install_error_handlers
from app.repository import FlagRepository
from app.routers import evaluate, flags
from app.services.flags import FlagService


def create_app() -> FastAPI:
    """Builds an app with its own empty in-memory store.

    Tests and the demo call this to get an isolated instance. Nothing here
    listens on a port; in production uvicorn serves ``app.main:app``.
    """
    app = FastAPI(title="Feature Flags API", version="0.9.0")
    app.state.flags = FlagService(FlagRepository())
    install_error_handlers(app)

    app.include_router(flags.router)
    app.include_router(evaluate.router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
