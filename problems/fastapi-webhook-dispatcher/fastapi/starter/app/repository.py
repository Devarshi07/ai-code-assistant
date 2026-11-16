"""In-memory storage standing in for the subscriptions, events and deliveries tables."""
from collections import defaultdict
from datetime import datetime
from itertools import count

from app.schemas import Delivery, Event, Subscription


class InMemoryRepository:
    def __init__(self) -> None:
        self.subscriptions: dict[str, Subscription] = {}
        self.events: dict[str, Event] = {}
        self.deliveries: dict[str, Delivery] = {}
        self._sequences: dict[str, count] = defaultdict(lambda: count(1))

    def next_id(self, prefix: str) -> str:
        """Sequential ids per prefix (EV-000001, DL-000001, ...); they sort in creation order."""
        return f"{prefix}-{next(self._sequences[prefix]):06d}"

    # Subscriptions

    def add_subscription(self, subscription: Subscription) -> None:
        self.subscriptions[subscription.id] = subscription

    def get_subscription(self, subscription_id: str) -> Subscription | None:
        return self.subscriptions.get(subscription_id)

    def list_subscriptions(self) -> list[Subscription]:
        return [self.subscriptions[key] for key in sorted(self.subscriptions)]

    def subscribers_for(self, event_type: str) -> list[Subscription]:
        return [s for s in self.list_subscriptions() if s.active and s.wants(event_type)]

    # Events

    def add_event(self, event: Event) -> None:
        self.events[event.id] = event

    def get_event(self, event_id: str) -> Event | None:
        return self.events.get(event_id)

    # Deliveries

    def add_delivery(self, delivery: Delivery) -> None:
        self.deliveries[delivery.id] = delivery

    def get_delivery(self, delivery_id: str) -> Delivery | None:
        return self.deliveries.get(delivery_id)

    def list_deliveries(self) -> list[Delivery]:
        return [self.deliveries[key] for key in sorted(self.deliveries)]

    def due_deliveries(self, now: datetime, limit: int) -> list[Delivery]:
        """Pending deliveries whose next attempt is due, earliest first (ties by id)."""
        due = [d for d in self.deliveries.values()
               if d.status == "pending" and d.next_attempt_at is not None and d.next_attempt_at <= now]
        due.sort(key=lambda d: (d.next_attempt_at, d.id))
        return due[:limit]
