"""TinyLink: short links with expiry, owner quotas and click analytics."""
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
    TinyLinkError,
    ValidationError,
)
from .service import LinkStats, TinyLink

__all__ = [
    "AliasTakenError",
    "InvalidAliasError",
    "InvalidExpiryError",
    "InvalidUrlError",
    "LinkDeletedError",
    "LinkExpiredError",
    "LinkNotFoundError",
    "LinkStats",
    "QuotaExceededError",
    "RestoreConflictError",
    "TinyLink",
    "TinyLinkError",
    "ValidationError",
]
