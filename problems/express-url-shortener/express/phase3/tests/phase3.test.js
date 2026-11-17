const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-01-01T00:00:00.000Z');
const DAYS = 90; // clicks fall on 1 January .. 31 March 2026
const TOTAL_CLICKS = 200000;
const REQUESTS = 50;
const LIMIT_SECONDS = 0.6;

// Small seeded generator (LCG) so every run builds the same data.
function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const dayName = index => new Date(START + index * DAY_MS).toISOString().slice(0, 10);

async function startApp(store, nowIso) {
  const server = createApp({store, now: () => new Date(nowIso)}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, user = 'ana') => {
    const res = await fetch(base + path, {redirect: 'manual', headers: user ? {'X-User-Id': user} : {}});
    return {status: res.status, headers: res.headers, body: await res.json().catch(() => null)};
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  };
  return {call, stop};
}

// Brute-force expected answer from per-day counts.
function expected(perDay, fromIndex, toIndex) {
  const daily = [];
  for (let i = fromIndex; i <= toIndex; i++) daily.push({date: dayName(i), clicks: perDay[i] || 0});
  return {from: dayName(fromIndex), to: dayName(toIndex), totalClicks: daily.reduce((s, d) => s + d.clicks, 0), daily};
}

let app;
let perDay;

before(async () => {
  const store = createStore({links: [
    {slug: 'big', url: 'https://example.com/big', owner: 'ana', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: null}
  ]});
  const random = lcg(2026);
  perDay = new Array(DAYS).fill(0);
  for (let i = 0; i < TOTAL_CLICKS; i++) {
    const dayIndex = Math.floor(random() * DAYS);
    const atMs = START + dayIndex * DAY_MS + Math.floor(random() * DAY_MS);
    perDay[dayIndex]++;
    await store.recordClick('big', atMs);
  }
  app = await startApp(store, '2026-04-01T12:00:00.000Z');
});

after(async () => {
  if (app) await app.stop();
});

test('stats on a link with 200,000 clicks are correct for the whole range', async () => {
  const res = await app.call('/api/links/big/stats?from=2026-01-01&to=2026-03-31');
  assert.equal(res.status, 200);
  assert.equal(res.body.totalClicks, TOTAL_CLICKS);
  assert.deepEqual(res.body, {slug: 'big', ...expected(perDay, 0, DAYS - 1)});
});

test('stats stay correct on single days, week boundaries and the default range', async () => {
  for (const [from, to] of [[0, 0], [89, 89], [3, 9], [30, 30], [58, 60], [0, 44]]) {
    const res = await app.call(`/api/links/big/stats?from=${dayName(from)}&to=${dayName(to)}`);
    assert.deepEqual(res.body, {slug: 'big', ...expected(perDay, from, to)}, `${dayName(from)}..${dayName(to)}`);
  }
  const dflt = await app.call('/api/links/big/stats');
  assert.equal(dflt.body.from, '2026-01-01');
  assert.equal(dflt.body.to, '2026-04-01');
  assert.equal(dflt.body.totalClicks, TOTAL_CLICKS);
  assert.equal(dflt.body.daily.length, 91);
});

test('50 stats requests on 200,000 clicks stay fast', async () => {
  const random = lcg(99);
  const queries = [];
  for (let i = 0; i < REQUESTS; i++) {
    const a = Math.floor(random() * DAYS);
    const b = Math.floor(random() * DAYS);
    queries.push([Math.min(a, b), Math.max(a, b)]);
  }
  const results = [];
  const startedAt = performance.now();
  for (const [from, to] of queries) {
    results.push(await app.call(`/api/links/big/stats?from=${dayName(from)}&to=${dayName(to)}`));
  }
  const elapsed = (performance.now() - startedAt) / 1000;
  assert.ok(elapsed < LIMIT_SECONDS, `${REQUESTS} stats requests took ${elapsed.toFixed(2)}s; must be under ${LIMIT_SECONDS}s`);
  queries.forEach(([from, to], i) => {
    assert.equal(results[i].status, 200);
    assert.deepEqual(results[i].body, {slug: 'big', ...expected(perDay, from, to)});
  });
});

test('clicks recorded after the data was loaded show up straight away, including parallel ones', async () => {
  const before = (await app.call('/api/links/big/stats?from=2026-03-31&to=2026-03-31')).body.totalClicks;
  const followed = await Promise.all(Array.from({length: 60}, () => app.call('/big', null)));
  assert.ok(followed.every(r => r.status === 302));
  const after = await app.call('/api/links/big/stats?from=2026-03-31&to=2026-04-01');
  assert.equal(after.body.totalClicks, before + 60);
  assert.deepEqual(after.body.daily.map(d => d.date), ['2026-03-31', '2026-04-01']);
  assert.equal(after.body.daily[1].clicks, 60, 'the 60 visits happened on 1 April');
});

test('a medium link checked against a brute-force count', async () => {
  const store = createStore({links: [
    {slug: 'Mid', url: 'https://example.com/mid', owner: 'ben', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: null}
  ]});
  const random = lcg(5);
  const times = [];
  for (let i = 0; i < 3000; i++) {
    const atMs = START + Math.floor(random() * 20 * DAY_MS);
    times.push(atMs);
    await store.recordClick('mid', atMs);
  }
  const small = await startApp(store, '2026-01-25T00:00:00.000Z');
  try {
    for (const [from, to] of [[0, 19], [5, 5], [7, 12], [19, 24]]) {
      const res = await small.call(`/api/links/MID/stats?from=${dayName(from)}&to=${dayName(to)}`, 'ben');
      const expectedDaily = [];
      for (let i = from; i <= to; i++) {
        const lo = START + i * DAY_MS;
        expectedDaily.push({date: dayName(i), clicks: times.filter(t => t >= lo && t < lo + DAY_MS).length});
      }
      assert.equal(res.status, 200);
      assert.equal(res.body.slug, 'Mid');
      assert.deepEqual(res.body.daily, expectedDaily);
      assert.equal(res.body.totalClicks, expectedDaily.reduce((s, d) => s + d.clicks, 0));
    }
    assert.equal((await small.call('/api/links/mid/stats', 'ana')).status, 403);
  } finally {
    await small.stop();
  }
});
