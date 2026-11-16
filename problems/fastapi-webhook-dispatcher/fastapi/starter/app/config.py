"""Service settings. Production reads them from the environment; tests pass their own."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Shared with the internal services that publish events to Relay.
    ingest_secret: str = "relay-dev-ingest-secret"
    # How old (or how far in the future) a signature timestamp may be.
    signature_tolerance_seconds: int = 300
    # Retry schedule for failed deliveries (see services/retry.py).
    retry_base_seconds: float = 30
    retry_max_delay_seconds: float = 3600
    max_attempts: int = 8
    delivery_timeout_seconds: float = 10
