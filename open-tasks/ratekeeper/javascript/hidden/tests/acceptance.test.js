// Hidden acceptance tests for RateKeeper. They use only the documented interface.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  RateKeeper,
  RateKeeperError,
  ConfigError,
  DuplicateClientError,
  UnknownClientError,
  UnknownPlanError,
  UnknownRouteError,
} = require('../src');

const DAY = 86400000;

const PLANS = {
  free: {
    limits: {
      '/v1/search': { capacity: 5, perMinute: 10 },  // one token every 6 s
      '/v1/orders': { capacity: 2, perMinute: 1 },   // one token every 60 s
    },
  },
  pro: {
    limits: {
      '/v1/search': { capacity: 20, perMinute: 60 }, // one token every second
      '/v1/orders': { capacity: 10, perMinute: 30 }, // one token every 2 s
      '/v1/reports': { capacity: 3, perMinute: 6 },  // one token every 10 s
    },
  },
};

const GATEWAY = {
  gateway: {
    limits: {
      '/v1/users/me': { capacity: 1, perMinute: 60 },
      '/v1/users/*': { capacity: 3, perMinute: 60 },
      '/v1/*/status': { capacity: 2, perMinute: 60 },
      '/v1/**': { capacity: 4, perMinute: 60 },
      '/*/reports/daily': { capacity: 2, perMinute: 60 },
      '/**': { capacity: 9, perMinute: 60 },
    },
  },
};

const SAME_LIMITS = {
  '/v1/search': { capacity: 10, perMinute: 60 },
  '/v1/orders': { capacity: 10, perMinute: 60 },
};
const METERED = {
  metered: { dailyQuota: 3, limits: SAME_LIMITS },
  bulk: { dailyQuota: 5, limits: SAME_LIMITS },
  tight: { dailyQuota: 3, limits: { '/v1/search': { capacity: 1, perMinute: 60 } } },
};

const GUARDED = {
  free: {
    limits: {
      '/v1/search': { capacity: 1, perMinute: 60 },
      '/v1/orders': { capacity: 5, perMinute: 60 },
    },
  },
  slow: { limits: { '/v1/search': { capacity: 1, perMinute: 1 } } },
  pro: {
    limits: {
      '/v1/search': { capacity: 50, perMinute: 600 },
      '/v1/orders': { capacity: 50, perMinute: 600 },
    },
  },
  metered: { dailyQuota: 1, limits: { '/v1/search': { capacity: 5, perMinute: 60 } } },
};
const PENALTY = { strikes: 3, windowSeconds: 10, blockSeconds: 60 };

const REPORTING = {
  metered: {
    dailyQuota: 5,
    limits: {
      '/v1/search': { capacity: 2, perMinute: 60 },
      '/v1/orders': { capacity: 3, perMinute: 30 },
      '/v1/**': { capacity: 4, perMinute: 60 },
    },
  },
  open: {
    limits: {
      '/v1/search': { capacity: 10, perMinute: 60 },
      '/v2/**': { capacity: 1, perMinute: 60 },
    },
  },
};

function keeper(plans = PLANS, clients = [['acme', 'free']], penalty = null) {
  const k = penalty === null ? new RateKeeper(plans) : new RateKeeper(plans, { penalty });
  for (const [clientId, plan] of clients) k.registerClient(clientId, plan);
  return k;
}

const solo = (capacity, perMinute) => keeper({ solo: { limits: { '/v1/ping': { capacity, perMinute } } } }, [['acme', 'solo']]);
const view = d => [d.allowed, d.remaining, d.retryAfter, d.reason];
const ceilSeconds = ms => Math.ceil(ms / 1000);

function drain(k, clientId, route, now, times) {
  for (let i = 0; i < times; i++) assert.equal(k.check(clientId, route, now).allowed, true, `request ${i + 1} at ${now} should be allowed`);
}

// ---------------------------------------------------------------------------- Part 1

