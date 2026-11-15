// The RateKeeper limiter (reference solution).
//
// Buckets are measured in integer units: 1 token = 60 000 units, so each
// millisecond adds exactly `perMinute` units and every value stays an integer.
const {
  ConfigError,
  DuplicateClientError,
  UnknownClientError,
  UnknownPlanError,
  UnknownRouteError,
} = require('./errors');
const { Pattern } = require('./patterns');

const REASONS = Object.freeze({
  OK: 'ok',
  RATE_LIMITED: 'rate_limited',
  QUOTA_EXCEEDED: 'quota_exceeded',
  BLOCKED: 'blocked',
});

const UNITS = 60000;
const DAY_MS = 86400000;

// Integer division helpers for non-negative safe integers (no float rounding).
const floorDiv = (a, b) => (a - (a % b)) / b;
const ceilDiv = (a, b) => floorDiv(a, b) + (a % b > 0 ? 1 : 0);
const whole = units => floorDiv(units, UNITS);
const positiveInt = value => Number.isInteger(value) && value >= 1;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

class Rule {
  constructor(text, limit) {
    if (!isObject(limit)) throw new ConfigError(`limit for ${text} must be an object`);
    if (!positiveInt(limit.capacity) || !positiveInt(limit.perMinute)) throw new ConfigError(`${text}: capacity and perMinute must be integers >= 1`);
    this.pattern = new Pattern(text);
    this.capacity = limit.capacity * UNITS;
    this.perMinute = limit.perMinute;
  }
}

class Plan {
  constructor(name, spec) {
    if (!isObject(spec) || !isObject(spec.limits)) throw new ConfigError(`plan ${name} needs a limits object`);
    const quota = spec.dailyQuota;
    if (quota !== undefined && quota !== null && !positiveInt(quota)) throw new ConfigError(`plan ${name}: dailyQuota must be an integer >= 1 or null`);
    this.dailyQuota = quota ?? null;
    this.rules = new Map(Object.entries(spec.limits).map(([text, limit]) => [text, new Rule(text, limit)]));
  }

  match(route) {
    const segments = route.split('/').slice(1);
    let best = null;
    for (const rule of this.rules.values()) {
      if (rule.pattern.matches(segments) && (!best || rule.pattern.compare(best.pattern) < 0)) best = rule;
    }
    if (!best) throw new UnknownRouteError(`no rule matches ${route}`);
    return best;
  }
}

class Bucket {
  constructor(units, now) {
    this.units = units;
    this.updated = now;
  }

  /** Units in the bucket at `now`, without changing it. */
  level(rule, now) {
    const elapsed = Math.max(0, now - this.updated);
    return Math.min(rule.capacity, this.units + elapsed * rule.perMinute);
  }

  refill(rule, now) {
    this.units = this.level(rule, now);
    this.updated = Math.max(this.updated, now);
  }
}

class Penalty {
  constructor(spec) {
    if (!isObject(spec)) throw new ConfigError('penalty must be an object or null');
    const { strikes, windowSeconds, blockSeconds } = spec;
    if (![strikes, windowSeconds, blockSeconds].every(positiveInt)) throw new ConfigError('penalty strikes, windowSeconds and blockSeconds must be integers >= 1');
    this.strikes = strikes;
    this.windowMs = windowSeconds * 1000;
    this.blockSeconds = blockSeconds;
  }
}

class Client {
  constructor(plan) {
    this.plan = plan;
    this.buckets = new Map(); // pattern text -> Bucket
    this.counts = new Map();  // pattern text -> { allowed, denied }
    this.day = null;
    this.dayUsed = 0;
    this.strikes = [];
    this.blockedUntil = null;
  }

  usedOn(day) { return this.day === day ? this.dayUsed : 0; }
  blockedAt(now) { return this.blockedUntil !== null && now < this.blockedUntil; }
}

class RateKeeper {
  constructor(plans, { penalty = null } = {}) {
    if (!isObject(plans)) throw new ConfigError('plans must be an object');
    this._plans = new Map(Object.entries(plans).map(([name, spec]) => [name, new Plan(name, spec)]));
    this._penalty = penalty === null || penalty === undefined ? null : new Penalty(penalty);
    this._clients = new Map();
  }

