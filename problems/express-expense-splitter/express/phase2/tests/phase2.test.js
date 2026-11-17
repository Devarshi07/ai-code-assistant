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

const spend = async (call, groupId, payerId, amountCents, split) => {
  const res = await call('POST', `/api/groups/${groupId}/expenses`, {description: 'Test expense', payerId, amountCents, split});
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res;
};
const balancesOf = async (call, groupId) => Object.fromEntries((await call('GET', `/api/groups/${groupId}/balances`)).body.balances.map(b => [b.memberId, b.balanceCents]));
const transfersOf = async (call, groupId) => (await call('GET', `/api/groups/${groupId}/settle-up`)).body.transfers;
const sum = values => values.reduce((a, b) => a + b, 0);

// Ana paid 120.00 for everyone; Ben paid 100.00 for Ben and Chen.
// Net: Ana +9000, Ben +2000, Chen -8000, Dana -3000.
async function flatScenario(call) {
  await spend(call, 'grp_flat', 'mem_ana', 12000, {type: 'equal'});
  await spend(call, 'grp_flat', 'mem_ben', 10000, {type: 'equal', memberIds: ['mem_ben', 'mem_chen']});
}

test('a group with no expenses has a zero balance for every member', () => withApi(async call => {
  const res = await call('GET', '/api/groups/grp_trip/balances');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    groupId: 'grp_trip', currency: 'USD',
    balances: [
      {memberId: 'mem_eli', name: 'Eli', balanceCents: 0},
      {memberId: 'mem_fay', name: 'Fay', balanceCents: 0},
      {memberId: 'mem_gus', name: 'Gus', balanceCents: 0}
    ]
  });
}));

test('a balance is what the member paid minus what they owe', () => withApi(async call => {
  await flatScenario(call);
  const res = await call('GET', '/api/groups/grp_flat/balances');
  assert.deepEqual(res.body.balances.map(b => [b.memberId, b.balanceCents]), [
    ['mem_ana', 9000], ['mem_ben', 2000], ['mem_chen', -8000], ['mem_dana', -3000]
  ]);
}));

test('uneven splits still leave the group balances adding up to zero', () => withApi(async call => {
  await spend(call, 'grp_trip', 'mem_eli', 10000, {type: 'equal'});
  await spend(call, 'grp_trip', 'mem_fay', 3001, {type: 'shares', shares: {mem_eli: 1, mem_fay: 1, mem_gus: 1}});
  await spend(call, 'grp_trip', 'mem_gus', 777, {type: 'exact', amounts: {mem_eli: 300, mem_fay: 277, mem_gus: 200}});
  const balances = await balancesOf(call, 'grp_trip');
  assert.deepEqual(balances, {mem_eli: 5365, mem_fay: -1609, mem_gus: -3756});
  assert.equal(sum(Object.values(balances)), 0);
}));

test('groups keep separate books', () => withApi(async call => {
  await flatScenario(call);
  assert.deepEqual(Object.values(await balancesOf(call, 'grp_trip')), [0, 0, 0]);
}));

test('one member balance can be read on its own', () => withApi(async call => {
  await flatScenario(call);
  const res = await call('GET', '/api/groups/grp_flat/balances/mem_chen');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {groupId: 'grp_flat', currency: 'EUR', memberId: 'mem_chen', name: 'Chen', balanceCents: -8000});
}));

test('balances and settle-up for an unknown group or member are 404s', () => withApi(async call => {
  for (const path of [
    '/api/groups/grp_nowhere/balances', '/api/groups/grp_nowhere/balances/mem_ana', '/api/groups/grp_nowhere/settle-up',
    '/api/groups/grp_flat/balances/mem_eli', '/api/groups/grp_flat/balances/nobody'
  ]) {
    const res = await call('GET', path);
    assert.equal(res.status, 404, path);
    assert.equal(res.body.error.code, 'not_found');
  }
}));

test('settle-up pays the biggest debt to the biggest credit first', () => withApi(async call => {
  await flatScenario(call);
  const res = await call('GET', '/api/groups/grp_flat/settle-up');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    groupId: 'grp_flat', currency: 'EUR',
    transfers: [
      {fromId: 'mem_chen', toId: 'mem_ana', amountCents: 8000},
      {fromId: 'mem_dana', toId: 'mem_ben', amountCents: 2000},
      {fromId: 'mem_dana', toId: 'mem_ana', amountCents: 1000}
    ]
  });
}));

test('settle-up breaks ties between debtors by lowest member id', () => withApi(async call => {
  await spend(call, 'grp_trip', 'mem_eli', 9000, {type: 'equal'});
  assert.deepEqual(await transfersOf(call, 'grp_trip'), [
    {fromId: 'mem_fay', toId: 'mem_eli', amountCents: 3000},
    {fromId: 'mem_gus', toId: 'mem_eli', amountCents: 3000}
  ]);
}));

test('settle-up breaks ties between creditors by lowest member id', () => withApi(async call => {
  await spend(call, 'grp_flat', 'mem_ben', 4000, {type: 'exact', amounts: {mem_chen: 4000}});
  await spend(call, 'grp_flat', 'mem_ana', 4000, {type: 'exact', amounts: {mem_chen: 4000}});
  assert.deepEqual(await transfersOf(call, 'grp_flat'), [
    {fromId: 'mem_chen', toId: 'mem_ana', amountCents: 4000},
    {fromId: 'mem_chen', toId: 'mem_ben', amountCents: 4000}
  ]);
}));