describe('CoreBucketTests', () => {
  test('new bucket starts full and counts down', () => {
    const k = keeper();
    for (const left of [4, 3, 2, 1, 0]) {
      const decision = k.check('acme', '/v1/search', 0);
      assert.deepEqual(view(decision), [true, left, 0, 'ok']);
      assert.equal(decision.rule, '/v1/search');
    }
    const denied = k.check('acme', '/v1/search', 0);
    assert.deepEqual(view(denied), [false, 0, 6, 'rate_limited']);
    assert.equal(denied.rule, '/v1/search');
  });

  test('retry after rounds up to whole seconds', () => {
    const k = keeper();
    drain(k, 'acme', '/v1/search', 0, 5);
    assert.deepEqual(view(k.check('acme', '/v1/search', 1500)), [false, 0, 5, 'rate_limited']); // 4.5 s left
    assert.deepEqual(view(k.check('acme', '/v1/search', 3000)), [false, 0, 3, 'rate_limited']); // exactly 3 s
    assert.deepEqual(view(k.check('acme', '/v1/search', 5001)), [false, 0, 1, 'rate_limited']); // 0.999 s
  });

  test('tokens arrive exactly on schedule and denials cost nothing', () => {
    const k = keeper();
    drain(k, 'acme', '/v1/search', 0, 5);
    for (let t = 0; t <= 5900; t += 100) {
      assert.deepEqual(view(k.check('acme', '/v1/search', t)), [false, 0, ceilSeconds(6000 - t), 'rate_limited'], `t=${t}`);
    }
    assert.deepEqual(view(k.check('acme', '/v1/search', 5999)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 6000)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 6000)), [false, 0, 6, 'rate_limited']);
  });

  test('partial tokens carry over and refill is capped', () => {
    const k = keeper();
    drain(k, 'acme', '/v1/search', 0, 5);
    assert.deepEqual(view(k.check('acme', '/v1/search', 9000)), [true, 0, 0, 'ok']);           // 1.5 -> 0.5
    assert.deepEqual(view(k.check('acme', '/v1/search', 11999)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 12000)), [true, 0, 0, 'ok']);          // 0.5 + 0.5
    // Ten idle minutes would add 100 tokens, but the bucket stops at capacity.
    for (const left of [4, 3, 2, 1, 0]) assert.deepEqual(view(k.check('acme', '/v1/search', 612000)), [true, left, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 612000)), [false, 0, 6, 'rate_limited']);
  });

  test('buckets are separate per client and per route', () => {
    const k = keeper(PLANS, [['acme', 'free'], ['globex', 'free']]);
    drain(k, 'acme', '/v1/search', 0, 5);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, false);
    assert.deepEqual(view(k.check('globex', '/v1/search', 0)), [true, 4, 0, 'ok']);
    const orders = k.check('acme', '/v1/orders', 0);
    assert.deepEqual(view(orders), [true, 1, 0, 'ok']);
    assert.equal(orders.rule, '/v1/orders');
    assert.deepEqual(view(k.check('acme', '/v1/orders', 0)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/orders', 0)), [false, 0, 60, 'rate_limited']);
  });

  test('token counts are exact where floats drift', () => {
    const k = solo(1, 3); // one token every 20 s; polling every 2 s adds 0.1 token each time
    assert.deepEqual(view(k.check('acme', '/v1/ping', 0)), [true, 0, 0, 'ok']);
    for (let t = 2000; t < 20000; t += 2000) {
      assert.deepEqual(view(k.check('acme', '/v1/ping', t)), [false, 0, (20000 - t) / 1000, 'rate_limited'], `t=${t}`);
    }
    assert.deepEqual(view(k.check('acme', '/v1/ping', 20000)), [true, 0, 0, 'ok']);
  });

  test('rates that do not divide a minute', () => {
    const k = solo(2, 7); // a token every 8571.43 ms
    assert.deepEqual(view(k.check('acme', '/v1/ping', 0)), [true, 1, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 0)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 0)), [false, 0, 9, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 8571)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 8572)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 8572)), [false, 0, 9, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 17142)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/ping', 17143)), [true, 0, 0, 'ok']);
  });
});

