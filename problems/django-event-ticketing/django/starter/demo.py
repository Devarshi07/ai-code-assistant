"""A small on-sale at Turnstile, run through the API's test client."""
import logging
import os
from datetime import timedelta
from unittest import mock

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
# 4xx answers are part of the story here; keep Django's request warnings out of the output.
logging.getLogger("django.request").setLevel(logging.ERROR)

from django.core.management import call_command  # noqa: E402
from django.utils import timezone  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

call_command("migrate", run_syncdb=True, verbosity=0)

from accounts.models import Account  # noqa: E402

START = timezone.now().replace(microsecond=0) + timedelta(hours=1)


def client_for(account):
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=account.api_key)
    return client


def at(minutes):
    return mock.patch("ticketing.clock.now", return_value=START + timedelta(minutes=minutes))


def report(label, response):
    body = response.json() if response.content else None
    if isinstance(body, dict) and "error" in body:
        print(f"  {label}: {response.status_code} {body['error']['code']} - {body['error']['message']}")
    else:
        print(f"  {label}: {response.status_code}")
    return body


def print_availability(client, event_id):
    body = client.get(f"/events/{event_id}/availability/").json()
    for s in body["sections"]:
        price = f"from ${s['from_price_cents'] / 100:.2f}" if s["from_price_cents"] is not None else "sold out"
        print(f"    {s['section']:<8} {s['available']:>3} available, {s['held']:>2} held, {s['sold']:>2} sold  {price}")


def main():
    rosa = Account.objects.create(name="Rosa Diaz", email="rosa@example.org", role="organiser", api_key="demo-rosa")
    mia = Account.objects.create(name="Mia Chen", email="mia@example.org", api_key="demo-mia")
    leo = Account.objects.create(name="Leo Park", email="leo@example.org", api_key="demo-leo")
    organiser, attendee, rival = client_for(rosa), client_for(mia), client_for(leo)

    with at(0):
        event = report("Rosa creates the event", organiser.post("/events/", {
            "name": "Night Market Sessions", "venue": "Harbour Hall", "starts_at": (START + timedelta(days=30)).isoformat(),
            "sections": [{"name": "Floor", "rows": 4, "seats_per_row": 8, "price_cents": 4500},
                         {"name": "Balcony", "rows": 2, "seats_per_row": 10, "price_cents": 2800}]}, format="json"))
        print(f"    {event['name']} with {event['seat_count']} seats")
        seats = attendee.get(f"/events/{event['id']}/seats/").json()
        pair = [seats[0]["id"], seats[1]["id"]]
        holds = report("Mia holds Floor A1 and A2", attendee.post(f"/events/{event['id']}/holds/", {"seat_ids": pair}, format="json"))
        report("Leo tries for Floor A2", rival.post(f"/events/{event['id']}/holds/", {"seat_ids": pair[1:]}, format="json"))
        print_availability(attendee, event["id"])

    with at(4):
        order = report("Mia checks out", attendee.post("/orders/", {"hold_ids": [h["id"] for h in holds]}, format="json",
                                                         HTTP_IDEMPOTENCY_KEY="mia-basket-1"))
        print(f"    order {order['id']}: {', '.join(order['seats'])}, total ${order['total_cents'] / 100:.2f}")
        again = report("Her app retries the same checkout", attendee.post("/orders/", {"hold_ids": [h["id"] for h in holds]}, format="json",
                                                                           HTTP_IDEMPOTENCY_KEY="mia-basket-1"))
        print(f"    same order: {again['id'] == order['id']}")
        late = report("Leo holds Balcony A1", rival.post(f"/events/{event['id']}/holds/", {"seat_ids": [seats[32]["id"]]}, format="json"))

    with at(20):
        report("Leo checks out after his hold ran out", rival.post("/orders/", {"hold_ids": [late[0]["id"]]}, format="json"))
        print_availability(attendee, event["id"])
        orders = organiser.get(f"/events/{event['id']}/orders/").json()
        print(f"  Rosa sees {len(orders)} order(s): " + "; ".join(f"{o['account']['name']} {', '.join(o['seats'])}" for o in orders))
        report("Mia asks for the organiser's view", attendee.get(f"/events/{event['id']}/orders/"))


if __name__ == "__main__":
    main()
