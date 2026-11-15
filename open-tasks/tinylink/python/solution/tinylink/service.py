"""The TinyLink service. README.md has the full brief.

Everything is in memory. There is no real clock: every time-dependent method
takes ``now``, an integer number of milliseconds since the Unix epoch (UTC).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .errors import (
    AliasTakenError,
    InvalidAliasError,
    InvalidExpiryError,
    InvalidUrlError,
    LinkDeletedError,
    LinkExpiredError,
    LinkNotFoundError,
    QuotaExceededError,
    RestoreConflictError,
)

# Base-62 digits, in value order: 0-9, then A-Z, then a-z.
ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
CODE_LENGTH = 6            # generated codes are left-padded with "0" to this length
MAX_URL_LENGTH = 2048      # inclusive
ALIAS_MIN_LENGTH = 3       # inclusive
ALIAS_MAX_LENGTH = 30      # inclusive
MS_PER_DAY = 86_400_000    # UTC day number = now // MS_PER_DAY

_ALIAS_CHARS = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-")
_WHITESPACE = (" ", "\t", "\r", "\n")


@dataclass
class LinkStats:
    """Click analytics for one link (Part 2).

    ``clicks_by_day`` maps a UTC day number to the clicks recorded that day.
    Days without clicks are left out.
    """

    total_clicks: int
    unique_visitors: int
    clicks_by_day: dict[int, int] = field(default_factory=dict)


@dataclass
class _Link:
    seq: int
    code: str
    url: str
    owner: str
    is_alias: bool
    expires_at: int | None
    deleted: bool = False
    clicks: list[tuple[int, str]] = field(default_factory=list)

    def matches(self, code: str) -> bool:
        return self.code.lower() == code.lower() if self.is_alias else self.code == code

    def expired(self, now: int) -> bool:
        return self.expires_at is not None and now >= self.expires_at

    def active(self, now: int) -> bool:
        return not self.deleted and not self.expired(now)


def encode_base62(number: int) -> str:
    digits = []
    while number:
        number, rem = divmod(number, 62)
        digits.append(ALPHABET[rem])
    return "".join(reversed(digits)).rjust(CODE_LENGTH, "0")


def _validate_url(url: str) -> None:
    if not isinstance(url, str) or len(url) > MAX_URL_LENGTH:
        raise InvalidUrlError(url)
    lowered = url.lower()
    for scheme in ("http://", "https://"):
        if lowered.startswith(scheme):
            rest = url[len(scheme):]
            break
    else:
        raise InvalidUrlError(url)
    host_end = len(rest)
    for stop in "/?#":
        index = rest.find(stop)
        if index != -1:
            host_end = min(host_end, index)
    if host_end == 0:
        raise InvalidUrlError(url)
    if any(ch in url for ch in _WHITESPACE):
        raise InvalidUrlError(url)


def _validate_alias(alias: str) -> None:
    if (
        not isinstance(alias, str)
        or not ALIAS_MIN_LENGTH <= len(alias) <= ALIAS_MAX_LENGTH
        or any(ch not in _ALIAS_CHARS for ch in alias)
    ):
        raise InvalidAliasError(alias)


class TinyLink:
    """In-memory URL shortener."""

    def __init__(self, max_links_per_owner: int | None = None) -> None:
        self.max_links_per_owner = max_links_per_owner
        self._counter = 1
        self._seq = 0
        self._live_generated: dict[str, _Link] = {}      # exact code -> link
        self._live_generated_lower: dict[str, int] = {}  # lowercased code -> how many
        self._live_aliases: dict[str, _Link] = {}        # lowercased alias -> link
        self._aliases_ever: set[str] = set()             # lowercased aliases ever created
        self._deleted: list[_Link] = []                   # in deletion order
        self._by_owner: dict[str, list[_Link]] = {}

    # ----------------------------------------------------------------- helpers

    def _find(self, code: str) -> _Link | None:
        link = self._live_generated.get(code) or self._live_aliases.get(code.lower())
        if link is not None:
            return link
        for link in reversed(self._deleted):
            if link.matches(code):
                return link
        return None

    def _get(self, code: str) -> _Link:
        link = self._find(code)
        if link is None:
            raise LinkNotFoundError(code)
        return link

    def _clashes_with_live(self, code: str, is_alias: bool) -> bool:
        key = code.lower()
        if key in self._live_aliases:
            return True
        return is_alias and self._live_generated_lower.get(key, 0) > 0

    def _active_count(self, owner: str, now: int) -> int:
        return sum(1 for link in self._by_owner.get(owner, ()) if link.active(now))

    def _at_quota(self, owner: str, now: int) -> bool:
        cap = self.max_links_per_owner
        return cap is not None and self._active_count(owner, now) >= cap

    def _next_code(self) -> str:
        while True:
            candidate = encode_base62(self._counter)
            self._counter += 1
            if candidate.lower() not in self._aliases_ever:
                return candidate

    def _hold(self, link: _Link) -> None:
        if link.is_alias:
            self._live_aliases[link.code.lower()] = link
        else:
            self._live_generated[link.code] = link
            key = link.code.lower()
            self._live_generated_lower[key] = self._live_generated_lower.get(key, 0) + 1

    def _release(self, link: _Link) -> None:
        if link.is_alias:
            del self._live_aliases[link.code.lower()]
        else:
            del self._live_generated[link.code]
            key = link.code.lower()
            self._live_generated_lower[key] -= 1
            if not self._live_generated_lower[key]:
                del self._live_generated_lower[key]

    # ----------------------------------------------------------- Part 1 · Core

    def create(
        self,
        url: str,
        owner: str,
        now: int,
        alias: str | None = None,
        expires_at: int | None = None,
    ) -> str:
        _validate_url(url)
        if alias is not None:
            _validate_alias(alias)
        if expires_at is not None and expires_at <= now:
            raise InvalidExpiryError(expires_at)
        if alias is not None and self._clashes_with_live(alias, True):
            raise AliasTakenError(alias)
        if self._at_quota(owner, now):
            raise QuotaExceededError(owner)

        if alias is not None:
            code = alias
            self._aliases_ever.add(alias.lower())
        else:
            code = self._next_code()
        self._seq += 1
        link = _Link(self._seq, code, url, owner, alias is not None, expires_at)
        self._hold(link)
        self._by_owner.setdefault(owner, []).append(link)
        return code

    def resolve(self, code: str, now: int, visitor_id: str) -> str:
        link = self._get(code)
        if link.deleted:
            raise LinkDeletedError(code)
        if link.expired(now):
            raise LinkExpiredError(code)
        link.clicks.append((now, visitor_id))
        return link.url

    # ---------------------------------------------------------------- Part 2

    def stats(self, code: str) -> LinkStats:
        link = self._get(code)
        by_day: dict[int, int] = {}
        for at, _ in sorted(link.clicks):
            day = at // MS_PER_DAY
            by_day[day] = by_day.get(day, 0) + 1
        return LinkStats(
            total_clicks=len(link.clicks),
            unique_visitors=len({visitor for _, visitor in link.clicks}),
            clicks_by_day=by_day,
        )

    # -------------------------------------------------------- Part 3 · Stretch

    def delete(self, code: str) -> None:
        link = self._get(code)
        if link.deleted:
            raise LinkDeletedError(code)
        link.deleted = True
        self._release(link)
        self._deleted.append(link)

    def restore(self, code: str, now: int) -> None:
        link = self._get(code)
        if not link.deleted or self._clashes_with_live(link.code, link.is_alias):
            raise RestoreConflictError(code)
        if not link.expired(now) and self._at_quota(link.owner, now):
            raise QuotaExceededError(link.owner)
        link.deleted = False
        self._deleted = [other for other in self._deleted if other is not link]
        self._hold(link)

    def top_links(self, owner: str, n: int, since: int) -> list[tuple[str, int]]:
        rows = []
        for link in self._by_owner.get(owner, ()):
            if link.deleted:
                continue
            clicks = sum(1 for at, _ in link.clicks if at >= since)
            if clicks:
                rows.append((-clicks, link.seq, link.code, clicks))
        rows.sort()
        return [(code, clicks) for _, _, code, clicks in rows[: max(n, 0)]]
