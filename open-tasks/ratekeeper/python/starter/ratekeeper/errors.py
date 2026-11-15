"""Errors raised by RateKeeper.

Every error derives from ``RateKeeperError``, so the gateway can catch them all
in one place. A call that raises must leave the limiter unchanged.
"""


class RateKeeperError(Exception):
    """Base class for every error RateKeeper raises."""


class ConfigError(RateKeeperError):
    """The plans or penalty settings passed to ``RateKeeper(...)`` are invalid."""


class UnknownPlanError(RateKeeperError):
    """A plan name that isn't defined in the configuration."""


class UnknownClientError(RateKeeperError):
    """A ``client_id`` that was never registered."""


class DuplicateClientError(RateKeeperError):
    """``register_client`` was called for a ``client_id`` that already exists."""


class UnknownRouteError(RateKeeperError):
    """No rule in the client's current plan matches the route."""
