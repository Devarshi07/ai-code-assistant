const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const LINKS = [
  {slug: 'handbook', url: 'https://intranet.example.com/wiki/handbook', owner: 'ana', createdAt: '2026-02-01T09:00:00.000Z', expiresAt: null},
  {slug: 'Standup', url: 'https://meet.example.com/rooms/daily-standup', owner: 'ben', createdAt: '2026-02-10T08:30:00.000Z', expiresAt: null}
];
const at = iso => Date.parse(iso);

// Starts a fresh app whose clock is clock.now, runs fn(call, store, clock), stops it.
async function withApi(fn, nowIso = '2026-02-05T10:00:00.000Z') {
  const clock = {now: new Date(nowIso)};
  const store = createStore({links: LINKS});
  const server = createApp({store, now: () => clock.now}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, {user} = {}) => {
    const res = await fetch(base + path, {method, redirect: 'manual', headers: user ? {'X-User-Id': user} : {}});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {status: res.status, headers: res.headers, body: json};
  };
  try {
    return await fn(call, store, clock);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const stats = (call, query = '', {slug = 'handbook', user = 'ana'} = {}) => call('GET', `/api/links/${slug}/stats${query}`, {user});

async function seedHandbook(store) {
  for (const iso of [
    '2026-02-01T09:30:00.000Z', '2026-02-01T23:59:59.999Z',
    '2026-02-02T00:00:00.000Z',
    '2026-02-04T08:00:00.000Z', '2026-02-04T12:00:00.000Z', '2026-02-04T20:15:00.000Z',
    '2026-02-05T09:00:00.000Z'
  ]) await store.recordClick('handbook', at(iso));
}

test('stats count clicks per UTC day, with zeros for quiet days', () => withApi(async (call, store) => {
  await seedHandbook(store);
  const res = await stats(call, '?from=2026-02-01&to=2026-02-05');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    slug: 'handbook',
    from: '2026-02-01',
    to: '2026-02-05',
    totalClicks: 7,
    daily: [
      {date: '2026-02-01', clicks: 2},
      {date: '2026-02-02', clicks: 1},
      {date: '2026-02-03', clicks: 0},
      {date: '2026-02-04', clicks: 3},
      {date: '2026-02-05', clicks: 1}
    ]
  });
}));

test('both ends of the range are inclusive whole UTC days', () => withApi(async (call, store) => {
  await seedHandbook(store);
  const res = await stats(call, '?from=2026-02-02&to=2026-02-04');
  assert.equal(res.body.totalClicks, 4);
  assert.deepEqual(res.body.daily.map(d => d.clicks), [1, 0, 3]);
  const one = await stats(call, '?from=2026-02-01&to=2026-02-01');
  assert.equal(one.body.totalClicks, 2, '23:59:59.999 still belongs to 1 February');
  assert.deepEqual(one.body.daily, [{date: '2026-02-01', clicks: 2}]);
}));

test('without from and to the range runs from the creation day to today', () => withApi(async (call, store) => {
  await seedHandbook(store);
  const res = await stats(call);
  assert.equal(res.status, 200);
  assert.equal(res.body.from, '2026-02-01');
  assert.equal(res.body.to, '2026-02-05');
  assert.equal(res.body.totalClicks, 7);
  assert.equal(res.body.daily.length, 5);
}));

test('only one bound given: the other uses its default', () => withApi(async (call, store) => {
  await seedHandbook(store);
  const from = await stats(call, '?from=2026-02-04');
  assert.equal(from.body.to, '2026-02-05');
  assert.equal(from.body.totalClicks, 4);
  const to = await stats(call, '?to=2026-02-02');
  assert.equal(to.body.from, '2026-02-01');
  assert.equal(to.body.totalClicks, 3);
}));

test('a range with no clicks, before the link existed or in the future, is all zeros', () => withApi(async (call, store) => {
  await seedHandbook(store);
  const before = await stats(call, '?from=2026-01-01&to=2026-01-03');
  assert.equal(before.status, 200);
  assert.equal(before.body.totalClicks, 0);
  assert.deepEqual(before.body.daily.map(d => d.clicks), [0, 0, 0]);
  const future = await stats(call, '?from=2026-03-01&to=2026-03-02');
  assert.equal(future.status, 200);
  assert.equal(future.body.totalClicks, 0);
}));

