"""/events: where internal producers publish, signed with the ingest secret."""
from fastapi import APIRouter
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.dependencies import Events, VerifiedBody
from app.schemas import Event, EventIn, PublishResult

router = APIRouter(prefix="/events", tags=["events"])


def parse_event(body: bytes) -> EventIn:
    # The body is read raw (the signature covers the exact bytes), so validate it here.
    try:
        return EventIn.model_validate_json(body)
    except ValidationError as exc:
        raise RequestValidationError([{**e, "loc": ("body", *e["loc"])} for e in exc.errors()]) from None


@router.post("", response_model=PublishResult, status_code=202)
def publish_event(body: VerifiedBody, events: Events) -> PublishResult:
    return events.publish(parse_event(body))


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str, events: Events) -> Event:
    return events.get(event_id)
