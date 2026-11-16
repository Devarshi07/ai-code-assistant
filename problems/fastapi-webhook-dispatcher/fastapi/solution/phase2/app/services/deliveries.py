"""Read side for deliveries: filtered, cursor-paginated listing."""
from app.repository import InMemoryRepository
from app.schemas import DeliveryPage


def list_deliveries(repo: InMemoryRepository, status: str | None = None, subscription_id: str | None = None,
                    event_type: str | None = None, limit: int = 50, after: str | None = None) -> DeliveryPage:
    """Deliveries in id (creation) order. ``after`` is the last id of the previous page."""
    items = []
    has_more = False
    for delivery in repo.list_deliveries():
        if after is not None and delivery.id <= after:
            continue
        if status is not None and delivery.status != status:
            continue
        if subscription_id is not None and delivery.subscription_id != subscription_id:
            continue
        if event_type is not None and delivery.event_type != event_type:
            continue
        if len(items) == limit:
            has_more = True
            break
        items.append(delivery)
    return DeliveryPage(items=items, next_after=items[-1].id if has_more else None)
