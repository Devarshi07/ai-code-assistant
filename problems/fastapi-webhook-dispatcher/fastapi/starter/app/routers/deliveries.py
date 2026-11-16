"""/deliveries and /dispatch: the outbound side."""
from fastapi import APIRouter, Query

from app.dependencies import DispatcherDep
from app.errors import not_found
from app.schemas import Delivery, DispatchSummary

router = APIRouter(tags=["deliveries"])


@router.get("/deliveries/{delivery_id}", response_model=Delivery)
def get_delivery(delivery_id: str, dispatcher: DispatcherDep) -> Delivery:
    delivery = dispatcher.repo.get_delivery(delivery_id)
    if delivery is None:
        raise not_found("Delivery", delivery_id)
    return delivery


@router.post("/dispatch", response_model=DispatchSummary)
def dispatch(dispatcher: DispatcherDep, limit: int = Query(default=100, ge=1, le=1000)) -> DispatchSummary:
    """Runs one batch of due deliveries now (the worker does this continuously)."""
    return dispatcher.dispatch_due(limit)