describe('CoreErrorTests', () => {
  test('client registration errors', () => {
    const k = keeper();
    assert.throws(() => k.check('ghost', '/v1/search', 0), UnknownClientError);
    assert.throws(() => k.registerClient('initech', 'gold'), UnknownPlanError);
    assert.throws(() => k.check('initech', '/v1/search', 0), UnknownClientError);
    assert.throws(() => k.registerClient('acme', 'pro'), DuplicateClientError);
    // acme is still on free: no /v1/reports rule and a capacity of 5.
    assert.throws(() => k.check('acme', '/v1/reports', 0), UnknownRouteError);
    drain(k, 'acme', '/v1/search', 0, 5);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, false);
    for (const ErrorClass of [UnknownClientError, UnknownPlanError, DuplicateClientError]) {
      assert.ok(ErrorClass.prototype instanceof RateKeeperError, `${ErrorClass.name} extends RateKeeperError`);
    }
  });

  test('route without a rule throws', () => {
    const k = keeper();
    for (const route of ['/v1/reports', '/v1/search/images', '/v1', '/v2/search']) {
      assert.throws(() => k.check('acme', route, 0), UnknownRouteError, route);
    }
    assert.ok(UnknownRouteError.prototype instanceof RateKeeperError);
    assert.deepEqual(view(k.check('acme', '/v1/search', 0)), [true, 4, 0, 'ok']);
  });

  test('invalid limits throw ConfigError', () => {
    const bad = [
      { capacity: 0, perMinute: 10 },
      { capacity: 5, perMinute: 0 },
      { capacity: -1, perMinute: 10 },
      { capacity: 2.5, perMinute: 10 },
      { capacity: 5, perMinute: 1.5 },
    ];
    for (const limit of bad) {
      assert.throws(() => new RateKeeper({ free: { limits: { '/v1/search': limit } } }), ConfigError, JSON.stringify(limit));
    }
    assert.ok(ConfigError.prototype instanceof RateKeeperError);
  });
});

// ---------------------------------------------------------------------------- Part 2

