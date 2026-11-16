const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const USERS = [
  {id: 'usr_ada', name: 'Ada', role: 'admin'},
  {id: 'usr_eli', name: 'Eli', role: 'editor'},
  {id: 'usr_fay', name: 'Fay', role: 'editor'},
  {id: 'usr_vic', name: 'Vic', role: 'viewer'}
];
const TOKENS = [
  {id: 'tok_ada', userId: 'usr_ada', secret: 'test_admin_0001', revoked: false},
  {id: 'tok_eli', userId: 'usr_eli', secret: 'test_editor_0001', revoked: false},
  {id: 'tok_eli_ci', userId: 'usr_eli', secret: 'test_editor_ci_01', revoked: false},
  {id: 'tok_fay', userId: 'usr_fay', secret: 'test_editor_0002', revoked: false},
  {id: 'tok_vic', userId: 'usr_vic', secret: 'test_viewer_0001', revoked: false}
];
const DOCS = [
  {id: 'doc_0001', title: "Eli's notes", body: '', ownerId: 'usr_eli', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'},
  {id: 'doc_0002', title: "Fay's notes", body: '', ownerId: 'usr_fay', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z'}
];
const AS = {admin: 'test_admin_0001', eli: 'test_editor_0001', eliCi: 'test_editor_ci_01', fay: 'test_editor_0002', viewer: 'test_viewer_0001'};
const START = Date.parse('2026-05-04T12:00:00.000Z');

async function withApi(fn) {
  const store = createStore({users: USERS, tokens: TOKENS, docs: DOCS});
  const clock = {now: START};
  const server = createApp({store, clock: () => clock.now}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, {as, body, headers = {}} = {}) => {
    clock.now += 1000; // each request one second after the last
    const res = await fetch(base + path, {
      method,
      headers: {...(as ? {authorization: `Bearer ${AS[as]}`} : {}), ...(body ? {'content-type': 'application/json'} : {}), ...headers},
      body: body ? JSON.stringify(body) : undefined
    });
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

const audit = async (call, query = '') => {
  const res = await call('GET', `/admin/audit${query}`, {as: 'admin'});
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const brief = entries => entries.map(e => [e.actor, e.method, e.path, e.status, e.outcome]);

test('editors can only edit their own documents; admins can edit any', () => withApi(async (call, store) => {
  assert.equal((await call('PATCH', '/docs/doc_0001', {as: 'eli', body: {body: 'mine'}})).status, 200);
  const other = await call('PATCH', '/docs/doc_0002', {as: 'eli', body: {body: 'not mine'}});
  assert.equal(other.status, 403);
  assert.equal(other.body.error.code, 'forbidden');
  assert.equal(store.getDoc('doc_0002').body, '', 'the document is unchanged');
  assert.equal((await call('PATCH', '/docs/doc_0002', {as: 'fay', body: {body: 'mine too'}})).status, 200);
  assert.equal((await call('PATCH', '/docs/doc_0002', {as: 'admin', body: {title: 'Reviewed'}})).status, 200);
  assert.equal((await call('PATCH', '/docs/doc_0001', {as: 'viewer', body: {body: 'nope'}})).status, 403);
  const created = await call('POST', '/docs', {as: 'fay', body: {title: 'New', body: ''}});
  assert.equal((await call('PATCH', `/docs/${created.body.id}`, {as: 'fay', body: {body: 'ok'}})).status, 200);
  assert.equal((await call('PATCH', `/docs/${created.body.id}`, {as: 'eli', body: {body: 'no'}})).status, 403);
  assert.equal((await call('PATCH', '/docs/doc_7777', {as: 'eli', body: {body: 'x'}})).status, 404);
}));

test('the audit log records writes and refusals, newest first', () => withApi(async call => {
  await call('GET', '/docs', {as: 'viewer'});                                           // a read: not recorded
  await call('POST', '/docs', {as: 'viewer', body: {title: 'x', body: ''}});            // 403
  await call('POST', '/docs', {body: {title: 'x', body: ''}});                          // 401, no token
  await call('GET', '/docs', {headers: {authorization: 'Bearer forged_token_123'}});    // 401 on a read
  const created = await call('POST', '/docs', {as: 'eli', body: {title: 'Plan', body: ''}}); // 201
  await call('PATCH', `/docs/${created.body.id}?draft=1`, {as: 'eli', body: {body: 'v2'}});   // 200
  await call('POST', '/docs', {as: 'eli', body: {title: ''}});                          // 422
  await call('DELETE', '/docs/doc_0002', {as: 'eli'});                                  // 403
  await call('DELETE', '/docs/doc_0002', {as: 'admin'});                                // 204
  await call('GET', '/docs/doc_0001', {as: 'admin'});                                   // a read: not recorded

  const log = await audit(call);
  assert.equal(log.nextCursor, null);
  assert.deepEqual(brief(log.data), [
    ['usr_ada', 'DELETE', '/docs/doc_0002', 204, 'success'],
    ['usr_eli', 'DELETE', '/docs/doc_0002', 403, 'denied'],
    ['usr_eli', 'POST', '/docs', 422, 'failed'],
    ['usr_eli', 'PATCH', `/docs/${created.body.id}`, 200, 'success'],
    ['usr_eli', 'POST', '/docs', 201, 'success'],
    [null, 'GET', '/docs', 401, 'denied'],
    [null, 'POST', '/docs', 401, 'denied'],
    ['usr_vic', 'POST', '/docs', 403, 'denied']
  ]);
}));

test('audit entries have the documented fields', () => withApi(async call => {
  await call('POST', '/docs', {as: 'fay', body: {title: 'Timed', body: ''}});
  const [entry] = (await audit(call)).data;
  assert.deepEqual(Object.keys(entry).sort(), ['actor', 'at', 'id', 'method', 'outcome', 'path', 'role', 'status']);
  assert.match(entry.id, /^aud_\d{6}$/);
  assert.equal(entry.at, new Date(START + 1000).toISOString(), 'at is the time of the request, from the clock');
  assert.equal(entry.role, 'editor');
  const [refused] = (await call('POST', '/docs', {body: {}}), await audit(call)).data;
  assert.equal(refused.actor, null);
  assert.equal(refused.role, null);
}));

test('only admins can read the audit log, and refusals are logged', () => withApi(async call => {
  for (const as of ['viewer', 'eli', undefined]) {
    const res = await call('GET', '/admin/audit', {as});
    assert.equal(res.status, as ? 403 : 401, String(as));
  }
  const log = await audit(call);
  assert.deepEqual(brief(log.data), [
    [null, 'GET', '/admin/audit', 401, 'denied'],
    ['usr_eli', 'GET', '/admin/audit', 403, 'denied'],
    ['usr_vic', 'GET', '/admin/audit', 403, 'denied']
  ]);
}));

test('filtering by actor and outcome', () => withApi(async call => {
  await call('POST', '/docs', {as: 'eli', body: {title: 'A', body: ''}});
  await call('POST', '/docs', {as: 'fay', body: {title: 'B', body: ''}});
  await call('DELETE', '/docs/doc_0001', {as: 'fay'});
  await call('PATCH', '/docs/doc_0002', {as: 'eli', body: {body: 'x'}});
  await call('PATCH', '/docs/doc_0001', {as: 'eli', body: {body: 'y'}});
  assert.deepEqual(brief((await audit(call, '?actor=usr_eli')).data).map(e => e[3]), [200, 403, 201]);
  assert.deepEqual(brief((await audit(call, '?outcome=denied')).data).map(e => e[0]), ['usr_eli', 'usr_fay']);
  assert.deepEqual(brief((await audit(call, '?actor=usr_fay&outcome=success')).data), [['usr_fay', 'POST', '/docs', 201, 'success']]);
  assert.deepEqual((await audit(call, '?actor=usr_nobody')).data, []);
}));

test('the cursor pages through the whole log exactly once', () => withApi(async call => {
  for (let i = 0; i < 11; i++) await call('POST', '/docs', {as: i % 2 ? 'eli' : 'fay', body: {title: `Doc ${i}`, body: ''}});
  const everything = (await audit(call, '?limit=100')).data;
  assert.equal(everything.length, 11);
  const seen = [];
  let cursor = null, pages = 0;
  do {
    const page = await audit(call, `?limit=4${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    assert.ok(page.data.length <= 4);
    seen.push(...page.data);
    cursor = page.nextCursor;
    pages++;
  } while (cursor && pages < 10);
  assert.equal(pages, 3);
  assert.deepEqual(seen.map(e => e.id), everything.map(e => e.id));
  const filtered = await audit(call, '?actor=usr_eli&limit=2');
  const next = await audit(call, `?actor=usr_eli&limit=2&cursor=${encodeURIComponent(filtered.nextCursor)}`);
  assert.deepEqual([...filtered.data, ...next.data].map(e => e.path), Array(4).fill('/docs'));
  assert.ok([...filtered.data, ...next.data].every(e => e.actor === 'usr_eli'));
}));

test('new entries do not shift a page you are reading', () => withApi(async call => {
  for (let i = 0; i < 5; i++) await call('POST', '/docs', {as: 'eli', body: {title: `Doc ${i}`, body: ''}});
  const first = await audit(call, '?limit=2');
  await call('POST', '/docs', {as: 'fay', body: {title: 'Late', body: ''}});
  const second = await audit(call, `?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`);
  const ids = [...first.data, ...second.data].map(e => e.id);
  assert.equal(new Set(ids).size, 4, 'no entry appears twice');
  assert.ok(second.data.every(e => e.actor === 'usr_eli'));
}));

test('bad audit query parameters are a 422', () => withApi(async call => {
  const res = await call('GET', '/admin/audit?limit=0&outcome=maybe&cursor=garbage', {as: 'admin'});
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['cursor', 'limit', 'outcome']);
  for (const bad of ['limit=101', 'limit=2.5', 'limit=1&limit=2']) {
    assert.equal((await call('GET', `/admin/audit?${bad}`, {as: 'admin'})).status, 422, bad);
  }
}));

test('admins can revoke a token, which stops working at once', () => withApi(async call => {
  assert.equal((await call('GET', '/docs', {as: 'eliCi'})).status, 200);
  const revoked = await call('POST', '/admin/tokens/tok_eli_ci/revoke', {as: 'admin'});
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.id, 'tok_eli_ci');
  assert.equal(revoked.body.revoked, true);
  assert.equal(revoked.body.secret, undefined, 'the secret is never returned');
  const after = await call('GET', '/docs', {as: 'eliCi'});
  assert.equal(after.status, 401);
  assert.equal(after.body.error.code, 'invalid_token');
  assert.equal((await call('GET', '/docs', {as: 'eli'})).status, 200, "the user's other tokens still work");
  assert.equal((await call('POST', '/admin/tokens/tok_fay/revoke', {as: 'eli'})).status, 403);
  assert.equal((await call('POST', '/admin/tokens/tok_nope/revoke', {as: 'admin'})).status, 404);
  const [last] = (await audit(call)).data;
  assert.deepEqual(brief([last]), [['usr_ada', 'POST', '/admin/tokens/tok_nope/revoke', 404, 'failed']]);
}));
