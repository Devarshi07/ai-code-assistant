// Starts the API on a free port, posts a few expenses to the sample "Maple
// Street flat" group, prints what comes back, and stops. Run: node demo.js
const {createApp} = require('./src/app');

const money = cents => (typeof cents === 'number' ? `${cents < 0 ? '-' : ''}${(Math.abs(cents) / 100).toFixed(2)}` : String(cents));

async function main() {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? {'content-type': 'application/json'} : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`${method} ${path} -> ${res.status}`);
    return {status: res.status, body: json};
  };

  try {
    const flat = '/api/groups/grp_flat';
    const bill = await call('POST', `${flat}/expenses`, {
      description: 'Electricity', payerId: 'mem_ben', amountCents: 10000, split: {type: 'equal', memberIds: ['mem_ana', 'mem_ben', 'mem_chen']}
    });
    if (bill.status === 201) {
      const e = bill.body;
      console.log(`  ${e.id}: ${e.description}, ${money(e.amountCents)} paid by ${e.payerId}`);
      console.log(`  shares: ${e.shares.map(s => `${s.memberId.slice(4)} ${money(s.cents)}`).join(', ')}`);
      console.log(`  they add up to ${money(e.shares.reduce((sum, s) => sum + s.cents, 0))}`);
    } else {
      console.log('  ', JSON.stringify(bill.body));
    }

    const balances = await call('GET', `${flat}/balances`);
    if (balances.status === 200) {
      for (const b of balances.body.balances) console.log(`  ${b.name}: ${money(b.balanceCents)} ${balances.body.currency}`);
    } else {
      console.log('  ', JSON.stringify(balances.body));
    }

    const plan = await call('GET', `${flat}/settle-up`);
    if (plan.status === 200) {
      for (const t of plan.body.transfers) console.log(`  ${t.fromId.slice(4)} pays ${t.toId.slice(4)} ${money(t.amountCents)}`);
    } else {
      console.log('  ', JSON.stringify(plan.body));
    }

    const missing = await call('GET', '/api/groups/grp_nowhere');
    console.log('  ', JSON.stringify(missing.body));
  } finally {
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
