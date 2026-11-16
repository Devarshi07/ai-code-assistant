"""How deliveries leave the building.

``HttpxTransport`` is used in production. ``ScriptedTransport`` stands in for
subscriber endpoints in the demo and in tests: it answers from a script per URL
and records every request it was sent.
"""
from dataclasses import dataclass, field
from typing import Protocol, Union


@dataclass
class TransportResponse:
    status_code: int
    headers: dict[str, str] = field(default_factory=dict)

    def header(self, name: str) -> str | None:
        lowered = name.lower()
        return next((v for k, v in self.headers.items() if k.lower() == lowered), None)


class TransportError(Exception):
    """The request never got an HTTP response: DNS failure, refused connection, timeout."""


class Transport(Protocol):
    def send(self, url: str, body: bytes, headers: dict[str, str], timeout: float) -> TransportResponse: ...


class HttpxTransport:
    def __init__(self) -> None:
        import httpx

        self._httpx = httpx
        self._client = httpx.Client(follow_redirects=False)

    def send(self, url: str, body: bytes, headers: dict[str, str], timeout: float) -> TransportResponse:
        try:
            response = self._client.post(url, content=body, headers=headers, timeout=timeout)
        except self._httpx.HTTPError as exc:
            raise TransportError(str(exc) or type(exc).__name__) from exc
        return TransportResponse(response.status_code, dict(response.headers))


Outcome = Union[int, TransportResponse, TransportError]


@dataclass
class SentRequest:
    url: str
    body: bytes
    headers: dict[str, str]


class ScriptedTransport:
    def __init__(self, default: Outcome = 200) -> None:
        self.default = default
        self.sent: list[SentRequest] = []
        self._queued: dict[str, list[Outcome]] = {}
        self._fallback: dict[str, Outcome] = {}

    def script(self, url: str, *outcomes: Outcome) -> None:
        """The next requests to ``url`` get these outcomes, in order."""
        self._queued.setdefault(url, []).extend(outcomes)

    def always(self, url: str, outcome: Outcome) -> None:
        """Requests to ``url`` get this outcome once its script is used up."""
        self._fallback[url] = outcome

    def send(self, url: str, body: bytes, headers: dict[str, str], timeout: float) -> TransportResponse:
        self.sent.append(SentRequest(url, body, dict(headers)))
        queue = self._queued.get(url)
        outcome = queue.pop(0) if queue else self._fallback.get(url, self.default)
        if isinstance(outcome, TransportError):
            raise outcome
        if isinstance(outcome, int):
            return TransportResponse(outcome)
        return outcome
