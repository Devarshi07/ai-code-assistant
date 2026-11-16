// Starts the API on a free port, makes the calls a few different clients
// make, prints what comes back, and stops. Run it with: node demo.js
const {createApp} = require('./src/app');
const {tokens} = require('./src/store/seed');

const secret = id => tokens.find(t => t.id === id).secret;

async function main() {
  const server = createApp().listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (label, method, path, {token, body} = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {...(token ? {authorization: `Bearer ${secret(token)}`} : {}), ...(body ? {'content-type': 'application/json'} : {})},
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const detail = json && json.error ? `${json.error.code}: ${json.error.message}` : json && json.id ? `${json.id} "${json.title}"` : '';
    console.log(`${label.padEnd(22)} ${method.padEnd(6)} ${path.padEnd(24)} -> ${res.status} ${detail}`);
    return {status: res.status, body: json};
  };

  try {
    await call('load balancer', 'GET', '/health');
    await call('no token', 'GET', '/docs');
    await call('viewer (Vic)', 'GET', '/docs/doc_0001', {token: 'tok_vic'});
    await call('viewer (Vic)', 'POST', '/docs', {token: 'tok_vic', body: {title: 'Vic was here', body: ''}});
    const created = await call('editor (Eli)', 'POST', '/docs', {token: 'tok_eli', body: {title: 'Release notes 2.3', body: 'Draft.'}});
    if (created.body && created.body.id) await call('editor (Fay)', 'PATCH', `/docs/${created.body.id}`, {token: 'tok_fay', body: {body: 'Rewritten by Fay.'}});
    await call('admin (Ada)', 'DELETE', '/docs/doc_0002', {token: 'tok_ada'});
    const audit = await call('admin (Ada)', 'GET', '/admin/audit?limit=5', {token: 'tok_ada'});
    if (audit.body && Array.isArray(audit.body.data)) {
      for (const e of audit.body.data) console.log(`  audit ${e.id} ${e.outcome.padEnd(7)} ${String(e.actor).padEnd(8)} ${e.method} ${e.path} ${e.status}`);
    }
  } finally {
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
