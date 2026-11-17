"""/flags: flag management and the single-flag check."""
from fastapi import APIRouter, Query, Request, Response

from app.dependencies import Flags
from app.etag import etag_for, matches
from app.schemas import CheckResult, Flag, FlagCreate, FlagUpdate

router = APIRouter(prefix="/flags", tags=["flags"])


def _cached(request: Request, response: Response, body, payload):
    """Return ``body`` with an ETag, or a bare 304 when the client already has this content."""
    etag = etag_for(payload)
    if matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers={"ETag": etag})
    response.headers["ETag"] = etag
    return body


@router.post("", response_model=Flag, status_code=201)
def create_flag(payload: FlagCreate, flags: Flags):
    return flags.create_flag(payload)


@router.get("", response_model=list[Flag])
def list_flags(request: Request, response: Response, flags: Flags):
    items = [Flag.model_validate(flag) for flag in flags.list_flags()]
    return _cached(request, response, items, [item.model_dump(mode="json") for item in items])


@router.get("/{key}", response_model=Flag)
def get_flag(key: str, request: Request, response: Response, flags: Flags):
    item = Flag.model_validate(flags.get_flag(key))
    return _cached(request, response, item, item.model_dump(mode="json"))


@router.patch("/{key}", response_model=Flag)
def update_flag(key: str, payload: FlagUpdate, flags: Flags):
    return flags.update_flag(key, payload)


@router.delete("/{key}", status_code=204)
def delete_flag(key: str, flags: Flags) -> Response:
    flags.delete_flag(key)
    return Response(status_code=204)


@router.get("/{key}/check", response_model=CheckResult)
def check_flag(key: str, flags: Flags, user_id: str = Query(min_length=1)) -> CheckResult:
    result = flags.check(key, user_id)
    return CheckResult(key=key, user_id=user_id, value=result.value, reason=result.reason)
