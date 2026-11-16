"""FastAPI dependencies: the app's services, and signature checking for producers."""
from typing import Annotated

from fastapi import Depends, Header, Request

from app.config import Settings
from app.services.dispatcher import Dispatcher
from app.services.events import EventService
from app.services.subscriptions import SubscriptionService
from app.signatures import verify_signature


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_subscriptions(request: Request) -> SubscriptionService:
    return request.app.state.subscriptions


def get_events(request: Request) -> EventService:
    return request.app.state.events


def get_dispatcher(request: Request) -> Dispatcher:
    return request.app.state.dispatcher


async def verified_body(request: Request,
                        x_relay_signature: Annotated[str | None, Header()] = None) -> bytes:
    """The raw request body, once its X-Relay-Signature has been checked."""
    body = await request.body()
    settings = request.app.state.settings
    now = request.app.state.clock.now().timestamp()
    verify_signature(settings.ingest_secret, body, x_relay_signature, now, settings.signature_tolerance_seconds)
    return body


Subscriptions = Annotated[SubscriptionService, Depends(get_subscriptions)]
Events = Annotated[EventService, Depends(get_events)]
DispatcherDep = Annotated[Dispatcher, Depends(get_dispatcher)]
VerifiedBody = Annotated[bytes, Depends(verified_body)]