describe('RoutingTests', () => {
  test('star matches exactly one segment', () => {
    const k = keeper({ p: { limits: { '/v1/users/*': { capacity: 3, perMinute: 60 } } } }, [['acme', 'p']]);
    const first = k.check('acme', '/v1/users/42', 0);
    assert.deepEqual([first.allowed, first.rule], [true, '/v1/users/*']);
    assert.deepEqual(view(k.check('acme', '/v1/users/me', 0)), [true, 1, 0, 'ok']);
    for (const route of ['/v1/users', '/v1/users/42/orders', '/v2/users/42']) {
      assert.throws(() => k.check('acme', route, 0), UnknownRouteError, route);
    }
  });

  test('double star matches one or more segments', () => {
    const k = keeper({ p: { limits: { '/v1/**': { capacity: 10, perMinute: 60 } } } }, [['acme', 'p']]);
    for (const route of ['/v1/a', '/v1/a/b', '/v1/a/b/c/d']) {
      const decision = k.check('acme', route, 0);
      assert.deepEqual([decision.allowed, decision.rule], [true, '/v1/**'], route);
    }
    for (const route of ['/v1', '/v2/a', '/v10/a']) {
      assert.throws(() => k.check('acme', route, 0), UnknownRouteError, route);
    }
  });

  test('most specific rule wins', () => {
    const k = keeper(GATEWAY, [['acme', 'gateway']]);
    const cases = [
      ['/v1/users/me', '/v1/users/me'],   // an exact match beats every wildcard
      ['/v1/users/42', '/v1/users/*'],
      ['/v1/users', '/v1/**'],
      ['/v1/users/42/orders', '/v1/**'],
      ['/v1', '/**'],
      ['/health', '/**'],
    ];
    for (const [route, rule] of cases) {
      const decision = k.check('acme', route, 0);
      assert.deepEqual([decision.allowed, decision.rule], [true, rule], route);
    }
  });

  test('specificity is decided left to right', () => {
    const k = keeper(GATEWAY, [['acme', 'gateway']]);
    const cases = [
      ['/v1/users/status', '/v1/users/*'],        // literal beats '*' at the 2nd segment
      ['/v1/reports/daily', '/v1/**'],            // literal beats '*' at the 1st segment
      ['/v1/orders/status', '/v1/*/status'],      // '*' beats '**' at the 2nd segment
      ['/v2/reports/daily', '/*/reports/daily'],  // '*' beats '**' at the 1st segment
    ];
    for (const [route, rule] of cases) {
      const decision = k.check('acme', route, 0);
      assert.deepEqual([decision.allowed, decision.rule], [true, rule], route);
    }
  });

  test('routes matching one rule share a bucket', () => {
    const k = keeper(GATEWAY, [['acme', 'gateway']]);
    for (const [user, left] of [[1, 2], [2, 1], [3, 0]]) {
      const decision = k.check('acme', `/v1/users/${user}`, 0);
      assert.deepEqual(view(decision), [true, left, 0, 'ok']);
      assert.equal(decision.rule, '/v1/users/*');
    }
    const denied = k.check('acme', '/v1/users/4', 0);
    assert.deepEqual(view(denied), [false, 0, 1, 'rate_limited']);
    assert.equal(denied.rule, '/v1/users/*');
    assert.deepEqual(view(k.check('acme', '/v1/users/me', 0)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/users/4', 1000)), [true, 0, 0, 'ok']);
  });

  test('invalid patterns and quotas throw ConfigError', () => {
    const limit = { capacity: 1, perMinute: 1 };
    for (const pattern of ['v1/search', '/v1//search', '/v1/search/', '/', '/v1/**/items', '/v1/se*', '/v1/***']) {
      assert.throws(() => new RateKeeper({ p: { limits: { [pattern]: limit } } }), ConfigError, pattern);
    }
    for (const quota of [0, -5, 2.5]) {
      assert.throws(() => new RateKeeper({ p: { dailyQuota: quota, limits: { '/v1/x': limit } } }), ConfigError, String(quota));
    }
    // Valid configurations are accepted.
    new RateKeeper({ p: { dailyQuota: null, limits: { '/**': limit, '/v1/*/x': limit, '/*': limit } } });
  });
});

describe('DailyQuotaTests', () => {
  test('quota counts allowed requests across routes', () => {
    const k = keeper(METERED, [['acme', 'metered']]);
    assert.deepEqual(view(k.check('acme', '/v1/search', 1000)), [true, 9, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/orders', 2000)), [true, 9, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 3000)), [true, 9, 0, 'ok']);
    const over = k.check('acme', '/v1/orders', 4000);
    assert.deepEqual(view(over), [false, 10, 86396, 'quota_exceeded']);
    assert.equal(over.rule, '/v1/orders');
    assert.deepEqual(view(k.check('acme', '/v1/search', 5000)), [false, 10, 86395, 'quota_exceeded']);
  });

  test('quota resets exactly at the day boundary', () => {
    const k = keeper(METERED, [['acme', 'metered']]);
    for (const t of [DAY - 10000, DAY - 9000, DAY - 8000]) assert.equal(k.check('acme', '/v1/search', t).allowed, true);
    assert.deepEqual(view(k.check('acme', '/v1/search', DAY - 1)), [false, 10, 1, 'quota_exceeded']);
    for (const left of [9, 8, 7]) assert.deepEqual(view(k.check('acme', '/v1/search', DAY)), [true, left, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', DAY)), [false, 7, 86400, 'quota_exceeded']);
  });

  test('denied requests do not use quota', () => {
    const k = keeper(METERED, [['acme', 'tight']]);
    assert.deepEqual(view(k.check('acme', '/v1/search', 0)), [true, 0, 0, 'ok']);
    for (const t of [0, 200, 400]) assert.deepEqual(view(k.check('acme', '/v1/search', t)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 1000)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 2000)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 3000)), [false, 1, 86397, 'quota_exceeded']);
  });

  test('quota is checked before the bucket', () => {
    const k = keeper(METERED, [['acme', 'tight']]);
    for (const t of [0, 1000, 2000]) assert.equal(k.check('acme', '/v1/search', t).allowed, true);
    assert.deepEqual(view(k.check('acme', '/v1/search', 2000)), [false, 0, 86398, 'quota_exceeded']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 2500)), [false, 0, 86398, 'quota_exceeded']);
  });
});

describe('PlanChangeTests', () => {
  test('upgrade keeps spent tokens spent', () => {
    const k = keeper();
    drain(k, 'acme', '/v1/search', 0, 3);
    k.changePlan('acme', 'pro', 0);
    assert.deepEqual(view(k.check('acme', '/v1/search', 0)), [true, 16, 0, 'ok']);  // 20 - 3 spent - 1
    const reports = k.check('acme', '/v1/reports', 0);                               // new rule starts full
    assert.deepEqual(view(reports), [true, 2, 0, 'ok']);
    assert.equal(reports.rule, '/v1/reports');
  });

  test('plan change settles refill at the old rate first', () => {
    const k = keeper();
    drain(k, 'acme', '/v1/search', 0, 5);
    k.changePlan('acme', 'pro', 9000); // 1.5 tokens on free -> 3.5 spent -> 16.5 on pro
    assert.deepEqual(view(k.check('acme', '/v1/search', 9000)), [true, 15, 0, 'ok']);  // 15.5 left
    assert.deepEqual(view(k.check('acme', '/v1/search', 9500)), [true, 15, 0, 'ok']);  // +0.5 at pro rate
  });

  test('downgrade never goes below zero and uses the new rate', () => {
    const k = keeper(PLANS, [['acme', 'pro']]);
    drain(k, 'acme', '/v1/search', 0, 12);
    drain(k, 'acme', '/v1/orders', 0, 1);
    k.changePlan('acme', 'free', 0);
    assert.deepEqual(view(k.check('acme', '/v1/search', 0)), [false, 0, 6, 'rate_limited']); // max(0, 5 - 12)
    assert.deepEqual(view(k.check('acme', '/v1/orders', 0)), [true, 0, 0, 'ok']);            // 2 - 1 spent
    assert.deepEqual(view(k.check('acme', '/v1/search', 6000)), [true, 0, 0, 'ok']);
  });

  test('buckets missing from the new plan are dropped', () => {
    const k = keeper(PLANS, [['acme', 'pro']]);
    drain(k, 'acme', '/v1/reports', 0, 3);
    k.changePlan('acme', 'free', 0);
    assert.throws(() => k.check('acme', '/v1/reports', 0), UnknownRouteError);
    k.changePlan('acme', 'pro', 1000);
    assert.deepEqual(view(k.check('acme', '/v1/reports', 1000)), [true, 2, 0, 'ok']);
  });

  test('changePlan errors leave the client unchanged', () => {
    const k = keeper();
    assert.throws(() => k.changePlan('ghost', 'pro', 0), UnknownClientError);
    assert.throws(() => k.changePlan('acme', 'gold', 0), UnknownPlanError);
    assert.throws(() => k.check('acme', '/v1/reports', 0), UnknownRouteError);
    drain(k, 'acme', '/v1/search', 0, 5);
    assert.deepEqual(view(k.check('acme', '/v1/search', 0)), [false, 0, 6, 'rate_limited']);
  });

  test('daily usage carries over and the new quota applies at once', () => {
    const k = keeper(METERED, [['acme', 'metered']]);
    for (const t of [1000, 2000, 3000]) assert.equal(k.check('acme', '/v1/search', t).allowed, true);
    assert.equal(k.check('acme', '/v1/search', 4000).reason, 'quota_exceeded');
    k.changePlan('acme', 'bulk', 5000);
    assert.deepEqual(view(k.check('acme', '/v1/search', 5000)), [true, 9, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 6000)), [true, 9, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 7000)), [false, 10, 86393, 'quota_exceeded']);
    k.changePlan('acme', 'metered', 8000);
    assert.deepEqual(view(k.check('acme', '/v1/search', 8000)), [false, 10, 86392, 'quota_exceeded']);
  });
});

