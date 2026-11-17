"""/flags: flag management and the single-flag check."""
from fastapi import APIRouter, Query, Response

from app.dependencies import Flags
from app.schemas import CheckResult, Flag, FlagCreate, FlagUpdate

router = APIRouter(prefix="/flags", tags=["flags"])


@router.post("", response_model=Flag, status_code=201)
def create_flag(payload: FlagCreate, flags: Flags):
    return flags.create_flag(payload)


@router.get("", response_model=list[Flag])
def list_flags(flags: Flags):
    return flags.list_flags()


@router.get("/{key}", response_model=Flag)
def get_flag(key: str, flags: Flags):
    return flags.get_flag(key)


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
