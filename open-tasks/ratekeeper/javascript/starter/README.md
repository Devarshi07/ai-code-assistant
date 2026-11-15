# RateKeeper

You're on the platform team for a public API. Every request passes through a gateway, and before forwarding a call the gateway has to decide, in memory and without a database round-trip, whether this customer may make it right now. Customers are on plans such as `free` and `pro`, and each plan sets limits per route pattern.

Build **RateKeeper**, the rate limiter the gateway calls for every request. The error classes are already written in `src/errors.js`. Implement the `RateKeeper` class in `src/rateKeeper.js`, and add modules under `src/` if you like. `src/index.js` re-exports everything.

## Conventions

- **Time is passed in.** `now` is an integer number of **milliseconds**. On one `RateKeeper`, `now` never decreases from call to call. Never read the real clock.
- **Routes** given to `check` are well formed: they start with `/`, have at least one segment and no empty segments, for example `/v1/search/images`.
- **Seconds** in results are whole numbers, **rounded up**: 4.2 s is reported as `5`.

```javascript
const { RateKeeper } = require('./src');

const PLANS = {
  free: {
    limits: {
      '/v1/search': { capacity: 5, perMinute: 10 },
      '/v1/orders': { capacity: 2, perMinute: 1 },
    },
  },
  pro: {
    dailyQuota: 50000,                                  // Part 2
    limits: {
      '/v1/search': { capacity: 20, perMinute: 60 },
      '/v1/**': { capacity: 10, perMinute: 30 },        // Part 2 pattern
    },
  },
};

const keeper = new RateKeeper(PLANS);
keeper.registerClient('acme', 'free');
keeper.check('acme', '/v1/search', 0);
// { allowed: true, remaining: 4, retryAfter: 0, reason: 'ok', rule: '/v1/search' }
```

## Part 1 · Core: token buckets

`new RateKeeper(plans)` takes an object of plan name → plan. Each plan has a `limits` object mapping a **rule** pattern to `{ capacity, perMinute }`. In Part 1 every pattern is an exact route, such as `/v1/search`, and it matches only that route.

- `registerClient(clientId, plan)` adds a client on a plan.
- `check(clientId, route, now)` decides one request and returns a decision.

**Token buckets.** Each (client, rule) pair has its own bucket.

1. A bucket holds at most `capacity` tokens. It starts **full** the first time it's used.
2. It refills **continuously** at `perMinute` tokens per minute, which is `perMinute / 60000` tokens per millisecond, and never goes above `capacity`. Compute the refill lazily from timestamps when a request arrives. Don't schedule anything.
3. A request is **allowed** if the bucket holds at least one whole token. An allowed request removes exactly one token. A denied request removes nothing.
4. Partial tokens are kept. With `perMinute: 10`, a bucket that is empty at `t=0` holds 1.5 tokens at `t=9000`, and one request there leaves 0.5.

**The decision.** `check` returns a plain object with these properties:

| Property | Meaning |
| --- | --- |
| `allowed` | `true` if the request may go through |
| `remaining` | whole tokens left in the matched rule's bucket **after** this decision, rounded down |
| `retryAfter` | `0` when allowed; otherwise whole seconds to wait, rounded up (defined per reason below) |
| `reason` | `'ok'`, or why it was denied: `'rate_limited'` (Part 1), `'quota_exceeded'` (Part 2) or `'blocked'` (Part 3) |
| `rule` | the pattern of the rule that matched the route |

For `'rate_limited'`, `retryAfter` is the time until the bucket holds one whole token, rounded up to whole seconds. With `perMinute: 10` and an empty bucket that is exactly `6`. With 4.5 s to go it is `5`.

**Exact arithmetic.** Token counts must be exact. The tests probe boundaries where floating point drifts: adding 0.1 ten times gives 0.9999999999999999, not 1. One approach is to measure buckets in integer units where 1 token = 60 000 units, so each millisecond adds exactly `perMinute` units. Every value then stays a safe integer.

**Errors.** Every error extends `RateKeeperError` (see `src/errors.js`). A call that throws changes nothing.

| Situation | Throws |
| --- | --- |
| `new RateKeeper(...)` given a `capacity` or `perMinute` that isn't an integer ≥ 1 | `ConfigError` |
| `registerClient` with a plan name that isn't defined | `UnknownPlanError` |
| `registerClient` with a `clientId` that is already registered | `DuplicateClientError` |
| `check`, `changePlan` or `usage` with a `clientId` that was never registered | `UnknownClientError` |
| `check` with a route that no rule in the client's plan matches | `UnknownRouteError` |

## Part 2 · Patterns, daily quotas and plan changes

### Route patterns

A pattern is a series of `/`-separated segments. Each segment is one of:

- a **literal**, which matches the same text exactly;
- `*`, which matches **exactly one** segment;
- `**`, which matches **one or more** segments. It is only allowed as the last segment.

`/v1/users/*` matches `/v1/users/42` but not `/v1/users` or `/v1/users/42/orders`. `/v1/**` matches `/v1/a` and `/v1/a/b/c` but not `/v1` or `/v10/a`. `/**` matches every route.