// ---------------------------------------------------------------------------- Part 3

/** free plan on GUARDED with a penalty: allowed at 0, strikes at 0, 100 and 200. */
function trip(k, clientId = 'acme') {
  assert.equal(k.check(clientId, '/v1/search', 0).allowed, true);
  return [k.check(clientId, '/v1/search', 0), k.check(clientId, '/v1/search', 100), k.check(clientId, '/v1/search', 200)];
}

describe('PenaltyTests', () => {
  test('strikes inside the window block every route', () => {
    const k = keeper(GUARDED, [['acme', 'free']], PENALTY);
    const [first, second, third] = trip(k);
    assert.deepEqual(view(first), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(second), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(third), [false, 0, 60, 'blocked']);              // blocked until 60 200
    const orders = k.check('acme', '/v1/orders', 1000);
    assert.deepEqual(view(orders), [false, 5, 60, 'blocked']);             // 59.2 s left
    assert.equal(orders.rule, '/v1/orders');
    assert.equal(k.usage('acme', 30000).blockedUntil, 60200);
    assert.deepEqual(view(k.check('acme', '/v1/search', 60199)), [false, 1, 1, 'blocked']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 60200)), [true, 0, 0, 'ok']);
    assert.equal(k.usage('acme', 60200).blockedUntil, null);
  });

  test('strikes older than the window do not count', () => {
    const k = keeper(GUARDED, [['acme', 'slow']], PENALTY);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, true);
    assert.deepEqual(view(k.check('acme', '/v1/search', 1000)), [false, 0, 59, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 6000)), [false, 0, 54, 'rate_limited']);
    // The window at 11 000 is (1 000, 11 000]: the strike at 1 000 has just left it.
    assert.deepEqual(view(k.check('acme', '/v1/search', 11000)), [false, 0, 49, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 11001)), [false, 0, 60, 'blocked']);
  });

  test('blocked requests are not strikes and a block clears the history', () => {
    const k = keeper(GUARDED, [['acme', 'free']], { strikes: 3, windowSeconds: 60, blockSeconds: 5 });
    const [, , third] = trip(k);
    assert.deepEqual(view(third), [false, 0, 5, 'blocked']);               // blocked until 5 200
    for (const t of [1000, 2000, 3000, 4000, 5000]) {
      assert.deepEqual(view(k.check('acme', '/v1/search', t)), [false, 1, ceilSeconds(5200 - t), 'blocked'], `t=${t}`);
    }
    assert.deepEqual(view(k.check('acme', '/v1/search', 5200)), [true, 0, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 5200)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 5300)), [false, 0, 1, 'rate_limited']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 5400)), [false, 0, 5, 'blocked']);
  });

  test('plan changes do not lift a block', () => {
    const k = keeper(GUARDED, [['acme', 'free']], PENALTY);
    trip(k);
    k.changePlan('acme', 'pro', 20000);
    assert.deepEqual(view(k.check('acme', '/v1/search', 20000)), [false, 50, 41, 'blocked']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 60200)), [true, 49, 0, 'ok']);
  });

  test('quota denials are strikes too', () => {
    const k = keeper(GUARDED, [['acme', 'metered']], { strikes: 2, windowSeconds: 10, blockSeconds: 30 });
    assert.deepEqual(view(k.check('acme', '/v1/search', 0)), [true, 4, 0, 'ok']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 1000)), [false, 5, 86399, 'quota_exceeded']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 2000)), [false, 5, 30, 'blocked']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 31999)), [false, 5, 1, 'blocked']);
    assert.deepEqual(view(k.check('acme', '/v1/search', 32000)), [false, 5, 86368, 'quota_exceeded']);
  });

  test('invalid penalty throws ConfigError', () => {
    const bad = [
      { strikes: 0, windowSeconds: 10, blockSeconds: 60 },
      { strikes: 3, windowSeconds: 0, blockSeconds: 60 },
      { strikes: 3, windowSeconds: 10, blockSeconds: -1 },
      { strikes: 3, windowSeconds: 1.5, blockSeconds: 60 },
    ];
    for (const penalty of bad) {
      assert.throws(() => new RateKeeper(GUARDED, { penalty }), ConfigError, JSON.stringify(penalty));
    }
  });
});

