"""Subscriber endpoints and the event types they listen to."""
import re

from app.clock import Clock
from app.errors import ApiError, not_found
from app.repository import InMemoryRepository
from app.schemas import EVENT_TYPE_PATTERN, Subscription, SubscriptionCreate

_EVENT_TYPE = re.compile(EVENT_TYPE_PATTERN)


class SubscriptionService:
    def __init__(self, repo: InMemoryRepository, clock: Clock) -> None:
        self.repo = repo
        self.clock = clock

    def create(self, data: SubscriptionCreate) -> Subscription:
        bad = [name for name in data.events if name != "*" and not _EVENT_TYPE.match(name)]
        if bad:
            raise ApiError(400, "invalid_event_type", "Unknown event type format.", {"events": bad})
        subscription = Subscription(id=self.repo.next_id("SB"), url=data.url, events=sorted(set(data.events)),
                                    description=data.description, secret=data.secret,
                                    created_at=self.clock.now())
        self.repo.add_subscription(subscription)
        return subscription

    def get(self, subscription_id: str) -> Subscription:
        subscription = self.repo.get_subscription(subscription_id)
        if subscription is None:
            raise not_found("Subscription", subscription_id)
        return subscription

    def list(self) -> list[Subscription]:
        return self.repo.list_subscriptions()

    def set_active(self, subscription_id: str, active: bool) -> Subscription:
        subscription = self.get(subscription_id)
        subscription.active = active
        return subscription
