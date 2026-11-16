"""/transfers: moving stock between warehouses."""
from fastapi import APIRouter

from app.dependencies import Inventory
from app.schemas import TransferRequest, TransferResult

router = APIRouter(tags=["stock"])


@router.post("/transfers", response_model=TransferResult, status_code=201)
def create_transfer(payload: TransferRequest, inventory: Inventory) -> TransferResult:
    return inventory.transfer(payload)
