"""/subscriptions: endpoints that receive webhooks."""
from fastapi import APIRouter
from pydantic import BaseModel

from app.dependencies import Subscriptions
from app.schemas import Subscription, SubscriptionCreate

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class ActiveUpdate(BaseModel):
    active: bool


@router.post("", response_model=Subscription, status_code=201)
def create_subscription(payload: SubscriptionCreate, subscriptions: Subscriptions) -> Subscription:
    return subscriptions.create(payload)


@router.get("", response_model=list[Subscription])
def list_subscriptions(subscriptions: Subscriptions) -> list[Subscription]:
    return subscriptions.list()


@router.get("/{subscription_id}", response_model=Subscription)
def get_subscription(subscription_id: str, subscriptions: Subscriptions) -> Subscription:
    return subscriptions.get(subscription_id)


@router.patch("/{subscription_id}", response_model=Subscription)
def set_active(subscription_id: str, payload: ActiveUpdate, subscriptions: Subscriptions) -> Subscription:
    return subscriptions.set_active(subscription_id, payload.active)
