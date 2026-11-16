"""/deliveries and /dispatch: the outbound side."""
from fastapi import APIRouter, Query

from app.dependencies import DispatcherDep
from app.errors import not_found
from app.schemas import Delivery, DeliveryPage, DeliveryStatus, DispatchSummary
from app.services.deliveries import list_deliveries

router = APIRouter(tags=["deliveries"])


@router.get("/deliveries", response_model=DeliveryPage)
def get_deliveries(dispatcher: DispatcherDep, status: DeliveryStatus | None = None,
                   subscription_id: str | None = None, event_type: str | None = None,
                   limit: int = Query(default=50, ge=1, le=100), after: str | None = None) -> DeliveryPage:
    return list_deliveries(dispatcher.repo, status=status, subscription_id=subscription_id,
                           event_type=event_type, limit=limit, after=after)


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