  registerClient(clientId, plan) {
    if (!this._plans.has(plan)) throw new UnknownPlanError(`unknown plan ${plan}`);
    if (this._clients.has(clientId)) throw new DuplicateClientError(`client ${clientId} is already registered`);
    this._clients.set(clientId, new Client(plan));
  }

  _client(clientId) {
    const client = this._clients.get(clientId);
    if (!client) throw new UnknownClientError(`unknown client ${clientId}`);
    return client;
  }

  check(clientId, route, now) {
    const client = this._client(clientId);
    const plan = this._plans.get(client.plan);
    const rule = plan.match(route);
    const text = rule.pattern.text;
    let bucket = client.buckets.get(text);
    if (!bucket) client.buckets.set(text, (bucket = new Bucket(rule.capacity, now)));
    bucket.refill(rule, now);
    if (!client.counts.has(text)) client.counts.set(text, { allowed: 0, denied: 0 });
    const counts = client.counts.get(text);
    const decision = (allowed, retryAfter, reason) => ({ allowed, remaining: whole(bucket.units), retryAfter, reason, rule: text });

    if (client.blockedAt(now)) {
      counts.denied++;
      return decision(false, ceilDiv(client.blockedUntil - now, 1000), REASONS.BLOCKED);
    }

    const day = Math.floor(now / DAY_MS);
    if (client.day !== day) { client.day = day; client.dayUsed = 0; }
    let reason, retryAfter;
    if (plan.dailyQuota !== null && client.dayUsed >= plan.dailyQuota) {
      reason = REASONS.QUOTA_EXCEEDED;
      retryAfter = ceilDiv((day + 1) * DAY_MS - now, 1000);
    } else if (bucket.units < UNITS) {
      reason = REASONS.RATE_LIMITED;
      retryAfter = ceilDiv(UNITS - bucket.units, rule.perMinute * 1000);
    } else {
      bucket.units -= UNITS;
      client.dayUsed++;
      counts.allowed++;
      return decision(true, 0, REASONS.OK);
    }

    counts.denied++;
    if (this._penalty && this._strike(client, now)) {
      reason = REASONS.BLOCKED;
      retryAfter = this._penalty.blockSeconds;
    }
    return decision(false, retryAfter, reason);
  }

  /** Record a strike; return true if it starts a block. */
  _strike(client, now) {
    const penalty = this._penalty;
    client.strikes.push(now);
    client.strikes = client.strikes.filter(t => t > now - penalty.windowMs);
    if (client.strikes.length < penalty.strikes) return false;
    client.strikes = [];
    client.blockedUntil = now + penalty.blockSeconds * 1000;
    return true;
  }

  changePlan(clientId, plan, now) {
    const client = this._client(clientId);
    if (!this._plans.has(plan)) throw new UnknownPlanError(`unknown plan ${plan}`);
    const oldRules = this._plans.get(client.plan).rules;
    const newRules = this._plans.get(plan).rules;
    for (const [text, bucket] of [...client.buckets]) {
      const newRule = newRules.get(text);
      if (!newRule) { client.buckets.delete(text); continue; }
      const oldRule = oldRules.get(text);
      bucket.refill(oldRule, now);
      const spent = oldRule.capacity - bucket.units;
      bucket.units = Math.max(0, newRule.capacity - spent);
    }
    client.plan = plan;
  }

  usage(clientId, now) {
    const client = this._client(clientId);
    const plan = this._plans.get(client.plan);
    const used = client.usedOn(Math.floor(now / DAY_MS));
    const rules = [...plan.rules.keys()].sort().map(text => {
      const rule = plan.rules.get(text);
      const bucket = client.buckets.get(text);
      const units = bucket ? bucket.level(rule, now) : rule.capacity;
      const counts = client.counts.get(text) || { allowed: 0, denied: 0 };
      return { rule: text, tokens: whole(units), allowed: counts.allowed, denied: counts.denied };
    });
    return {
      clientId,
      plan: client.plan,
      dayUsed: used,
      dayRemaining: plan.dailyQuota === null ? null : Math.max(0, plan.dailyQuota - used),
      blockedUntil: client.blockedAt(now) ? client.blockedUntil : null,
      rules,
    };
  }
}

module.exports = { RateKeeper, REASONS };