**The most specific rule wins.** When several rules match a route, compare their segments from left to right. At the first position where the two patterns have different kinds of segment, a literal beats `*`, and `*` beats `**`. For `/v1/users/status`, the rule `/v1/users/*` beats `/v1/*/status`, because they first differ at the second segment. For `/v1/reports/daily`, `/v1/**` beats `/*/reports/daily`, because they differ at the first segment. Two different patterns that match the same route always differ somewhere, so there are no ties.

**Buckets belong to rules, not routes.** All routes that resolve to the same rule share one bucket per client. `/v1/users/1` and `/v1/users/2` both draw from the client's `/v1/users/*` bucket.

**Invalid patterns** make the constructor throw `ConfigError`. A pattern must start with `/`, have at least one segment, have no empty segments (so no `//` and no trailing `/`), use `**` only as the last segment, and use `*` only as a whole segment (`/v1/se*` is invalid).

### Daily quota

A plan may set `dailyQuota`: the most **allowed** requests a client may make per day, across all routes. If it's missing, `undefined` or `null` there is no limit. Any other value must be an integer ≥ 1, or the constructor throws `ConfigError`.

- Days are fixed. The day number is `Math.floor(now / 86400000)`, so a new day starts exactly at each multiple of 86 400 000 ms, and the count starts again from zero.
- Only allowed requests count toward the quota.
- If the client has already made `dailyQuota` allowed requests today, the request is denied with reason `'quota_exceeded'`, and `retryAfter` is the seconds until the next day starts, rounded up. No token is taken.
- The quota is checked **before** the bucket. If both would deny the request, the reason is `'quota_exceeded'`.

### Changing plans

`changePlan(clientId, plan, now)` moves the client to another plan, effective immediately at `now`. It throws `UnknownClientError` (checked first) or `UnknownPlanError`, and on error nothing changes. Spent tokens are never refunded:

1. For each bucket the client already has, if the new plan has a rule with **exactly the same pattern**, the bucket carries over. First refill it to `now` at the **old** rule's rate and capacity. Then `spent = oldCapacity − tokens`, and the bucket now holds `max(0, newCapacity − spent)` tokens. From then on it refills at the new rule's rate. Keep `spent` exact, because it may be fractional.
2. Buckets whose pattern isn't in the new plan are discarded. A rule with no bucket starts full when it's first used.
3. Today's quota count carries over, and the new plan's `dailyQuota` applies to it immediately.

Example: on `free`, the `/v1/search` bucket (capacity 5) was emptied at `t=0` and holds 1.5 tokens at `t=9000`. Upgrading to `pro` (capacity 20) at `t=9000` leaves `20 − 3.5 = 16.5` tokens.

## Part 3 · Stretch: penalty box and usage report

### Penalty box

`new RateKeeper(plans, { penalty: { strikes: N, windowSeconds: W, blockSeconds: B } })` turns on the penalty box. All three values must be integers ≥ 1, or the constructor throws `ConfigError`. Without a `penalty` (or with `penalty: null`), clients are never blocked.

- A **strike** is a request denied with reason `'rate_limited'` or `'quota_exceeded'`.
- When a strike at time `t` brings the client's strikes in the window `(t − W·1000, t]` to `N` or more, the client is **blocked** on every route from `t` until `t + B·1000`. The window's lower bound is excluded, and so is the block's end. The client's strike history is then cleared, and the decision for that request has reason `'blocked'` and `retryAfter = B`.
- While blocked, every `check` is denied with reason `'blocked'`, and `retryAfter` is the seconds until the block ends, rounded up. Blocked requests take no token, don't count toward the quota, and are not strikes. `remaining` still reports the matched rule's bucket.
- Changing plans doesn't lift a block.

### Usage report

`usage(clientId, now)` returns a plain object for the admin console, with exactly these properties. It throws `UnknownClientError` for an unknown client and changes nothing.

```javascript
{
  clientId: 'acme',
  plan: 'free',
  dayUsed: 3,            // allowed requests so far in the day that contains `now`
  dayRemaining: null,    // max(0, dailyQuota - dayUsed), or null when the plan has no quota
  blockedUntil: null,    // the ms timestamp when the current block ends, or null if not blocked at `now`
  rules: [               // every rule of the current plan, sorted by pattern (plain string order)
    { rule: '/v1/orders', tokens: 2, allowed: 0, denied: 0 },
    { rule: '/v1/search', tokens: 3, allowed: 3, denied: 1 },
  ],
}
```

`tokens` is the whole tokens in that rule's bucket at `now`; a bucket that has never been used is full. `allowed` and `denied` count this client's `check` decisions that matched that pattern, and every denial reason counts as denied. The counts are kept per pattern for the client's whole lifetime, across plan changes.

## Order of checks

For `check(clientId, route, now)`:

1. Unknown client → `UnknownClientError`. No matching rule → `UnknownRouteError`.
2. Blocked at `now` → `'blocked'`.
3. Daily quota used up → `'quota_exceeded'`. This is a strike and may start a block.
4. Less than one whole token in the bucket → `'rate_limited'`. This is a strike and may start a block.
5. Otherwise the request is allowed: take one token, count it toward today's quota, and return reason `'ok'`.

## Running the tests

```
npm test
```

`tests/public.test.js` covers the basic happy path. Hidden acceptance tests check every rule above, including the edge cases, so write your own tests for anything you're unsure about.