test('a link nobody has followed has zero clicks', () => withApi(async call => {
  const res = await stats(call, '', {slug: 'Standup', user: 'ben'});
  assert.equal(res.status, 200);
  assert.equal(res.body.slug, 'Standup');
  assert.equal(res.body.totalClicks, 0);
  assert.deepEqual(res.body.daily, [{date: '2026-02-10', clicks: 0}]);
}, '2026-02-10T18:00:00.000Z'));

test('following a link adds a click that shows up in the stats right away', () => withApi(async (call, store, clock) => {
  clock.now = new Date('2026-02-05T23:59:00.000Z');
  assert.equal((await call('GET', '/handbook')).status, 302);
  assert.equal((await call('GET', '/HANDBOOK')).status, 302);
  clock.now = new Date('2026-02-06T00:01:00.000Z');
  assert.equal((await call('GET', '/handbook')).status, 302);
  const res = await stats(call, '?from=2026-02-05&to=2026-02-06');
  assert.deepEqual(res.body.daily, [{date: '2026-02-05', clicks: 2}, {date: '2026-02-06', clicks: 1}]);
  assert.equal(res.body.totalClicks, 3);
}));

test('the slug in the path is matched ignoring case and the stored casing is returned', () => withApi(async call => {
  const res = await stats(call, '?from=2026-02-10&to=2026-02-10', {slug: 'STANDUP', user: 'ben'});
  assert.equal(res.status, 200);
  assert.equal(res.body.slug, 'Standup');
}, '2026-02-10T18:00:00.000Z'));

test('only the owner can read stats: anyone else gets 403', () => withApi(async call => {
  const res = await stats(call, '?from=2026-02-01&to=2026-02-05', {user: 'ben'});
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'forbidden');
  assert.equal(res.body.totalClicks, undefined);
}));

test('stats need X-User-Id, and an unknown link is 404 before anything else', () => withApi(async call => {
  const anonymous = await call('GET', '/api/links/handbook/stats');
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.error.code, 'unauthorized');
  const unknown = await stats(call, '?from=nonsense', {slug: 'nope', user: 'ana'});
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'not_found');
}));

test('ownership is checked before the query is validated', () => withApi(async call => {
  const res = await stats(call, '?from=nonsense', {user: 'ben'});
  assert.equal(res.status, 403);
}));

test('dates that are not YYYY-MM-DD calendar days are 422 on that field', () => withApi(async call => {
  for (const [query, field] of [
    ['?from=2026-2-1', 'from'], ['?from=yesterday', 'from'], ['?to=2026-02-30', 'to'],
    ['?to=2026-02-04T10:00:00Z', 'to'], ['?from=', 'from'], ['?from=2026-02-01&from=2026-02-02', 'from']
  ]) {
    const res = await stats(call, query);
    assert.equal(res.status, 422, query);
    assert.equal(res.body.error.code, 'validation_error', query);
    assert.deepEqual(Object.keys(res.body.error.fields), [field], query);
  }
}));

test('every bad bound is reported at once', () => withApi(async call => {
  const res = await stats(call, '?from=2026-13-01&to=soon');
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['from', 'to']);
}));

test('from after to is 422 on from', () => withApi(async call => {
  const res = await stats(call, '?from=2026-02-05&to=2026-02-01');
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(res.body.error.fields), ['from']);
}));

test('a range of more than 366 days is 422 on to; exactly 366 days is fine', () => withApi(async call => {
  const tooLong = await stats(call, '?from=2025-01-01&to=2026-01-02');
  assert.equal(tooLong.status, 422);
  assert.deepEqual(Object.keys(tooLong.body.error.fields), ['to']);
  const ok = await stats(call, '?from=2025-01-01&to=2026-01-01');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.daily.length, 366);
  assert.equal(ok.body.daily[365].date, '2026-01-01');
}));