test('a group that is already even has nothing to settle', () => withApi(async call => {
  assert.deepEqual(await transfersOf(call, 'grp_flat'), []);
  await spend(call, 'grp_flat', 'mem_ana', 600, {type: 'exact', amounts: {mem_ana: 600}});
  assert.deepEqual(await transfersOf(call, 'grp_flat'), []);
}));

test('recording a settlement returns 201 with a Location header', () => withApi(async call => {
  const res = await call('POST', '/api/groups/grp_trip/settlements', {fromId: 'mem_gus', toId: 'mem_eli', amountCents: 1500});
  assert.equal(res.status, 201);
  assert.match(res.body.id, /^set_\d{5}$/);
  assert.equal(res.headers.get('location'), `/api/groups/grp_trip/settlements/${res.body.id}`);
  assert.deepEqual(res.body, {
    id: res.body.id, groupId: 'grp_trip', fromId: 'mem_gus', toId: 'mem_eli', amountCents: 1500,
    currency: 'USD', createdAt: '2026-03-05T10:00:00.000Z'
  });
  const fetched = await call('GET', `/api/groups/grp_trip/settlements/${res.body.id}`);
  assert.deepEqual(fetched.body, res.body);
  assert.equal((await call('GET', `/api/groups/grp_flat/settlements/${res.body.id}`)).status, 404);
  assert.equal((await call('GET', '/api/groups/grp_trip/settlements/set_99999')).status, 404);
}));

test('a settlement moves money between the two balances only', () => withApi(async call => {
  await spend(call, 'grp_trip', 'mem_eli', 9000, {type: 'equal'});
  await call('POST', '/api/groups/grp_trip/settlements', {fromId: 'mem_gus', toId: 'mem_eli', amountCents: 1000});
  assert.deepEqual(await balancesOf(call, 'grp_trip'), {mem_eli: 5000, mem_fay: -3000, mem_gus: -2000});
  // Paying more than you owe is allowed: the balance just flips sign.
  await call('POST', '/api/groups/grp_trip/settlements', {fromId: 'mem_gus', toId: 'mem_eli', amountCents: 3000});
  assert.deepEqual(await balancesOf(call, 'grp_trip'), {mem_eli: 2000, mem_fay: -3000, mem_gus: 1000});
}));

test('paying the suggested transfers settles the group', () => withApi(async call => {
  await flatScenario(call);
  await spend(call, 'grp_flat', 'mem_dana', 1001, {type: 'equal', memberIds: ['mem_ana', 'mem_ben', 'mem_dana']});
  const transfers = await transfersOf(call, 'grp_flat');
  assert.ok(transfers.length >= 3);
  assert.equal(sum(transfers.map(t => t.amountCents)), sum(Object.values(await balancesOf(call, 'grp_flat')).filter(c => c > 0)));
  for (const t of transfers) assert.equal((await call('POST', '/api/groups/grp_flat/settlements', t)).status, 201);
  assert.deepEqual(Object.values(await balancesOf(call, 'grp_flat')), [0, 0, 0, 0]);
  assert.deepEqual(await transfersOf(call, 'grp_flat'), []);
}));

test('invalid settlements are 422 with every field listed', () => withApi(async call => {
  const bad = await call('POST', '/api/groups/grp_flat/settlements', {fromId: 'ana', toId: 'mem_ben', amountCents: 0});
  assert.equal(bad.status, 422);
  assert.equal(bad.body.error.code, 'validation_error');
  assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['amountCents', 'fromId']);
  const same = await call('POST', '/api/groups/grp_flat/settlements', {fromId: 'mem_ben', toId: 'mem_ben', amountCents: 500});
  assert.equal(same.status, 422);
  assert.deepEqual(Object.keys(same.body.error.fields), ['toId']);
  const fraction = await call('POST', '/api/groups/grp_flat/settlements', {fromId: 'mem_ana', toId: 'mem_ben', amountCents: 12.5});
  assert.deepEqual(Object.keys(fraction.body.error.fields), ['amountCents']);
  const notJson = await call('POST', '/api/groups/grp_flat/settlements', '[1, 2');
  assert.equal(notJson.status, 400);
}));

test('settlements naming an unknown group or member are 404s and change nothing', () => withApi(async call => {
  const noGroup = await call('POST', '/api/groups/grp_nowhere/settlements', {fromId: 'mem_ana', toId: 'mem_ben', amountCents: 500});
  assert.equal(noGroup.status, 404);
  const wrongGroup = await call('POST', '/api/groups/grp_flat/settlements', {fromId: 'mem_ana', toId: 'mem_eli', amountCents: 500});
  assert.equal(wrongGroup.status, 404);
  assert.equal(wrongGroup.body.error.code, 'not_found');
  assert.match(wrongGroup.body.error.message, /mem_eli/);
  assert.deepEqual(Object.values(await balancesOf(call, 'grp_flat')), [0, 0, 0, 0]);
}));
