'use strict';
// Serves a paginated JSON API on 127.0.0.1 and runs a REST-client program
// against it. Same contract as rest_harness.py: stdin holds the program's own
// input, a line '--- api data ---', then the API's data as JSON; argv is the
// command that runs the candidate's program, which gets API_BASE_URL.
const http = require('http');
const {spawn} = require('child_process');

const MARKER = '--- api data ---';
const token = value => value === true ? 'true' : value === false ? 'false' : value === null || value === undefined ? 'null' : String(value);

function splitInput(raw) {
  const lines = raw.split('\n');
  const cut = lines.indexOf(MARKER);
  if (cut < 0) return {own: raw, fixture: {}};
  let own = lines.slice(0, cut).join('\n');
  if (own && !own.endsWith('\n')) own += '\n';
  const data = lines.slice(cut + 1).join('\n').trim();
  return {own, fixture: data ? JSON.parse(data) : {}};
}

function handler(fixture) {
  const resources = fixture.resources || {};
  const perPage = Number(fixture.per_page || 10);
  const seen = new Set();
  return (req, res) => {
    const send = (status, body, headers = {}) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers});
      res.end(payload);
    };
    if (req.method !== 'GET') return send(405, {error: 'method not allowed'});
    const url = new URL(req.url, 'http://127.0.0.1');
    const parts = url.pathname.split('/').filter(Boolean);
    const records = parts.length === 2 && parts[0] === 'api' ? resources[parts[1]] : undefined;
    if (!Array.isArray(records)) return send(404, {error: 'not found'});
    const params = [...url.searchParams.entries()];
    if (fixture.throttle === 'first') {
      const key = `${parts[1]}?${params.map(([k, v]) => `${k}=${v}`).sort().join('&')}`;
      if (!seen.has(key)) { seen.add(key); return send(429, {error: 'rate limit exceeded, retry after 0 seconds'}, {'Retry-After': '0'}); }
    }
    const pageText = (params.find(([k]) => k === 'page') || [null, '1'])[1];
    if (!/^\d+$/.test(pageText) || Number(pageText) < 1) return send(400, {error: 'page must be a positive integer'});
    const page = Number(pageText);
    const filters = params.filter(([k]) => k !== 'page' && k !== 'per_page');
    const matching = records.filter(record => filters.every(([k, v]) => token(record[k]) === v));
    send(200, {page, per_page: perPage, total: matching.length, total_pages: Math.ceil(matching.length / perPage), data: matching.slice((page - 1) * perPage, page * perPage)});
  };
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  const {own, fixture} = splitInput(raw);
  const server = http.createServer(handler(fixture));
  server.listen(0, '127.0.0.1', () => {
    const [command, ...args] = process.argv.slice(2);
    const child = spawn(command, args, {env: {...process.env, API_BASE_URL: `http://127.0.0.1:${server.address().port}`}, stdio: ['pipe', 'inherit', 'inherit']});
    child.stdin.on('error', () => {});
    child.stdin.end(own);
    child.on('close', code => { server.close(); process.exit(code === null ? 1 : code); });
  });
});
