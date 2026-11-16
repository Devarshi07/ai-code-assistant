"""Accepting events from producers and fanning them out into deliveries."""
from app.clock import Clock
from app.errors import not_found
from app.repository import InMemoryRepository
from app.schemas import Delivery, Event, EventIn, PublishResult


class EventService:
    def __init__(self, repo: InMemoryRepository, clock: Clock) -> None:
        self.repo = repo
        self.clock = clock

    def publish(self, data: EventIn) -> PublishResult:
        """Stores the event and creates one pending delivery per matching active subscription.

        Deliveries are due immediately; the dispatcher picks them up on its next run.
        """
        now = self.clock.now()
        event = Event(id=self.repo.next_id("EV"), type=data.type, data=data.data, received_at=now)
        self.repo.add_event(event)
        created = 0
        for subscription in self.repo.subscribers_for(event.type):
            self.repo.add_delivery(Delivery(id=self.repo.next_id("DL"), event_id=event.id, event_type=event.type,
                                            subscription_id=subscription.id, next_attempt_at=now, created_at=now))
            created += 1
        return PublishResult(event=event, deliveries=created)

    def get(self, event_id: str) -> Event:
        event = self.repo.get_event(event_id)
        if event is None:
            raise not_found("Event", event_id)
        return event
