const {test} = require('node:test');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');
const {createRateLimiter} = require('../src/lib/rate-limiter');

const USERS = [
  {id: 'usr_eli', name: 'Eli', role: 'editor'},
  {id: 'usr_vic', name: 'Vic', role: 'viewer'}
];
const TOKENS = [
  {id: 'tok_eli', userId: 'usr_eli', secret: 'test_editor_0001', revoked: false},
  {id: 'tok_eli_ci', userId: 'usr_eli', secret: 'test_editor_ci_01', revoked: false},
  {id: 'tok_vic', userId: 'usr_vic', secret: 'test_viewer_0001', revoked: false}
];
const AS = {eli: 'test_editor_0001', eliCi: 'test_editor_ci_01', viewer: 'test_viewer_0001'};

// The app with a fake clock and a limit of 5 requests per 10 seconds.
async function withApi(fn) {
  const store = createStore({users: USERS, tokens: TOKENS, docs: []});
  const clock = {now: 0};
  const server = createApp({store, clock: () => clock.now, rateLimit: {limit: 5, windowMs: 10000}}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (at, as = 'viewer', path = '/docs') => {
    clock.now = at;
    const res = await fetch(base + path, {headers: as ? {authorization: `Bearer ${AS[as]}`} : {}});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {status: res.status, headers: res.headers, body: json,
      remaining: res.headers.get('x-ratelimit-remaining'), retryAfter: res.headers.get('retry-after')};
  };
  try {
    return await fn(call);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('over the limit is a 429 with Retry-After and the error body', () => withApi(async call => {
  for (let i = 1; i <= 5; i++) {
    const res = await call(1000);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-ratelimit-limit'), '5');
    assert.equal(res.remaining, String(5 - i));
  }
  const res = await call(1000);
  assert.equal(res.status, 429);
  assert.equal(res.body.error.code, 'rate_limited');
  assert.equal(res.retryAfter, '10');
  assert.equal(res.remaining, '0');
}));

test('the window slides: requests expire one by one, windowMs after they were made', () => withApi(async call => {
  for (let i = 0; i < 3; i++) assert.equal((await call(1000)).status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await call(7000)).status, 200);
  const blocked = await call(9000);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.retryAfter, '2', 'the 1000 ms requests leave the window at 11000 ms');
  assert.equal((await call(10999)).status, 429);
  const after = await call(11000);
  assert.equal(after.status, 200);
  assert.equal(after.remaining, '2', 'two of the five remain: the 7000 ms pair and this one are in the window');
}));

test('a burst across a clock boundary is still limited', () => withApi(async call => {
  for (let i = 0; i < 5; i++) assert.equal((await call(9500)).status, 200);
  const res = await call(10500);
  assert.equal(res.status, 429, '5 requests at 9500 ms are still inside the window at 10500 ms');
  assert.equal(res.retryAfter, '9');
  assert.equal((await call(19500)).status, 200);
}));

test('refused requests do not count against the limit', () => withApi(async call => {
  for (let i = 0; i < 5; i++) await call(0);
  for (let t = 1000; t < 10000; t += 450) assert.equal((await call(t)).status, 429);
  const res = await call(10000);
  assert.equal(res.status, 200, 'hammering while blocked must not extend the block');
  assert.equal(res.remaining, '4');
}));

test('Retry-After rounds up to whole seconds and is at least 1', () => withApi(async call => {
  for (let i = 0; i < 5; i++) await call(2300);
  assert.equal((await call(2301)).retryAfter, '10');
  assert.equal((await call(11300)).retryAfter, '1');
  assert.equal((await call(12299)).retryAfter, '1');
  assert.equal((await call(12300)).status, 200);
}));

test('each token has its own budget; unauthenticated requests are not counted', () => withApi(async call => {
  for (let i = 0; i < 5; i++) await call(500, 'eli');
  assert.equal((await call(600, 'eli')).status, 429);
  assert.equal((await call(600, 'eliCi')).status, 200, 'another token of the same user');
  assert.equal((await call(600, 'viewer')).status, 200);
  for (let i = 0; i < 8; i++) assert.equal((await call(700, null)).status, 401);
  assert.equal((await call(700, null, '/health')).status, 200);
  assert.equal((await call(700, 'viewer')).remaining, '3');
}));

// A straightforward reference: the times of allowed requests per key, oldest first.
function referenceLimiter({limit, windowMs, now}) {
  const keys = new Map();
  return {
    hit(key) {
      const time = now();
      let s = keys.get(key);
      if (!s) keys.set(key, (s = {times: [], head: 0}));
      while (s.head < s.times.length && time - s.times[s.head] >= windowMs) s.head++;
      if (s.head > 1024) { s.times = s.times.slice(s.head); s.head = 0; }
      const count = s.times.length - s.head;
      if (count < limit) { s.times.push(time); return {allowed: true, limit, remaining: limit - count - 1, retryAfterMs: 0}; }
      return {allowed: false, limit, remaining: 0, retryAfterMs: s.times[s.head] + windowMs - time};
    }
  };
}

test('exact results for a small scripted sequence', () => {
  let time = 0;
  const limiter = createRateLimiter({limit: 3, windowMs: 1000, now: () => time});
  const script = [[0, 'a'], [100, 'a'], [200, 'b'], [300, 'a'], [400, 'a'], [999, 'a'], [1000, 'a'], [1050, 'a'], [1100, 'a'], [1299, 'a'], [1300, 'a'], [5000, 'a']];
  const got = script.map(([t, key]) => { time = t; const r = limiter.hit(key); return [t, key, r.allowed, r.remaining, r.retryAfterMs]; });
  assert.deepEqual(got, [
    [0, 'a', true, 2, 0], [100, 'a', true, 1, 0], [200, 'b', true, 2, 0], [300, 'a', true, 0, 0],
    [400, 'a', false, 0, 600], [999, 'a', false, 0, 1], [1000, 'a', true, 0, 0], [1050, 'a', false, 0, 50],
    [1100, 'a', true, 0, 0], [1299, 'a', false, 0, 1], [1300, 'a', true, 0, 0], [5000, 'a', true, 2, 0]
  ]);
});

test('600,000 requests from 20 tokens: exact and fast', () => {
  const HITS = 600000, KEYS = 20, LIMIT = 5000, WINDOW_MS = 5000, BUDGET_MS = 1000;
  // Seeded traffic: two hot tokens take 60% of requests and hit the limit;
  // the rest stay under it. The clock moves 0 or 1 ms between requests.
  let seed = 20260504;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const keys = new Array(HITS), times = new Float64Array(HITS);
  let t = 1_700_000_000_000;
  for (let i = 0; i < HITS; i++) {
    const r = random();
    keys[i] = r < 0.3 ? 'tok_hot_a' : r < 0.6 ? 'tok_hot_b' : `tok_${Math.floor(random() * (KEYS - 2))}`;
    if (random() < 0.25) t += 1;
    times[i] = t;
  }

  let i = 0;
  const now = () => times[i];
  const limiter = createRateLimiter({limit: LIMIT, windowMs: WINDOW_MS, now});
  const allowed = new Uint8Array(HITS), remaining = new Int32Array(HITS), retry = new Float64Array(HITS);
  const started = performance.now();
  for (i = 0; i < HITS; i++) {
    const r = limiter.hit(keys[i]);
    allowed[i] = r.allowed ? 1 : 0;
    remaining[i] = r.remaining;
    retry[i] = r.retryAfterMs;
    if ((i & 4095) === 0 && performance.now() - started > BUDGET_MS) {
      assert.fail(`too slow: only ${i} of ${HITS} requests checked in ${BUDGET_MS} ms. Each hit must not scan the whole window.`);
    }
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed <= BUDGET_MS, `took ${Math.round(elapsed)} ms; the budget is ${BUDGET_MS} ms`);

  const reference = referenceLimiter({limit: LIMIT, windowMs: WINDOW_MS, now});
  let refused = 0;
  for (i = 0; i < HITS; i++) {
    const want = reference.hit(keys[i]);
    if (!want.allowed) refused++;
    if (allowed[i] !== (want.allowed ? 1 : 0) || remaining[i] !== want.remaining || retry[i] !== want.retryAfterMs) {
      assert.fail(`request ${i} (${keys[i]} at +${times[i] - times[0]} ms): got allowed=${!!allowed[i]} remaining=${remaining[i]} retryAfterMs=${retry[i]}, expected allowed=${want.allowed} remaining=${want.remaining} retryAfterMs=${want.retryAfterMs}`);
    }
  }
  assert.ok(refused > 10000, 'the hot tokens really were limited');
});
