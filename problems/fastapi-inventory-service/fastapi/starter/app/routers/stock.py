"""/movements: receiving and shipping stock."""
from fastapi import APIRouter

from app.dependencies import Inventory
from app.schemas import MovementCreate, MovementResult

router = APIRouter(tags=["stock"])


@router.post("/movements", response_model=MovementResult, status_code=201)
def record_movement(payload: MovementCreate, inventory: Inventory) -> MovementResult:
    return inventory.record_movement(payload)
