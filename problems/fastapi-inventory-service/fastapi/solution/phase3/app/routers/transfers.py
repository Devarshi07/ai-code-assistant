"""/transfers: moving stock between warehouses."""
from fastapi import APIRouter, Header

from app.dependencies import Inventory
from app.schemas import TransferRequest, TransferResult

router = APIRouter(tags=["stock"])


@router.post("/transfers", response_model=TransferResult, status_code=201)
def create_transfer(payload: TransferRequest, inventory: Inventory,
                    idempotency_key: str | None = Header(default=None, min_length=1, max_length=100)) -> TransferResult:
    # Clients send Idempotency-Key so a retried request cannot move stock twice.
    return inventory.transfer(payload, idempotency_key=idempotency_key)
