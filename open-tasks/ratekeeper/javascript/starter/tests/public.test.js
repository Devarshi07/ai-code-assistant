// Provided tests: the basic happy path. Hidden acceptance tests cover much more.
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { RateKeeper, UnknownClientError } = require('../src');

const PLANS = {
  free: {
    limits: {
      '/v1/search': { capacity: 5, perMinute: 10 }, // one token every 6 s
      '/v1/orders': { capacity: 2, perMinute: 1 },  // one token every 60 s
    },
  },
  pro: {
    dailyQuota: 2,
    limits: {
      '/v1/search': { capacity: 20, perMinute: 60 },
      '/v1/users/*': { capacity: 3, perMinute: 60 },
    },
  },
};

const view = d => [d.allowed, d.remaining, d.retryAfter, d.reason];

describe('RateKeeper basics', () => {
  let keeper;
  beforeEach(() => {
    keeper = new RateKeeper(PLANS);
    keeper.registerClient('acme', 'free');
  });

  test('allows up to capacity then rate limits', () => {
    for (const left of [4, 3, 2, 1, 0]) {
      const decision = keeper.check('acme', '/v1/search', 0);
      assert.deepEqual(view(decision), [true, left, 0, 'ok']);
      assert.equal(decision.rule, '/v1/search');
    }
    const denied = keeper.check('acme', '/v1/search', 0);
    assert.equal(denied.allowed, false);
    assert.equal(denied.reason, 'rate_limited');
  });

  test('bucket refills over time', () => {
    for (let i = 0; i < 5; i++) keeper.check('acme', '/v1/search', 0);
    assert.deepEqual(view(keeper.check('acme', '/v1/search', 6000)), [true, 0, 0, 'ok']);
    // 30 more seconds at 10 tokens per minute adds 5 tokens.
    assert.deepEqual(view(keeper.check('acme', '/v1/search', 36000)), [true, 4, 0, 'ok']);
  });

  test('each client has its own bucket', () => {
    keeper.registerClient('globex', 'free');
    for (let i = 0; i < 5; i++) keeper.check('acme', '/v1/search', 0);
    assert.equal(keeper.check('acme', '/v1/search', 0).allowed, false);
    assert.deepEqual(view(keeper.check('globex', '/v1/search', 0)), [true, 4, 0, 'ok']);
  });

  test('unknown client is rejected', () => {
    assert.throws(() => keeper.check('nobody', '/v1/search', 0), UnknownClientError);
  });

  test('wildcard rule matches route', () => {
    keeper.registerClient('initech', 'pro');
    const decision = keeper.check('initech', '/v1/users/42', 0);
    assert.deepEqual(view(decision), [true, 2, 0, 'ok']);
    assert.equal(decision.rule, '/v1/users/*');
  });

  test('daily quota stops requests', () => {
    keeper.registerClient('initech', 'pro');
    assert.equal(keeper.check('initech', '/v1/search', 1000).allowed, true);
    assert.equal(keeper.check('initech', '/v1/search', 2000).allowed, true);
    const third = keeper.check('initech', '/v1/search', 3000);
    assert.equal(third.allowed, false);
    assert.equal(third.reason, 'quota_exceeded');
  });
});
