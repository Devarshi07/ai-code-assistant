"""Accepting events from producers and fanning them out into deliveries."""
import threading

from app.clock import Clock
from app.errors import conflict, not_found
from app.repository import InMemoryRepository
from app.schemas import Delivery, Event, EventIn, PublishResult


class EventService:
    def __init__(self, repo: InMemoryRepository, clock: Clock) -> None:
        self.repo = repo
        self.clock = clock
        # Idempotency-Key -> (the event as first received, the first result).
        self._by_key: dict[str, tuple[dict, PublishResult]] = {}
        self._lock = threading.Lock()

    def publish(self, data: EventIn, idempotency_key: str | None = None) -> PublishResult:
        """Like _publish, but a producer's retry with the same key returns the first result.

        The fingerprint is the parsed event, so a retry that formats its JSON
        differently is still recognised. The same key with a different event is
        a 409. Production would keep keys for a day or so, in the database.
        """
        if idempotency_key is None:
            return self._publish(data)
        fingerprint = data.model_dump()
        with self._lock:
            seen = self._by_key.get(idempotency_key)
            if seen is not None:
                if seen[0] != fingerprint:
                    raise conflict("idempotency_conflict", "This Idempotency-Key was already used for a different event.",
                                   event_id=seen[1].event.id)
                return seen[1].model_copy(update={"duplicate": True})
            result = self._publish(data)
            self._by_key[idempotency_key] = (fingerprint, result)
            return result

    def _publish(self, data: EventIn) -> PublishResult:
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