describe('UsageTests', () => {
  test('usage reports quota and every rule', () => {
    const k = keeper(REPORTING, [['acme', 'metered']]);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, true);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, true);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, false);
    assert.equal(k.check('acme', '/v1/orders', 500).allowed, true);
    assert.equal(k.check('acme', '/v1/other', 500).rule, '/v1/**');
    const expected = {
      clientId: 'acme',
      plan: 'metered',
      dayUsed: 4,
      dayRemaining: 1,
      blockedUntil: null,
      rules: [
        { rule: '/v1/**', tokens: 3, allowed: 1, denied: 0 },
        { rule: '/v1/orders', tokens: 2, allowed: 1, denied: 0 },
        { rule: '/v1/search', tokens: 1, allowed: 2, denied: 1 },
      ],
    };
    assert.deepEqual(k.usage('acme', 1000), expected);
    assert.deepEqual(k.usage('acme', 1000), expected); // reading the report changes nothing
    assert.deepEqual(view(k.check('acme', '/v1/search', 1000)), [true, 0, 0, 'ok']);
  });

  test('usage resets daily counts and follows plan changes', () => {
    const k = keeper(REPORTING, [['acme', 'metered']]);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, true);
    assert.equal(k.check('acme', '/v1/search', 0).allowed, true);
    const nextDay = k.usage('acme', DAY + 5);
    assert.deepEqual([nextDay.dayUsed, nextDay.dayRemaining], [0, 5]);
    k.changePlan('acme', 'open', DAY + 5);
    assert.equal(k.check('acme', '/v2/a', DAY + 5).allowed, true);
    assert.deepEqual(k.usage('acme', DAY + 5), {
      clientId: 'acme',
      plan: 'open',
      dayUsed: 1,
      dayRemaining: null,
      blockedUntil: null,
      rules: [
        { rule: '/v1/search', tokens: 10, allowed: 2, denied: 0 },
        { rule: '/v2/**', tokens: 0, allowed: 1, denied: 0 },
      ],
    });
    assert.throws(() => k.usage('ghost', 0), UnknownClientError);
  });
});
