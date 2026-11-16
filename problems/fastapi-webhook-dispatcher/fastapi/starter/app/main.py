"""Application factory for Relay, the webhook dispatcher."""
from fastapi import FastAPI

from app.clock import Clock, SystemClock
from app.config import Settings
from app.errors import install_error_handlers
from app.repository import InMemoryRepository
from app.routers import deliveries, events, subscriptions
from app.services.dispatcher import Dispatcher
from app.services.events import EventService
from app.services.subscriptions import SubscriptionService
from app.transport import Transport


def create_app(settings: Settings | None = None, clock: Clock | None = None,
               transport: Transport | None = None) -> FastAPI:
    """Builds an app with its own in-memory store.

    Tests pass a FakeClock and a ScriptedTransport; nothing here opens a socket
    or listens on a port. In production uvicorn serves ``app.main:app``.
    """
    settings = settings or Settings()
    clock = clock or SystemClock()
    if transport is None:
        from app.transport import HttpxTransport

        transport = HttpxTransport()
    repo = InMemoryRepository()

    app = FastAPI(title="Relay", version="2.3.0")
    app.state.settings = settings
    app.state.clock = clock
    app.state.repo = repo
    app.state.subscriptions = SubscriptionService(repo, clock)
    app.state.events = EventService(repo, clock)
    app.state.dispatcher = Dispatcher(repo, transport, clock, settings)
    install_error_handlers(app)

    app.include_router(subscriptions.router)
    app.include_router(events.router)
    app.include_router(deliveries.router)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app
