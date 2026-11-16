// Tests for question kinds (ML, SQL, REST-client, build-an-API): question
// validation, languages and runtimes, and the judge's REST and API harnesses,
// run here with the local Node.js instead of Docker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadQuestions, getQuestion, publicQuestion, validateQuestion, languagesOf, kindOf, CODE_LANGUAGES} from '../coding.mjs';
import {runtimeFor, RUNTIME_IMAGES, REST_MARKER} from '../judge.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNNERS = path.join(ROOT, 'judge-runners');

function runHarness(harness, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(RUNNERS, harness), ...args], {windowsHide: true});
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', reject);
    child.on('close', code => resolve({code, stdout, stderr}));
    child.stdin.end(input);
  });
}
async function withTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gym-kinds-'));
  try { return await fn(dir); } finally { await fs.rm(dir, {recursive: true, force: true}); }
}

test('practice tests and interviews only see classic questions; the library sees every kind', async () => {
  const classic = await loadQuestions({fresh: true});
  const all = await loadQuestions({all: true});
  assert.ok(classic.every(q => kindOf(q) === 'algorithm' && CODE_LANGUAGES.every(l => languagesOf(q).includes(l))));
  const kinds = new Set(all.map(kindOf));
  for (const kind of ['algorithm', 'ml', 'sql', 'rest', 'api']) assert.ok(kinds.has(kind), `no ${kind} question`);
  assert.ok(all.length >= classic.length + 15);
  assert.equal((await getQuestion('sql-porto-orders')).kind, 'sql');
});

test('a question lists only its own languages, with its runtime in the environment panel', async () => {
  const sql = publicQuestion(await getQuestion('sql-region-leaders'));
  assert.deepEqual(sql.languages.map(l => l.id), ['sql']);
  assert.equal(sql.kind, 'sql');
  const ml = publicQuestion(await getQuestion('ml-roc-auc'));
  assert.deepEqual(ml.languages.map(l => l.id), ['python']);
  assert.match(ml.languages[0].version, /NumPy/);
  const api = publicQuestion(await getQuestion('api-task-board'));
  assert.deepEqual(api.languages.map(l => l.id), ['python', 'javascript']);
  assert.match(api.languages[0].version, /Flask/);
  assert.match(api.languages[1].version, /Express/);
  assert.ok(!('tests' in api) && !('images' in api));
});

test('question validation rejects kinds and languages that don\'t fit together', () => {
  const base = {id: 'x', title: 'X', summary: 's', statement: 's', functionDescription: 's', inputFormat: 's', constraints: 's', outputFormat: 's', difficulty: 'Easy', maxScore: 30, skills: ['SQL'],
    samples: [{input: '', output: ''}], tests: [{file: '00', sample: true}, ...['01', '02', '03', '04', '05'].map(file => ({file}))]};
  assert.deepEqual(validateQuestion({...base, kind: 'sql'}, 'x'), []);
  assert.ok(validateQuestion({...base, kind: 'sql', languages: ['python']}, 'x').some(e => e.includes('languages')));
  assert.ok(validateQuestion({...base, kind: 'quiz'}, 'x').some(e => e.includes('kind')));
  assert.ok(validateQuestion({...base, kind: 'api', languages: ['go']}, 'x').some(e => e.includes('languages')));
  assert.ok(validateQuestion({...base, kind: 'ml', images: {python: 'python-gpu'}}, 'x').some(e => e.includes('images')));
  assert.ok(validateQuestion({...base, kind: 'sql', ordered: 'no'}, 'x').some(e => e.includes('ordered')));
});

test('each kind runs in its own image with its own runner', () => {
  assert.equal(runtimeFor({language: 'python'}).image, 'python:3.12-slim');
  assert.equal(runtimeFor({kind: 'ml', language: 'python'}).image, RUNTIME_IMAGES['python-ml'].tag);
  assert.equal(runtimeFor({kind: 'api', language: 'javascript'}).image, RUNTIME_IMAGES['node-api'].tag);
  assert.match(runtimeFor({kind: 'api', language: 'python'}).run, /api_harness\.py python3 .*solution\.py$/);
  assert.match(runtimeFor({kind: 'rest', language: 'javascript'}).run, /^node \/runners\/rest_harness\.js node/);
  assert.match(runtimeFor({kind: 'sql', language: 'sql', ordered: false}).run, /sql_runner\.py \/code\/query\.sql --unordered$/);
  assert.throws(() => runtimeFor({kind: 'rest', language: 'java'}));
});

