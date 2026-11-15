// The RateKeeper limiter. See README.md for the full rules.
//
// Units used throughout:
//   now            integer milliseconds; never decreases between calls
//   perMinute      tokens added per minute, continuously
//   retryAfter     whole seconds, rounded up
//   daily quotas   day number = Math.floor(now / 86400000)
const {
  ConfigError,
  DuplicateClientError,
  UnknownClientError,
  UnknownPlanError,
  UnknownRouteError,
} = require('./errors');

/** Values of `decision.reason`. */
const REASONS = Object.freeze({
  OK: 'ok',
  RATE_LIMITED: 'rate_limited',     // Part 1: the rule's bucket has no whole token
  QUOTA_EXCEEDED: 'quota_exceeded', // Part 2: the client used up today's quota
  BLOCKED: 'blocked',               // Part 3: the client is in the penalty box
});

/**
 * A decision is a plain object:
 *   allowed     true if the gateway should forward the request
 *   remaining   whole tokens left in the matched rule's bucket after this decision (rounded down)
 *   retryAfter  0 when allowed; otherwise whole seconds to wait, rounded up: until the next whole
 *               token (rate_limited), the next day (quota_exceeded) or the end of the block (blocked)
 *   reason      one of the REASONS values
 *   rule        the pattern of the rule that matched the route
 */
class RateKeeper {
  /**
   * Validate and store the plan configuration.
   *
   * plans: { [planName]: { limits: { [pattern]: { capacity, perMinute } },
   *                        dailyQuota?: number | null  (Part 2) } }
   * options.penalty (Part 3): null, or { strikes, windowSeconds, blockSeconds }.
   *
   * Throws ConfigError if a capacity, perMinute, dailyQuota or penalty value isn't an
   * integer >= 1 (dailyQuota may also be missing or null), or if a pattern is malformed (Part 2).
   */
  constructor(plans, { penalty = null } = {}) {
    throw new Error('Not implemented: RateKeeper constructor');
  }

  /**
   * Add a client on the named plan.
   * Throws UnknownPlanError if the plan isn't defined, and DuplicateClientError if
   * clientId is already registered.
   */
  registerClient(clientId, plan) {
    throw new Error('Not implemented: registerClient');
  }

  /**
   * Decide one request from clientId to route at time now (ms) and return a decision.
   * An allowed request takes one token from the bucket of the most specific matching
   * rule and counts toward today's quota. A denied request takes nothing.
   * Throws UnknownClientError for an unregistered client, and UnknownRouteError when
   * no rule in the client's plan matches the route.
   */
  check(clientId, route, now) {
    throw new Error('Not implemented: check');
  }

  /**
   * Part 2: move clientId to another plan, effective at now (ms).
   * Buckets whose pattern exists in the new plan carry over: refill to now at the old
   * rate, then tokens = max(0, newCapacity - (oldCapacity - tokens)). Other buckets are
   * discarded. Today's quota count carries over.
   * Throws UnknownClientError (checked first) or UnknownPlanError.
   */
  changePlan(clientId, plan, now) {
    throw new Error('Not implemented: changePlan');
  }

  /**
   * Part 3: admin report for clientId at time now (ms). Changes nothing.
   * Returns { clientId, plan, dayUsed, dayRemaining, blockedUntil,
   *           rules: [{ rule, tokens, allowed, denied }, ...] } with rules sorted by pattern.
   * Throws UnknownClientError.
   */
  usage(clientId, now) {
    throw new Error('Not implemented: usage');
  }
}

module.exports = { RateKeeper, REASONS };
