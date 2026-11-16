"""Request and response models (Pydantic v2)."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

EVENT_TYPE_PATTERN = r"^[a-z][a-z_]*(\.[a-z][a-z_]*)+$"

DeliveryStatus = Literal["pending", "delivered", "failed", "dead", "cancelled"]


# --- Subscriptions ------------------------------------------------------------

class SubscriptionCreate(BaseModel):
    url: str = Field(pattern=r"^https?://\S+$", max_length=500)
    # Event types to receive, for example "invoice.paid", or "*" for every type.
    events: list[str] = Field(min_length=1, max_length=50)
    secret: str = Field(min_length=16, max_length=128)
    description: str | None = Field(default=None, max_length=200)


class Subscription(BaseModel):
    id: str
    url: str
    events: list[str]
    description: str | None = None
    active: bool = True
    created_at: datetime
    # Never returned by the API.
    secret: str = Field(default="", exclude=True)

    def wants(self, event_type: str) -> bool:
        return "*" in self.events or event_type in self.events


# --- Events -------------------------------------------------------------------

class EventIn(BaseModel):
    """Body of POST /events, as sent (and signed) by an internal producer."""

    type: str = Field(pattern=EVENT_TYPE_PATTERN, max_length=80)
    data: dict[str, Any] = Field(default_factory=dict)


class Event(BaseModel):
    id: str
    type: str
    data: dict[str, Any]
    received_at: datetime


class PublishResult(BaseModel):
    event: Event
    deliveries: int = Field(description="Deliveries created, one per matching active subscription.")
    duplicate: bool = False


# --- Deliveries ---------------------------------------------------------------

class Attempt(BaseModel):
    number: int
    at: datetime
    status_code: int | None = None
    error: str | None = None


class DeliverySummary(BaseModel):
    id: str
    event_id: str
    event_type: str
    subscription_id: str
    status: DeliveryStatus = "pending"
    attempts: int = 0
    next_attempt_at: datetime | None = None
    last_status_code: int | None = None
    last_error: str | None = None
    created_at: datetime
    delivered_at: datetime | None = None


class Delivery(DeliverySummary):
    """A delivery with its attempt history (GET /deliveries/{id})."""

    history: list[Attempt] = Field(default_factory=list)


class DeliveryPage(BaseModel):
    items: list[DeliverySummary]
    # Pass as ?after= to get the next page; null on the last page.
    next_after: str | None = None


class DispatchSummary(BaseModel):
    attempted: int = 0
    delivered: int = 0
    retried: int = 0
    failed: int = 0
    dead: int = 0
    cancelled: int = 0
