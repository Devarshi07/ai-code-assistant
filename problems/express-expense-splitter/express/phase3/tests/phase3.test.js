const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/app');
const {createStore} = require('../src/store/memory-store');

const MEMBER_IDS = Array.from({length: 12}, (_, i) => `mem_m${String(i + 1).padStart(2, '0')}`);
const BIG = {
  id: 'grp_big', name: 'Everyone, since 2019', currency: 'EUR', createdAt: '2019-01-01T00:00:00.000Z',
  members: MEMBER_IDS.map((id, i) => ({id, name: `Member ${i + 1}`}))
};
const SMALL = {
  id: 'grp_small', name: 'Weekend away', currency: 'USD', createdAt: '2026-02-01T18:30:00.000Z',
  members: [{id: 'mem_eli', name: 'Eli'}, {id: 'mem_fay', name: 'Fay'}, {id: 'mem_gus', name: 'Gus'}]
};

// A small seeded generator so every run builds the same history.
function lcg(seed) {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const equalShares = (amountCents, memberIds) => {
  const base = Math.floor(amountCents / memberIds.length);
  const extra = amountCents % memberIds.length;
  return memberIds.map((memberId, i) => ({memberId, cents: base + (i < extra ? 1 : 0)}));
};

// 150,000 equal-split expenses in grp_big, built the way the database would
// hold them, plus the balances they add up to.
const EXPENSE_COUNT = 150000;
function bigHistory() {
  const next = lcg(20260305);
  const expenses = [];
  const expected = Object.fromEntries(MEMBER_IDS.map(id => [id, 0]));
  for (let i = 1; i <= EXPENSE_COUNT; i++) {
    const size = 2 + Math.floor(next() * 11);
    const start = Math.floor(next() * (MEMBER_IDS.length - size + 1));
    const participants = MEMBER_IDS.slice(start, start + size);
    const payerId = MEMBER_IDS[Math.floor(next() * MEMBER_IDS.length)];
    const amountCents = 100 + Math.floor(next() * 30000);
    const shares = equalShares(amountCents, participants);
    expenses.push({
      id: `exp_${String(i).padStart(6, '0')}`, groupId: 'grp_big', description: `Expense ${i}`, payerId, amountCents,
      currency: 'EUR', split: {type: 'equal', memberIds: participants}, shares, createdAt: '2025-06-01T12:00:00.000Z'
    });
    expected[payerId] += amountCents;
    for (const share of shares) expected[share.memberId] -= share.cents;
  }
  return {expenses, expected};
}

async function withApi(storeOptions, fn) {
  const store = createStore({latencyMs: 0, ...storeOptions});
  const server = createApp({store, now: () => new Date('2026-03-05T10:00:00.000Z')}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : {'content-type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body)
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

const sum = values => values.reduce((a, b) => a + b, 0);
const balancesOf = async (call, groupId) => {
  const res = await call('GET', `/api/groups/${groupId}/balances`);
  assert.equal(res.status, 200);
  return Object.fromEntries(res.body.balances.map(b => [b.memberId, b.balanceCents]));
};
const spend = (call, groupId, payerId, amountCents, split) =>
  call('POST', `/api/groups/${groupId}/expenses`, {description: 'Test expense', payerId, amountCents, split});

// The documented greedy rule, written out independently of the service.
function referenceTransfers(balances) {
  const debt = new Map(), credit = new Map();
  for (const [id, cents] of Object.entries(balances)) (cents < 0 ? debt : credit).set(id, Math.abs(cents));
  for (const map of [debt, credit]) for (const [id, cents] of map) if (cents === 0) map.delete(id);
  const biggest = map => [...map].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  const transfers = [];
  while (debt.size && credit.size) {
    const [fromId, owed] = biggest(debt);
    const [toId, due] = biggest(credit);
    const amountCents = Math.min(owed, due);
    transfers.push({fromId, toId, amountCents});
    owed === amountCents ? debt.delete(fromId) : debt.set(fromId, owed - amountCents);
    due === amountCents ? credit.delete(toId) : credit.set(toId, due - amountCents);
  }
  return transfers;
}

const HISTORY = bigHistory();
const bigStoreOptions = () => ({groups: [BIG, SMALL], expenses: HISTORY.expenses});

test('balances for a group with 150,000 expenses are exact', () => withApi(bigStoreOptions(), async call => {
  assert.deepEqual(await balancesOf(call, 'grp_big'), HISTORY.expected);
  assert.equal(sum(Object.values(HISTORY.expected)), 0);
  assert.deepEqual(Object.values(await balancesOf(call, 'grp_small')), [0, 0, 0], 'other groups are not affected');
  const res = await call('GET', '/api/groups/grp_big/settle-up');
  assert.deepEqual(res.body.transfers, referenceTransfers(HISTORY.expected));
  assert.ok(res.body.transfers.length >= 1 && res.body.transfers.length < MEMBER_IDS.length);
}));

test('reading balances stays fast while new expenses keep arriving', () => withApi(bigStoreOptions(), async call => {
  await call('GET', '/api/groups/grp_big/balances'); // warm-up: not timed
  const next = lcg(99);
  const expected = {...HISTORY.expected};
  const ROUNDS = 25;
  const LIMIT_SECONDS = 1.5;
  const started = performance.now();
  let rounds = 0;
  for (; rounds < ROUNDS; rounds++) {
    if (performance.now() - started > LIMIT_SECONDS * 1000) break; // already too slow: stop early
    const payerId = MEMBER_IDS[Math.floor(next() * MEMBER_IDS.length)];
    const amountCents = 1000 + Math.floor(next() * 9000);
    const posted = await spend(call, 'grp_big', payerId, amountCents, {type: 'equal'});
    assert.equal(posted.status, 201);
    expected[payerId] += amountCents;
    for (const share of posted.body.shares) expected[share.memberId] -= share.cents;
    // The app shows the balances, some members' balances and the plan together.
    const [balances] = await Promise.all([
      call('GET', '/api/groups/grp_big/balances'),
      call('GET', `/api/groups/grp_big/balances/${MEMBER_IDS[rounds % MEMBER_IDS.length]}`),
      call('GET', `/api/groups/grp_big/balances/${MEMBER_IDS[(rounds * 5 + 3) % MEMBER_IDS.length]}`),
      call('GET', '/api/groups/grp_big/settle-up'),
      call('GET', `/api/groups/grp_big/balances/${MEMBER_IDS[(rounds * 7 + 1) % MEMBER_IDS.length]}`),
      call('GET', '/api/groups/grp_big/settle-up')
    ]);
    assert.equal(sum(balances.body.balances.map(b => b.balanceCents)), 0);
  }
  const elapsed = (performance.now() - started) / 1000;
  assert.ok(elapsed < LIMIT_SECONDS, `${ROUNDS} rounds of post + read took ${elapsed.toFixed(2)}s (stopped after ${rounds} rounds); must be under ${LIMIT_SECONDS}s`);
  assert.deepEqual(await balancesOf(call, 'grp_big'), expected);
}));

test('settlements on a big group move the balances by exactly their amount', () => withApi(bigStoreOptions(), async call => {
  const [first, second] = MEMBER_IDS;
  const res = await call('POST', '/api/groups/grp_big/settlements', {fromId: first, toId: second, amountCents: 12345});
  assert.equal(res.status, 201);
  const expected = {...HISTORY.expected, [first]: HISTORY.expected[first] + 12345, [second]: HISTORY.expected[second] - 12345};
  assert.deepEqual(await balancesOf(call, 'grp_big'), expected);
  assert.deepEqual((await call('GET', '/api/groups/grp_big/settle-up')).body.transfers, referenceTransfers(expected));
}));

test('a group created through the API has its own books from the first expense', () => withApi(bigStoreOptions(), async call => {
  const created = await call('POST', '/api/groups', {name: 'Ski week', currency: 'GBP', members: [{id: 'mem_abe', name: 'Abe'}, {id: 'mem_zoe', name: 'Zoe'}]});
  const path = `/api/groups/${created.body.id}`;
  assert.deepEqual((await call('GET', `${path}/balances`)).body.balances.map(b => b.balanceCents), [0, 0]);
  assert.equal((await spend(call, created.body.id, 'mem_zoe', 1001, {type: 'equal'})).status, 201);
  assert.deepEqual((await call('GET', `${path}/balances`)).body.balances.map(b => [b.memberId, b.balanceCents]), [['mem_abe', -501], ['mem_zoe', 501]]);
  assert.deepEqual((await call('GET', `${path}/settle-up`)).body.transfers, [{fromId: 'mem_abe', toId: 'mem_zoe', amountCents: 501}]);
}));

test('concurrent expenses and settlements never lose an update', () => withApi({groups: [SMALL], latencyMs: 4}, async call => {
  const members = ['mem_eli', 'mem_fay', 'mem_gus'];
  const next = lcg(5);
  const expected = {mem_eli: 0, mem_fay: 0, mem_gus: 0};
  const writes = [], reads = [];
  for (let i = 0; i < 90; i++) {
    const a = members[Math.floor(next() * 3)];
    const b = members[Math.floor(next() * 3)];
    const amountCents = 1 + Math.floor(next() * 5000);
    if (i % 3 === 2 && a !== b) {
      writes.push(call('POST', '/api/groups/grp_small/settlements', {fromId: a, toId: b, amountCents}).then(res => {
        assert.equal(res.status, 201);
        expected[a] += amountCents;
        expected[b] -= amountCents;
      }));
    } else {
      const split = i % 2 ? {type: 'equal'} : {type: 'shares', shares: {mem_eli: 1, mem_fay: 2, mem_gus: 3}};
      writes.push(spend(call, 'grp_small', a, amountCents, split).then(res => {
        assert.equal(res.status, 201);
        expected[a] += amountCents;
        for (const share of res.body.shares) expected[share.memberId] -= share.cents;
      }));
    }
    if (i % 5 === 0) reads.push(call('GET', '/api/groups/grp_small/balances'));
  }
  await Promise.all(writes);
  for (const res of await Promise.all(reads)) {
    assert.equal(sum(res.body.balances.map(b => b.balanceCents)), 0, 'a balance read in the middle of the writes must still add up to zero');
  }
  assert.deepEqual(await balancesOf(call, 'grp_small'), expected);
  assert.equal(sum(Object.values(expected)), 0);
}));
