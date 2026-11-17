// Starts the API on a free port, creates a link, follows it a few times, asks for
// its statistics, and stops. Run it with: node demo.js
const {createApp} = require('./src/app');

async function main() {
  // A fixed clock keeps the output the same on every run.
  const server = createApp({now: () => new Date('2026-02-20T12:00:00.000Z')}).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, {body, user, label} = {}) => {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {...(body ? {'content-type': 'application/json'} : {}), ...(user ? {'X-User-Id': user} : {})},
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    console.log(`${method} ${path} -> ${res.status}${label ? ` (${label})` : ''}`);
    return {status: res.status, headers: res.headers, body: json};
  };

  try {
    const created = await call('POST', '/api/links', {user: 'dana', body: {url: 'https://intranet.example.com/wiki/onboarding', alias: 'Onboarding'}});
    if (created.body && created.body.slug) console.log(`  short link /${created.body.slug} owned by ${created.body.owner}`);

    const clash = await call('POST', '/api/links', {user: 'ben', body: {url: 'https://example.com/other', alias: 'onboarding'}});
    if (clash.body && clash.body.error) console.log(`  second alias refused: ${clash.body.error.code}`);

    for (const path of ['/onboarding', '/ONBOARDING', '/handbook']) {
      const hop = await call('GET', path);
      console.log(`  redirects to ${hop.headers.get('location')}`);
    }

    const stats = await call('GET', '/api/links/handbook/stats', {user: 'ana'});
    if (stats.status === 200) {
      console.log(`  ${stats.body.slug}: ${stats.body.totalClicks} clicks between ${stats.body.from} and ${stats.body.to}`);
      const today = stats.body.daily[stats.body.daily.length - 1];
      console.log(`  today (${today.date}): ${today.clicks}`);
    } else {
      console.log(`  stats failed: ${JSON.stringify(stats.body)}`);
    }

    await call('GET', '/api/links/handbook/stats', {user: 'ben', label: 'not the owner'});
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
