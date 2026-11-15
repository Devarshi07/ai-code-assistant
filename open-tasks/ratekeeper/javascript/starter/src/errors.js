// Errors thrown by RateKeeper. Every error extends RateKeeperError, so the
// gateway can catch them all in one place. A call that throws must leave the
// limiter unchanged.

class RateKeeperError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/** The plans or penalty settings passed to `new RateKeeper(...)` are invalid. */
class ConfigError extends RateKeeperError {}

/** A plan name that isn't defined in the configuration. */
class UnknownPlanError extends RateKeeperError {}

/** A clientId that was never registered. */
class UnknownClientError extends RateKeeperError {}

/** registerClient was called for a clientId that already exists. */
class DuplicateClientError extends RateKeeperError {}

/** No rule in the client's current plan matches the route. */
class UnknownRouteError extends RateKeeperError {}

module.exports = {
  RateKeeperError,
  ConfigError,
  UnknownPlanError,
  UnknownClientError,
  DuplicateClientError,
  UnknownRouteError,
};
