"""Signing and verifying webhook payloads.

The same scheme is used in both directions: internal producers sign the events
they send to Relay, and Relay signs every delivery it sends to a subscriber.

    X-Relay-Signature: t=1767261600,v1=5f2b...e9

``t`` is the Unix time of signing. ``v1`` is the hex HMAC-SHA256 of
``"{t}." + raw request body`` with the shared secret. While a secret is being
rotated a producer sends one ``v1`` per secret, and a request is valid if any
of them matches.
"""
import hashlib
import hmac


class SignatureError(Exception):
    """The request is not signed, or not signed by someone who knows the secret."""


def compute_signature(secret: str, timestamp: int, body: bytes) -> str:
    message = str(timestamp).encode() + b"." + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def signature_header(secret: str, timestamp: int, body: bytes) -> str:
    return f"t={timestamp},v1={compute_signature(secret, timestamp, body)}"


def parse_signature_header(header: str) -> tuple[int, list[str]]:
    """Splits ``t=...,v1=...[,v1=...]`` into the timestamp and the signatures."""
    timestamp = None
    signatures = []
    for item in header.split(","):
        key, _, value = item.strip().partition("=")
        if key == "t":
            timestamp = int(value) if value.isdigit() else None
        elif key == "v1" and value:
            signatures.append(value)
    if timestamp is None:
        raise SignatureError("The signature header has no valid timestamp.")
    return timestamp, signatures


def verify_signature(secret: str, body: bytes, header: str | None, now: float, tolerance: int) -> None:
    """Raises SignatureError unless ``header`` is a fresh, valid signature of ``body``."""
    if not header:
        raise SignatureError("The X-Relay-Signature header is missing.")
    timestamp, candidates = parse_signature_header(header)
    if not candidates:
        raise SignatureError("The signature header has no v1 signature.")
    if abs(now - timestamp) > tolerance:
        raise SignatureError("The signature timestamp is outside the allowed window.")
    # Sign the exact bytes received: re-serialising the JSON changes them.
    expected = compute_signature(secret, timestamp, body).encode()
    # Valid if any signature matches (secret rotation); compare in constant time.
    if not any(hmac.compare_digest(expected, candidate.encode()) for candidate in candidates):
        raise SignatureError("The signature does not match.")