test('the REST harness paginates, filters and rate-limits like the statements say', () => withTemp(async dir => {
  const records = Array.from({length: 7}, (_, i) => ({id: i + 1, customer: i % 2 ? 'Ana Lima' : 'Rui', amount: 10 * (i + 1)}));
  const data = JSON.stringify({per_page: 2, throttle: 'first', resources: {orders: records}});
  const client = retry => `const base = process.env.API_BASE_URL; let input = ''; process.stdin.on('data', d => input += d); process.stdin.on('end', async () => {
    const name = input.trim(); let total = 0, statuses = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
      let response = await fetch(base + '/api/orders?' + new URLSearchParams({customer: name, page}));
      statuses.push(response.status);
      if (response.status === 429 && ${retry}) response = await fetch(base + '/api/orders?' + new URLSearchParams({page, customer: name}));
      const body = await response.json();
      if (!body.data) { console.log('failed', statuses.join(',')); return; }
      pages = body.total_pages; for (const order of body.data) total += order.amount;
    }
    console.log(name, total, statuses.join(','));
  });`;
  await fs.writeFile(path.join(dir, 'retry.js'), client(true));
  await fs.writeFile(path.join(dir, 'naive.js'), client(false));
  const input = `Ana Lima\n${REST_MARKER}\n${data}\n`;
  const good = await runHarness('rest_harness.js', [process.execPath, path.join(dir, 'retry.js')], input);
  assert.equal(good.code, 0, good.stderr);
  assert.equal(good.stdout.trim(), 'Ana Lima 120 429,429', 'the stdin holds only the lines before the marker; retries with reordered parameters count as the same URL');
  const naive = await runHarness('rest_harness.js', [process.execPath, path.join(dir, 'naive.js')], input);
  assert.equal(naive.stdout.trim(), 'failed 429');
}));

test('the API harness starts the app, replays requests and prints canonical responses', () => withTemp(async dir => {
  await fs.writeFile(path.join(dir, 'app.js'), `const http = require('http'); const items = [];
    http.createServer((req, res) => { let body = ''; req.on('data', d => body += d); req.on('end', () => {
      if (req.method === 'POST') { items.push(JSON.parse(body)); res.writeHead(201, {'Content-Type': 'application/json'}); return res.end(JSON.stringify({z: req.headers['x-key'] || null, id: items.length, a: 1})); }
      if (req.method === 'DELETE') { res.writeHead(204); return res.end(); }
      if (req.url === '/text') { res.writeHead(200); return res.end('plain words'); }
      console.log('app output goes to stderr'); res.writeHead(404, {'Content-Type': 'application/json'}); res.end('{"error": "missing"}');
    }); }).listen(Number(process.env.PORT), '127.0.0.1');`);
  const requests = [{method: 'POST', path: '/items', body: {name: 'x'}, headers: {'X-Key': 'k1'}}, {method: 'GET', path: '/items/9'}, {method: 'DELETE', path: '/items/1'}, {method: 'GET', path: '/text'}];
  const result = await runHarness('api_harness.js', [process.execPath, path.join(dir, 'app.js')], requests.map(r => JSON.stringify(r)).join('\n') + '\n');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, ['1. POST /items -> 201 {"a":1,"id":1,"z":"k1"}', '2. GET /items/9 -> 404 {"error":"missing"}', '3. DELETE /items/1 -> 204 -', '4. GET /text -> 200 "plain words"'].join('\n') + '\n');
  assert.match(result.stderr, /app output goes to stderr/);
}));

test('the API harness reports an app that never listens as a runtime error', () => withTemp(async dir => {
  await fs.writeFile(path.join(dir, 'crash.js'), 'throw new Error("boom");');
  const result = await runHarness('api_harness.js', [process.execPath, path.join(dir, 'crash.js')], '{"method": "GET", "path": "/"}\n');
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /exited before it accepted connections/);
  assert.equal(result.stdout, '');
}));

const python = ['python3', 'python'].find(cmd => spawnSync(cmd, ['-c', 'import sqlite3'], {windowsHide: true}).status === 0);
test('the SQL runner prints lower-case headers, tabs and NULLs, and sorts unordered results', {skip: !python && 'Python 3 is not installed'}, () => {
  const setup = "CREATE TABLE t (id INTEGER, name TEXT, score REAL);\nINSERT INTO t VALUES (2, 'b', 3.0), (1, NULL, 2.5);\n";
  const run = (query, ...flags) => withTemp(async dir => {
    await fs.writeFile(path.join(dir, 'query.sql'), query);
    return spawnSync(python, [path.join(RUNNERS, 'sql_runner.py'), path.join(dir, 'query.sql'), ...flags], {input: setup, encoding: 'utf8', windowsHide: true});
  });
  return (async () => {
    const ordered = await run('SELECT id AS ID, name, score FROM t ORDER BY id DESC;');
    assert.equal(ordered.stdout.replace(/\r/g, ''), 'id\tname\tscore\n2\tb\t3\n1\tNULL\t2.5\n');
    const unordered = await run('SELECT id FROM t ORDER BY id DESC', '--unordered');
    assert.equal(unordered.stdout.replace(/\r/g, ''), 'id\n1\n2\n');
    const broken = await run('SELECT nope FROM t');
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /OperationalError: no such column/);
  })();
});
