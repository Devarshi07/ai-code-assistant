import json
import unittest

from fastapi.testclient import TestClient

from app.clock import FakeClock
from app.config import Settings
from app.main import create_app
from app.signatures import compute_signature, signature_header
from app.transport import ScriptedTransport

SECRET = "ingest-secret-for-tests"
OLD_SECRET = "ingest-secret-retired"
EVENT = {"type": "invoice.paid", "data": {"invoice": "INV-1042", "amount_cents": 129900, "currency": "EUR"}}


class IngestSignatureTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.client = TestClient(create_app(Settings(ingest_secret=SECRET), self.clock, ScriptedTransport()))
        self.client.post("/subscriptions", json={"url": "https://books.example.com/hooks", "events": ["*"],
                                                 "secret": "whsec_books_0123456789"})
        self.now = int(self.clock.now().timestamp())

    def publish(self, body: bytes, signature: str | None):
        headers = {"Content-Type": "application/json"}
        if signature is not None:
            headers["X-Relay-Signature"] = signature
        return self.client.post("/events", content=body, headers=headers)

    def assert_accepted(self, response):
        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["event"]["type"], "invoice.paid")
        self.assertEqual(response.json()["deliveries"], 1)

    def assert_rejected(self, response):
        self.assertEqual(response.status_code, 401, response.text)
        self.assertEqual(response.json()["error"]["code"], "invalid_signature")

    def test_accepts_a_correctly_signed_event(self):
        body = json.dumps(EVENT).encode()
        self.assert_accepted(self.publish(body, signature_header(SECRET, self.now, body)))

    def test_accepts_compact_json_from_other_producers(self):
        body = json.dumps(EVENT, separators=(",", ":")).encode()
        self.assert_accepted(self.publish(body, signature_header(SECRET, self.now, body)))

    def test_accepts_non_ascii_text_sent_as_utf8(self):
        event = {"type": "invoice.paid", "data": {"customer": "Café Müller", "amount_cents": 4200}}
        body = json.dumps(event, ensure_ascii=False).encode("utf-8")
        response = self.publish(body, signature_header(SECRET, self.now, body))
        self.assertEqual(response.status_code, 202, response.text)
        self.assertEqual(response.json()["event"]["data"]["customer"], "Café Müller")

    def test_accepts_either_signature_during_secret_rotation(self):
        body = json.dumps(EVENT).encode()
        header = (f"t={self.now},v1={compute_signature(OLD_SECRET, self.now, body)},"
                  f"v1={compute_signature(SECRET, self.now, body)}")
        self.assert_accepted(self.publish(body, header))

    def test_rejects_a_tampered_body(self):
        body = json.dumps(EVENT).encode()
        header = signature_header(SECRET, self.now, body)
        tampered = body.replace(b"129900", b"1")
        self.assert_rejected(self.publish(tampered, header))

    def test_rejects_a_signature_made_with_another_secret(self):
        body = json.dumps(EVENT).encode()
        self.assert_rejected(self.publish(body, signature_header(OLD_SECRET, self.now, body)))

    def test_rejects_a_missing_header(self):
        self.assert_rejected(self.publish(json.dumps(EVENT).encode(), None))

    def test_rejects_a_header_without_any_signature(self):
        body = json.dumps(EVENT).encode()
        self.assert_rejected(self.publish(body, f"t={self.now}"))
        self.assert_rejected(self.publish(body, f"t={self.now},v1="))

    def test_rejects_a_stale_timestamp(self):
        body = json.dumps(EVENT).encode()
        old = self.now - 301
        self.assert_rejected(self.publish(body, signature_header(SECRET, old, body)))

    def test_rejected_events_create_no_deliveries(self):
        body = json.dumps(EVENT).encode()
        self.publish(body, f"t={self.now}")
        accepted = self.publish(body, signature_header(SECRET, self.now, body))
        self.assertEqual(accepted.status_code, 202, accepted.text)
        self.assertEqual(accepted.json()["event"]["id"], "EV-000001", "the unsigned request must not have stored an event")


class SubscriptionTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app(Settings(ingest_secret=SECRET), FakeClock(), ScriptedTransport()))

    def test_secret_is_never_returned(self):
        response = self.client.post("/subscriptions", json={"url": "https://crm.example.com/relay",
                                                            "events": ["order.created", "order.created", "invoice.paid"],
                                                            "secret": "whsec_crm_0123456789ab"})
        self.assertEqual(response.status_code, 201, response.text)
        body = response.json()
        self.assertNotIn("secret", body)
        self.assertEqual(body["events"], ["invoice.paid", "order.created"])
        self.assertTrue(body["active"])

    def test_validation_errors_use_the_error_format(self):
        response = self.client.post("/subscriptions", json={"url": "ftp://x", "events": [], "secret": "short"})
        self.assertEqual(response.status_code, 422)
        fields = response.json()["error"]["fields"]
        self.assertEqual(set(fields), {"body.url", "body.events", "body.secret"})


if __name__ == "__main__":
    unittest.main()
