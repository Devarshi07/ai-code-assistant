"""Sends due deliveries to subscribers.

In production a worker calls ``dispatch_due`` in a loop; ``POST /dispatch``
runs one batch on demand (used by ops tooling and by the tests).
"""
import json
from datetime import datetime, timedelta

from app.clock import Clock
from app.config import Settings
from app.repository import InMemoryRepository
from app.schemas import Attempt, Delivery, DispatchSummary, Event, Subscription
from app.services.retry import RetryPolicy
from app.signatures import signature_header
from app.transport import Transport, TransportError, TransportResponse


def payload_for(event: Event) -> bytes:
    """The JSON body a subscriber receives."""
    document = {"id": event.id, "type": event.type, "created_at": event.received_at.isoformat(), "data": event.data}
    return json.dumps(document, separators=(",", ":"), sort_keys=True).encode()


class Dispatcher:
    def __init__(self, repo: InMemoryRepository, transport: Transport, clock: Clock, settings: Settings) -> None:
        self.repo = repo
        self.transport = transport
        self.clock = clock
        self.settings = settings
        self.policy = RetryPolicy(settings.retry_base_seconds, settings.retry_max_delay_seconds, settings.max_attempts)

    def dispatch_due(self, limit: int = 100) -> DispatchSummary:
        """Attempts up to ``limit`` due deliveries, earliest first."""
        now = self.clock.now()
        summary = DispatchSummary()
        for delivery in self.repo.due_deliveries(now, limit):
            outcome = self._attempt(delivery, now)
            setattr(summary, outcome, getattr(summary, outcome) + 1)
            if outcome != "cancelled":
                summary.attempted += 1
        return summary

    def _attempt(self, delivery: Delivery, now: datetime) -> str:
        subscription = self.repo.get_subscription(delivery.subscription_id)
        if subscription is None or not subscription.active:
            delivery.status, delivery.next_attempt_at = "cancelled", None
            return "cancelled"
        event = self.repo.get_event(delivery.event_id)
        body = payload_for(event)
        headers = {
            "Content-Type": "application/json",
            "X-Relay-Event": event.type,
            "X-Relay-Delivery": delivery.id,
            "X-Relay-Signature": signature_header(subscription.secret, int(now.timestamp()), body),
        }
        delivery.attempts += 1
        response: TransportResponse | None = None
        try:
            response = self.transport.send(subscription.url, body, headers, self.settings.delivery_timeout_seconds)
            status_code, error = response.status_code, None
            if not 200 <= status_code < 300:
                error = f"HTTP {status_code}"
        except TransportError as exc:
            status_code, error = None, str(exc) or "connection failed"
        delivery.history.append(Attempt(number=delivery.attempts, at=now, status_code=status_code, error=error))
        delivery.last_status_code, delivery.last_error = status_code, error
        if error is None:
            delivery.status, delivery.delivered_at, delivery.next_attempt_at = "delivered", now, None
            return "delivered"
        return self._after_failure(delivery, subscription, response, now)

    def _after_failure(self, delivery: Delivery, subscription: Subscription,
                       response: TransportResponse | None, now: datetime) -> str:
        """Schedules a retry or gives up. Returns "retried", "failed" or "dead"."""
        status_code = response.status_code if response is not None else None
        if not self.policy.is_retryable(status_code):
            if status_code == 410:
                # 410 Gone: the endpoint was removed on purpose. Stop sending to it.
                subscription.active = False
            delivery.status, delivery.next_attempt_at = "failed", None
            return "failed"
        if delivery.attempts >= self.policy.max_attempts:
            delivery.status, delivery.next_attempt_at = "dead", None
            return "dead"
        retry_after = None
        if status_code == 429:
            retry_after = self.policy.parse_retry_after(response.header("Retry-After"))
        delay = self.policy.delay_after(delivery.attempts, retry_after)
        delivery.next_attempt_at = now + timedelta(seconds=delay)
        self.repo.schedule(delivery)
        return "retried"
