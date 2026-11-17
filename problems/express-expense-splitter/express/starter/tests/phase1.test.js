const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const GROUPS = [
  {
    id: 'grp_flat', name: 'Maple Street flat', currency: 'EUR', createdAt: '2026-01-10T09:00:00.000Z',
    members: [{id: 'mem_ana', name: 'Ana'}, {id: 'mem_ben', name: 'Ben'}, {id: 'mem_chen', name: 'Chen'}, {id: 'mem_dana', name: 'Dana'}]
  },
  {
    id: 'grp_trip', name: 'Lisbon trip', currency: 'USD', createdAt: '2026-02-01T18:30:00.000Z',
    members: [{id: 'mem_eli', name: 'Eli'}, {id: 'mem_fay', name: 'Fay'}, {id: 'mem_gus', name: 'Gus'}]
  }
];
const clock = () => new Date('2026-03-05T10:00:00.000Z');

// Starts a fresh app on a free port, runs fn(call), then stops it.
async function withApi(fn) {
  const store = createStore({groups: GROUPS, latencyMs: 0});
  const server = createApp({store, now: clock}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : {'content-type': 'application/json'},
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {status: res.status, headers: res.headers, body: json};
  };
  try {
    return await fn(call);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

const post = (call, groupId, body) => call('POST', `/api/groups/${groupId}/expenses`, body);
const equal = (payerId, amountCents, memberIds) => ({
  description: 'Test expense', payerId, amountCents, split: memberIds ? {type: 'equal', memberIds} : {type: 'equal'}
});
const cents = res => res.body.shares.map(s => s.cents);
const total = res => res.body.shares.reduce((sum, s) => sum + s.cents, 0);

test('recording an expense returns 201 Created with a Location header', () => withApi(async call => {
  const res = await post(call, 'grp_flat', equal('mem_ana', 1200));
  assert.equal(res.status, 201);
  assert.match(res.body.id, /^exp_\d{6}$/);
  assert.equal(res.headers.get('location'), `/api/groups/grp_flat/expenses/${res.body.id}`);
  assert.equal(res.body.currency, 'EUR');
  assert.equal(res.body.createdAt, '2026-03-05T10:00:00.000Z');
  assert.deepEqual(res.body.shares, [
    {memberId: 'mem_ana', cents: 300}, {memberId: 'mem_ben', cents: 300},
    {memberId: 'mem_chen', cents: 300}, {memberId: 'mem_dana', cents: 300}
  ]);
}));

test('an equal split that divides evenly is exact', () => withApi(async call => {
  const res = await post(call, 'grp_trip', equal('mem_eli', 9000));
  assert.deepEqual(cents(res), [3000, 3000, 3000]);
}));

test('an equal split of 100.00 three ways adds up to 100.00', () => withApi(async call => {
  const res = await post(call, 'grp_trip', equal('mem_eli', 10000));
  assert.equal(total(res), 10000);
  assert.deepEqual(cents(res), [3334, 3333, 3333]);
}));

test('leftover cents go to the first members by id, never more than one each', () => withApi(async call => {
  const two = await post(call, 'grp_trip', equal('mem_eli', 200));
  assert.equal(total(two), 200);
  assert.deepEqual(cents(two), [67, 67, 66]);
  const odd = await post(call, 'grp_flat', equal('mem_ana', 202, ['mem_ana', 'mem_ben', 'mem_chen']));
  assert.equal(total(odd), 202);
  assert.deepEqual(cents(odd), [68, 67, 67]);
  const five = await post(call, 'grp_flat', equal('mem_ben', 1003, ['mem_ana', 'mem_ben', 'mem_chen', 'mem_dana']));
  assert.deepEqual(cents(five), [251, 251, 251, 250]);
}));

test('an equal split among some members only charges those members', () => withApi(async call => {
  const res = await post(call, 'grp_flat', equal('mem_dana', 1001, ['mem_chen', 'mem_dana']));
  assert.deepEqual(res.body.shares, [{memberId: 'mem_chen', cents: 501}, {memberId: 'mem_dana', cents: 500}]);
}));

test('shares that do not divide evenly still add up to the amount', () => withApi(async call => {
  const res = await post(call, 'grp_flat', {description: 'Groceries', payerId: 'mem_ana', amountCents: 1000,
    split: {type: 'shares', shares: {mem_ana: 2, mem_ben: 3, mem_chen: 2}}});
  assert.equal(res.status, 201);
  assert.equal(total(res), 1000);
  assert.deepEqual(cents(res), [286, 428, 286]);
}));

test('shares that divide evenly are proportional', () => withApi(async call => {
  const res = await post(call, 'grp_trip', {description: 'Hotel', payerId: 'mem_fay', amountCents: 40000,
    split: {type: 'shares', shares: {mem_eli: 1, mem_fay: 1, mem_gus: 2}}});
  assert.deepEqual(cents(res), [10000, 10000, 20000]);
}));

test('an exact split is kept as given', () => withApi(async call => {
  const res = await post(call, 'grp_flat', {description: 'Dinner', payerId: 'mem_ben', amountCents: 5000,
    split: {type: 'exact', amounts: {mem_ana: 1999, mem_ben: 1500, mem_chen: 1501}}});
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.shares, [
    {memberId: 'mem_ana', cents: 1999}, {memberId: 'mem_ben', cents: 1500}, {memberId: 'mem_chen', cents: 1501}
  ]);
}));

test('exact amounts that add up to more than the bill are a 422', () => withApi(async call => {
  const res = await post(call, 'grp_flat', {description: 'Dinner', payerId: 'mem_ben', amountCents: 5000,
    split: {type: 'exact', amounts: {mem_ana: 3000, mem_ben: 3000}}});
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys(res.body.error.fields), ['split.amounts']);
}));

