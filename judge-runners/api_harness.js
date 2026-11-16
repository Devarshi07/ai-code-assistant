'use strict';
// Starts a candidate's web app and replays a test's requests against it.
// Same contract as api_harness.py: stdin holds one JSON request per line,
// argv is the command that starts the app (it gets PORT), and each request
// prints "<n>. <METHOD> <path> -> <status> <canonical JSON body>".
const http = require('http');
const net = require('net');
const {spawn} = require('child_process');

const START_MS = 8000;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function render(text) {
  text = text.trim();
  if (!text) return '-';
  try { return canonical(JSON.parse(text)); } catch { return JSON.stringify(text); }
}
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => { const {port} = probe.address(); probe.close(() => resolve(port)); });
});
// One connection per request, like the Python harness, and no redirects followed.
// (fetch keeps sockets alive, and exiting with them open can crash Node on Windows.)
const send = (port, method, path, headers, body) => new Promise(resolve => {
  const payload = body === undefined ? undefined : Buffer.from(body);
  const request = http.request({host: '127.0.0.1', port, method, path, agent: false, timeout: 5000,
    headers: {...headers, ...(payload ? {'Content-Length': payload.length} : {})}}, response => {
    let text = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { text += chunk; });
    response.on('end', () => resolve({status: response.statusCode, text}));
  });
  request.on('timeout', () => request.destroy(Object.assign(new Error('timed out'), {name: 'TimeoutError'})));
  request.on('error', error => resolve({error}));
  request.end(payload);
});
const canConnect = port => new Promise(resolve => {
  const socket = net.connect({port, host: '127.0.0.1'});
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});

async function main(input) {
  const requests = input.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  const port = await freePort();
  const [command, ...args] = process.argv.slice(2);
  const app = spawn(command, args, {env: {...process.env, PORT: String(port)}, stdio: ['ignore', 2, 2]});
  let exited = null;
  app.on('exit', code => { exited = code ?? 1; });
  // A monotonic clock: Docker's VM resyncs its wall clock, which can jump seconds.
  const deadline = performance.now() + START_MS;
  for (;;) {
    if (exited !== null) { console.error(`Your app exited before it accepted connections (exit code ${exited}).`); process.exit(1); }
    if (await canConnect(port)) break;
    if (performance.now() > deadline) { console.error(`Your app did not start listening on 127.0.0.1:${port} (the PORT variable) within ${START_MS / 1000} seconds.`); app.kill('SIGKILL'); process.exit(1); }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const lines = [];
  for (const [index, request] of requests.entries()) {
    const method = String(request.method || 'GET').toUpperCase();
    const hasBody = Object.prototype.hasOwnProperty.call(request, 'body');
    const headers = {...(hasBody ? {'Content-Type': 'application/json'} : {}), ...(request.headers || {})};
    const response = await send(port, method, request.path, headers, hasBody ? JSON.stringify(request.body) : undefined);
    lines.push(response.error
      ? `${index + 1}. ${method} ${request.path} -> no response (${response.error.name})`
      : `${index + 1}. ${method} ${request.path} -> ${response.status} ${render(response.text)}`);
  }
  process.stdout.write(lines.length ? lines.join('\n') + '\n' : '');
  app.kill('SIGKILL');
  process.exit(0);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => { main(raw).catch(error => { console.error(error.stack || String(error)); process.exit(2); }); });
