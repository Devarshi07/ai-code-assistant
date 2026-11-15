"""The TinyLink service. README.md has the full brief.

Everything is in memory. There is no real clock: every time-dependent method
takes ``now``, an integer number of milliseconds since the Unix epoch (UTC).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .errors import (  # noqa: F401  (imported for your convenience)
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


@dataclass
class LinkStats:
    """Click analytics for one link (Part 2).

    ``clicks_by_day`` maps a UTC day number to the clicks recorded that day.
    Days without clicks are left out.
    """

    total_clicks: int
    unique_visitors: int
    clicks_by_day: dict[int, int] = field(default_factory=dict)


class TinyLink:
    """In-memory URL shortener."""

    def __init__(self, max_links_per_owner: int | None = None) -> None:
        """``max_links_per_owner`` caps each owner's *active* links (Part 2).

        ``None`` means no cap.
        """
        self.max_links_per_owner = max_links_per_owner
        # Add your own state here.

    # ----------------------------------------------------------- Part 1 · Core

    def create(
        self,
        url: str,
        owner: str,
        now: int,
        alias: str | None = None,
        expires_at: int | None = None,
    ) -> str:
        """Create a link owned by ``owner`` and return its code.

        With ``alias=None`` the code is generated: base 62 of a counter that
        starts at 1, left-padded with "0" to 6 characters, skipping (and
        consuming) any candidate that clashes with a custom alias ever created.
        Otherwise the alias is the code, returned exactly as given.

        Raises, checked in this order: ``InvalidUrlError``,
        ``InvalidAliasError``, ``InvalidExpiryError`` (Part 2),
        ``AliasTakenError``, ``QuotaExceededError`` (Part 2).
        A call that raises changes nothing, not even the counter.
        """
        raise NotImplementedError("Part 1: create")

    def resolve(self, code: str, now: int, visitor_id: str) -> str:
        """Return the link's URL and record one click at ``now`` by ``visitor_id``.

        A generated code matches only its exact spelling; an alias matches any
        capitalisation. Raises ``LinkNotFoundError``, ``LinkDeletedError``
        (Part 3, wins over expiry) or ``LinkExpiredError`` (Part 2, when
        ``now >= expires_at``). Failed calls record no click.
        """
        raise NotImplementedError("Part 1: resolve")

    # ---------------------------------------------------------------- Part 2

    def stats(self, code: str) -> LinkStats:
        """Return click analytics for the link, including expired and deleted links.

        Raises ``LinkNotFoundError`` if no link matches.
        """
        raise NotImplementedError("Part 2: stats")

    # -------------------------------------------------------- Part 3 · Stretch

    def delete(self, code: str) -> None:
        """Soft-delete the link: it stops resolving, stops counting toward the
        quota and releases its code, but keeps its clicks.

        Raises ``LinkNotFoundError`` or, if already deleted, ``LinkDeletedError``.
        """
        raise NotImplementedError("Part 3: delete")

    def restore(self, code: str, now: int) -> None:
        """Undo a delete, keeping the link's clicks and expiry.

        Raises, in this order: ``LinkNotFoundError``; ``RestoreConflictError``
        if the matching link is not deleted (it is live, or a newer link holds
        the code); ``QuotaExceededError`` if the link would be active and the
        owner is already at the cap.
        """
        raise NotImplementedError("Part 3: restore")

    def top_links(self, owner: str, n: int, since: int) -> list[tuple[str, int]]:
        """Return up to ``n`` ``(code, clicks)`` pairs for the owner's links.

        Clicks count only when their timestamp is ``>= since``. Most clicks
        first; ties go to the link created first. Deleted links and links with
        no clicks in the window are left out; expired links are included.
        """
        raise NotImplementedError("Part 3: top_links")
