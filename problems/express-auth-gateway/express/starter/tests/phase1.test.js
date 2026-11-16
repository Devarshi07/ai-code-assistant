const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const USERS = [
  {id: 'usr_ada', name: 'Ada', role: 'admin'},
  {id: 'usr_eli', name: 'Eli', role: 'editor'},
  {id: 'usr_vic', name: 'Vic', role: 'viewer'}
];
const TOKENS = [
  {id: 'tok_ada', userId: 'usr_ada', secret: 'test_admin_0001', revoked: false},
  {id: 'tok_eli', userId: 'usr_eli', secret: 'test_editor_0001', revoked: false},
  {id: 'tok_vic', userId: 'usr_vic', secret: 'test_viewer_0001', revoked: false},
  {id: 'tok_old', userId: 'usr_eli', secret: 'test_revoked_0001', revoked: true}
];
const DOCS = [
  {id: 'doc_0001', title: 'Style guide', body: 'Use sentence case.', ownerId: 'usr_eli', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'}
];
const AS = {admin: 'test_admin_0001', editor: 'test_editor_0001', viewer: 'test_viewer_0001', revoked: 'test_revoked_0001'};
const NOW = Date.parse('2026-05-04T12:00:00.000Z');

async function withApi(fn) {
  const store = createStore({users: USERS, tokens: TOKENS, docs: DOCS});
  const server = createApp({store, clock: () => NOW}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, {as, body, headers = {}} = {}) => {
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
    return await fn(call, store);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('the health check needs no token', () => withApi(async call => {
  const res = await call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {status: 'ok'});
}));

test('no token is a 401 with a WWW-Authenticate challenge', () => withApi(async call => {
  const res = await call('GET', '/docs');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'unauthenticated');
  assert.equal(res.headers.get('www-authenticate'), 'Bearer realm="inkwell"');
}));

test('unknown, malformed and revoked tokens are 401 invalid_token', () => withApi(async call => {
  for (const authorization of ['Bearer not_a_real_token', 'Basic dXNlcjpwYXNz', 'Bearer', `Bearer ${AS.revoked}`]) {
    const res = await call('GET', '/docs', {headers: {authorization}});
    assert.equal(res.status, 401, authorization);
    assert.equal(res.body.error.code, 'invalid_token', authorization);
    assert.match(res.headers.get('www-authenticate'), /error="invalid_token"/);
  }
}));

test('every role can read documents', () => withApi(async call => {
  for (const as of ['viewer', 'editor', 'admin']) {
    const list = await call('GET', '/docs', {as});
    assert.equal(list.status, 200, `${as} lists docs`);
    assert.deepEqual(list.body.data.map(d => d.id), ['doc_0001']);
    const one = await call('GET', '/docs/doc_0001', {as});
    assert.equal(one.status, 200, `${as} reads a doc`);
  }
}));

test('a viewer cannot create, edit or delete', () => withApi(async (call, store) => {
  const create = await call('POST', '/docs', {as: 'viewer', body: {title: 'Mine now', body: ''}});
  assert.equal(create.status, 403);
  assert.equal(create.body.error.code, 'forbidden');
  const edit = await call('PATCH', '/docs/doc_0001', {as: 'viewer', body: {title: 'Defaced'}});
  assert.equal(edit.status, 403);
  const remove = await call('DELETE', '/docs/doc_0001', {as: 'viewer'});
  assert.equal(remove.status, 403);
  assert.equal(store.getDoc('doc_0001').title, 'Style guide', 'nothing changed');
  assert.equal(store.listDocs().length, 1);
}));

test('an editor can create and edit', () => withApi(async call => {
  const created = await call('POST', '/docs', {as: 'editor', body: {title: '  Release notes  ', body: 'Draft'}});
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('location'), `/docs/${created.body.id}`);
  assert.equal(created.body.title, 'Release notes');
  assert.equal(created.body.ownerId, 'usr_eli');
  assert.equal(created.body.createdAt, new Date(NOW).toISOString());
  const edited = await call('PATCH', '/docs/doc_0001', {as: 'editor', body: {body: 'Use sentence case. No exclamation marks.'}});
  assert.equal(edited.status, 200);
  assert.equal(edited.body.title, 'Style guide');
  assert.equal(edited.body.body, 'Use sentence case. No exclamation marks.');
}));

test('an editor cannot delete', () => withApi(async (call, store) => {
  const res = await call('DELETE', '/docs/doc_0001', {as: 'editor'});
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'forbidden');
  assert.ok(store.getDoc('doc_0001'));
}));

test('an admin can do everything an editor can, and delete', () => withApi(async (call, store) => {
  const created = await call('POST', '/docs', {as: 'admin', body: {title: 'Security policy', body: 'Rotate tokens yearly.'}});
  assert.equal(created.status, 201);
  const edited = await call('PATCH', `/docs/${created.body.id}`, {as: 'admin', body: {title: 'Security policy v2'}});
  assert.equal(edited.status, 200);
  const removed = await call('DELETE', '/docs/doc_0001', {as: 'admin'});
  assert.equal(removed.status, 204);
  assert.equal(store.getDoc('doc_0001'), null);
}));

test('validation and not-found errors keep their shapes', () => withApi(async call => {
  const bad = await call('POST', '/docs', {as: 'editor', body: {title: '', body: 42}});
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['body', 'title']);
  const missing = await call('GET', '/docs/doc_9999', {as: 'viewer'});
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'not_found');
}));

test('authenticated responses carry rate limit headers', () => withApi(async call => {
  const res = await call('GET', '/docs', {as: 'viewer'});
  assert.equal(res.headers.get('x-ratelimit-limit'), '600');
  assert.ok(Number(res.headers.get('x-ratelimit-remaining')) < 600);
}));
