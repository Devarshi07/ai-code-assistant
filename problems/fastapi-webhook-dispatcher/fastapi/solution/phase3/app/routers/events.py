"""/events: where internal producers publish, signed with the ingest secret."""
from fastapi import APIRouter, Header, Response
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
def publish_event(body: VerifiedBody, events: Events, response: Response,
                  idempotency_key: str | None = Header(default=None, min_length=1, max_length=200)) -> PublishResult:
    result = events.publish(parse_event(body), idempotency_key=idempotency_key)
    if result.duplicate:
        response.status_code = 200  # already accepted earlier; nothing new was created
    return result


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str, events: Events) -> Event:
    return events.get(event_id)
