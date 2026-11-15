"""Errors raised by TinyLink.

Every error the service raises on purpose is a subclass of ``TinyLinkError``,
so callers can catch the whole family at once. Tests only check the class of
an error, never its message.

    TinyLinkError
    ├── ValidationError            the arguments themselves are bad
    │   ├── InvalidUrlError
    │   ├── InvalidAliasError
    │   └── InvalidExpiryError       (Part 2)
    ├── AliasTakenError
    ├── QuotaExceededError           (Part 2)
    ├── LinkNotFoundError
    ├── LinkExpiredError             (Part 2)
    ├── LinkDeletedError             (Part 3)
    └── RestoreConflictError         (Part 3)
"""


class TinyLinkError(Exception):
    """Base class for every TinyLink error."""


class ValidationError(TinyLinkError):
    """An argument is malformed, regardless of the service's current state."""


class InvalidUrlError(ValidationError):
    """The target URL breaks one of the URL rules."""


class InvalidAliasError(ValidationError):
    """A custom alias has the wrong length or a character outside [A-Za-z0-9-]."""


class InvalidExpiryError(ValidationError):
    """``expires_at`` is not strictly later than ``now``."""


class AliasTakenError(TinyLinkError):
    """A custom alias clashes with the code of an existing, non-deleted link."""


class QuotaExceededError(TinyLinkError):
    """The owner already has the maximum number of active links."""


class LinkNotFoundError(TinyLinkError):
    """No link matches the code."""


class LinkExpiredError(TinyLinkError):
    """The link exists but has expired."""


class LinkDeletedError(TinyLinkError):
    """The link exists but has been soft-deleted."""


class RestoreConflictError(TinyLinkError):
    """The link cannot be restored because a non-deleted link holds its code."""