test('exact amounts that add up to less than the bill are a 422', () => withApi(async call => {
  const res = await post(call, 'grp_flat', {description: 'Dinner', payerId: 'mem_ben', amountCents: 10000,
    split: {type: 'exact', amounts: {mem_ana: 4000, mem_ben: 4000}}});
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.match(res.body.error.fields['split.amounts'], /10000/);
}));

test('a saved expense can be fetched and matches the response', () => withApi(async call => {
  const placed = await post(call, 'grp_trip', equal('mem_gus', 10000));
  const fetched = await call('GET', `/api/groups/grp_trip/expenses/${placed.body.id}`);
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body, placed.body);
  assert.equal((await call('GET', `/api/groups/grp_flat/expenses/${placed.body.id}`)).status, 404, 'not visible through another group');
}));

test('unknown groups, expenses and members are 404s', () => withApi(async call => {
  for (const res of [
    await call('GET', '/api/groups/grp_nowhere'),
    await post(call, 'grp_nowhere', equal('mem_ana', 100)),
    await call('GET', '/api/groups/grp_flat/expenses/exp_999999'),
    await post(call, 'grp_flat', equal('mem_zed', 100)),
    await post(call, 'grp_flat', equal('mem_ana', 100, ['mem_ana', 'mem_eli']))
  ]) {
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'not_found');
  }
}));

test('invalid expense bodies are 422 with every field listed', () => withApi(async call => {
  const res = await post(call, 'grp_flat', {description: '', payerId: 'ana', amountCents: 12.5, split: {type: 'pizza'}});
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['amountCents', 'description', 'payerId', 'split.type']);
}));

test('malformed JSON is a 400', () => withApi(async call => {
  const res = await call('POST', '/api/groups/grp_flat/expenses', '{"description": "Dinner", ');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'invalid_json');
}));

test('a new group can be created and read back', () => withApi(async call => {
  const res = await call('POST', '/api/groups', {name: 'Ski week', currency: 'GBP', members: [{id: 'mem_zoe', name: 'Zoe'}, {id: 'mem_abe', name: 'Abe'}]});
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('location'), `/api/groups/${res.body.id}`);
  assert.deepEqual(res.body.members.map(m => m.id), ['mem_abe', 'mem_zoe']);
  assert.deepEqual((await call('GET', `/api/groups/${res.body.id}`)).body, res.body);
}));
