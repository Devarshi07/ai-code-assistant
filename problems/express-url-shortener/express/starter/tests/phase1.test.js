const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const LINKS = [
  {slug: 'handbook', url: 'https://intranet.example.com/wiki/handbook', owner: 'ana', createdAt: '2026-02-01T09:00:00.000Z', expiresAt: null},
  {slug: 'Standup', url: 'https://meet.example.com/rooms/daily-standup', owner: 'ben', createdAt: '2026-02-10T08:30:00.000Z', expiresAt: null},
  {slug: 'promo-q1', url: 'https://intranet.example.com/campaigns/q1', owner: 'ana', createdAt: '2026-01-05T12:00:00.000Z', expiresAt: '2026-03-31T23:59:59.000Z'},
  {slug: 'aaaaaa', url: 'https://example.com/taken', owner: 'ben', createdAt: '2026-02-11T08:30:00.000Z', expiresAt: null}
];
const NOW = new Date('2026-04-02T10:00:00.000Z');

// Starts a fresh app on a free port, runs fn(call, store), then stops it.
// call(method, path, {body, user}) never follows redirects.
async function withApi(fn, {random} = {}) {
  const store = createStore({links: LINKS});
  const server = createApp({store, now: () => NOW, random}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, {body, user} = {}) => {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body === undefined ? {} : {'content-type': 'application/json'}),
        ...(user ? {'X-User-Id': user} : {})
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {status: res.status, headers: res.headers, body: json};
  };
  try {
    return await fn(call, store);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('creating a link with an alias returns 201 Created with a Location header', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'https://example.com/a/very/long/path', alias: 'Roadmap'}});
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, {
    slug: 'Roadmap',
    url: 'https://example.com/a/very/long/path',
    owner: 'cleo',
    createdAt: '2026-04-02T10:00:00.000Z',
    expiresAt: null
  });
  assert.equal(res.headers.get('location'), '/api/links/Roadmap');
}));

test('a link without an alias gets a generated 6 character slug', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'https://example.com/x'}});
  assert.equal(res.status, 201);
  assert.match(res.body.slug, /^[a-z2-9]{6}$/);
  assert.equal((await call('GET', `/api/links/${res.body.slug}`, {user: 'cleo'})).status, 200);
}));

test('a generated slug that is already taken is skipped', () => {
  // The first 6 draws spell "aaaaaa", which is taken; the next 6 do not.
  const draws = [...Array(6).fill(0), ...Array(6).fill(0.5)];
  let i = 0;
  return withApi(async call => {
    const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'https://example.com/x'}});
    assert.equal(res.status, 201);
    assert.notEqual(res.body.slug, 'aaaaaa');
    assert.equal((await call('GET', '/aaaaaa')).headers.get('location'), 'https://example.com/taken');
  }, {random: () => draws[i++ % draws.length]});
});

test('an alias that is already taken is a 409 and the first link is kept', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'https://example.com/other', alias: 'handbook'}});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'alias_taken');
  const kept = await call('GET', '/api/links/handbook', {user: 'cleo'});
  assert.equal(kept.body.owner, 'ana');
  assert.equal(kept.body.url, 'https://intranet.example.com/wiki/handbook');
}));

test('an alias that differs only in letter case is also a 409 and the first link is kept', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'https://evil.example.com/phish', alias: 'HANDBOOK'}});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'alias_taken');
  const kept = await call('GET', '/api/links/handbook', {user: 'cleo'});
  assert.equal(kept.body.owner, 'ana');
  assert.equal(kept.body.url, 'https://intranet.example.com/wiki/handbook');
  const followed = await call('GET', '/handbook');
  assert.equal(followed.headers.get('location'), 'https://intranet.example.com/wiki/handbook');
}));

test('a lower-case request for a mixed-case alias is a 409 too', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'https://example.com/other', alias: 'standup'}});
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'alias_taken');
  assert.equal((await call('GET', '/Standup')).headers.get('location'), 'https://meet.example.com/rooms/daily-standup');
}));

test('following a short link is a 302 to the target', () => withApi(async call => {
  const res = await call('GET', '/handbook');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://intranet.example.com/wiki/handbook');
}));

test('slugs are matched ignoring letter case when following a link', () => withApi(async call => {
  const res = await call('GET', '/STANDUP');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://meet.example.com/rooms/daily-standup');
}));

test('every followed link is counted as one click', () => withApi(async (call, store) => {
  await call('GET', '/handbook');
  await call('GET', '/HandBook');
  assert.deepEqual(await store.listClicks('handbook'), [NOW.getTime(), NOW.getTime()]);
}));

test('an unknown slug is a 404 with the error body', () => withApi(async call => {
  const res = await call('GET', '/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
  assert.match(res.body.error.message, /nope/);
}));

test('an expired link is a 410 and its click is not counted', () => withApi(async (call, store) => {
  const res = await call('GET', '/promo-q1');
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'link_expired');
  assert.deepEqual(await store.listClicks('promo-q1'), []);
}));

test('the API needs an X-User-Id header', () => withApi(async call => {
  const res = await call('GET', '/api/links');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'unauthorized');
}));

test('a user lists only their own links, newest first', () => withApi(async call => {
  const res = await call('GET', '/api/links', {user: 'ana'});
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.links.map(l => l.slug), ['handbook', 'promo-q1']);
}));

test('invalid link bodies are 422 with every field listed', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: {url: 'ftp://example.com/x', alias: 'a b', expiresAt: '2026-01-01T00:00:00Z'}});
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['alias', 'expiresAt', 'url']);
}));

test('malformed JSON is a 400', () => withApi(async call => {
  const res = await call('POST', '/api/links', {user: 'cleo', body: '{"url": '});
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'invalid_json');
}));
