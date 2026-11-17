"""/evaluate: every flag for one user in a single call."""
from fastapi import APIRouter

from app.dependencies import Flags
from app.schemas import EvaluateRequest, EvaluateResponse, EvaluationResult

router = APIRouter(tags=["evaluation"])


@router.post("/evaluate", response_model=EvaluateResponse)
def evaluate(payload: EvaluateRequest, flags: Flags) -> EvaluateResponse:
    results = flags.evaluate(payload.user_id, payload.attributes)
    return EvaluateResponse(
        user_id=payload.user_id,
        flags={key: EvaluationResult(value=r.value, reason=r.reason) for key, r in results.items()},
    )
