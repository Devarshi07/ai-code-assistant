"""When to try a failed delivery again, and when to stop."""


class RetryPolicy:
    def __init__(self, base_seconds: float, max_delay_seconds: float, max_attempts: int) -> None:
        self.base_seconds = base_seconds
        self.max_delay_seconds = max_delay_seconds
        self.max_attempts = max_attempts

    def is_retryable(self, status_code: int | None) -> bool:
        """Whether a failed attempt is worth repeating. ``None`` means no HTTP response at all."""
        raise NotImplementedError("Phase 2: which failures are retried")

    def delay_after(self, attempt: int, retry_after: float | None = None) -> float:
        """Seconds to wait after failed attempt number ``attempt`` (1-based)."""
        raise NotImplementedError("Phase 2: exponential backoff")
