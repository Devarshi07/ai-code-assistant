"""Publishes a few signed events against scripted subscribers and prints what happens."""
import json

from fastapi.testclient import TestClient

from app.clock import FakeClock
from app.config import Settings
from app.main import create_app
from app.signatures import signature_header
from app.transport import ScriptedTransport, TransportError


def show(label, response) -> None:
    print(f"{label} -> {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2)[:700])
    except ValueError:
        print(response.text[:300])
    print()


def main() -> None:
    settings = Settings()
    clock = FakeClock()
    transport = ScriptedTransport()
    transport.script("https://books.example.com/hooks", 503, TransportError("connection reset"), 200)
    client = TestClient(create_app(settings, clock, transport), raise_server_exceptions=False)

    client.post("/subscriptions", json={"url": "https://books.example.com/hooks", "events": ["invoice.paid"],
                                        "secret": "whsec_books_0123456789"})
    client.post("/subscriptions", json={"url": "https://crm.example.com/relay", "events": ["*"],
                                        "secret": "whsec_crm_0123456789ab"})

    body = json.dumps({"type": "invoice.paid", "data": {"invoice": "INV-1042", "amount_cents": 129900}}).encode()
    headers = {"X-Relay-Signature": signature_header(settings.ingest_secret, int(clock.now().timestamp()), body),
               "Content-Type": "application/json"}
    show("POST /events", client.post("/events", content=body, headers=headers))
    show("POST /events (unsigned)", client.post("/events", content=body))

    for step in range(3):
        show(f"POST /dispatch (t+{step * 60}s)", client.post("/dispatch"))
        clock.advance(60)
    show("GET /deliveries/DL-000001", client.get("/deliveries/DL-000001"))
    show("GET /deliveries?status=delivered", client.get("/deliveries", params={"status": "delivered"}))


if __name__ == "__main__":
    main()
