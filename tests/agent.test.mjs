// Tests for the repo agent's safety rails, driving the real agent loop against
// a scripted stand-in for Ollama: edits need a read first, a missed edit points
// at the closest lines, edits get a syntax check, and Undo reverts one edit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {assistantRoutes} from '../assistant.mjs';
import {workspaceApi} from '../workspace-api.mjs';
import {challenges} from '../challenges.mjs';
import {checkSyntax} from '../syntax-check.mjs';

async function fixture() {
  const SESSIONS = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-agent-'));
  const id = '00000000-0000-4000-8000-000000000002';
  const dir = path.join(SESSIONS, id), repo = path.join(dir, 'repo');
  const challenge = challenges.find(c => c.id === 'python-cart');
  await fs.mkdir(repo, {recursive: true});
  for (const [name, text] of Object.entries(challenge.files)) await fs.writeFile(path.join(repo, name), text);
  await fs.writeFile(path.join(dir, 'session.json'), JSON.stringify({id, title: challenge.title, brief: challenge.brief, challenge: challenge.id, runtime: 'python', started: Date.now()}));
  const listFiles = async root => (await fs.readdir(root, {recursive: true, withFileTypes: true})).filter(e => e.isFile()).map(e => path.relative(root, path.join(e.parentPath ?? e.path, e.name)).replace(/\\/g, '/')).sort();
  const repoSession = async sid => ({dir: path.join(SESSIONS, sid), repo: path.join(SESSIONS, sid, 'repo'), meta: JSON.parse(await fs.readFile(path.join(SESSIONS, sid, 'session.json'), 'utf8'))});
  const workspace = workspaceApi({SESSIONS, run: async () => ({code: 1, output: ''}), listFiles, repoSession, runRepo: async () => ({}), job: fn => fn(() => {})});
  return {SESSIONS, id, dir, workspace, challenge};
}

// A stand-in for Ollama that answers /api/chat with the next scripted reply.
async function fakeOllama(replies) {
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    const reply = replies.shift() || {content: 'Done.'};
    res.writeHead(200, {'Content-Type': 'application/x-ndjson'});
    res.write(JSON.stringify({message: {role: 'assistant', content: reply.content || '', ...(reply.calls ? {tool_calls: reply.calls.map(([name, args]) => ({function: {name, arguments: args}}))} : {})}, done: false}) + '\n');
    res.end(JSON.stringify({done: true, prompt_eval_count: 10, eval_count: 5}) + '\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve))};
}
const fakeResponse = () => { const lines = []; return {lines, writeHead() {}, write(chunk) { lines.push(...String(chunk).split('\n').filter(Boolean).map(l => JSON.parse(l))); }, end() { this.writableEnded = true; }, on() {}, writableEnded: false, writableFinished: false}; };
const MODELS = async () => ({models: [{name: 'fake', tools: true, parameterSize: '8B', thinking: false}], assistant: 'fake'});

test('the agent must read a file before editing it, and a missed edit shows the closest lines', async () => {
  const {SESSIONS, id, dir, workspace, challenge} = await fixture();
  const original = challenge.files['pricing.py'];
  const line = original.split('\n').find(l => l.trim().length > 12);
  const ollama = await fakeOllama([
    {calls: [['edit_file', {path: 'pricing.py', old_text: line, new_text: line + '  # changed'}]]},
    {calls: [['read_file', {path: 'pricing.py'}]]},
    {calls: [['edit_file', {path: 'pricing.py', old_text: line.replace(/\w/, 'Q'), new_text: 'x = 1'}]]},
    {content: 'I could not apply that edit.'}
  ]);
  try {
    const assistant = assistantRoutes({SESSIONS, OLLAMA: ollama.url, models: MODELS, workspace});
    const res = fakeResponse();
    await assistant.stream({}, res, {scope: 'ws', kind: 'repo', id, mode: 'agent', message: 'Tweak pricing.py'}, 'send');
    const done = res.lines.find(e => e.type === 'done');
    assert.ok(done, 'the turn finishes');
    const tools = done.chat.items.filter(i => i.type === 'tool');
    assert.equal(tools[0].status, 'error');
    assert.match(tools[0].summary, /Read pricing\.py with read_file before changing it/);
    assert.equal(tools[1].status, 'done');
    assert.equal(tools[2].status, 'error');
    assert.match(tools[2].output, /closest match is at lines \d+/);
    assert.equal(await fs.readFile(path.join(dir, 'repo', 'pricing.py'), 'utf8'), original, 'nothing was changed');
  } finally {
    await ollama.close();
    await fs.rm(SESSIONS, {recursive: true, force: true});
  }
});

test('Undo puts one applied edit back, unless the file changed since', async () => {
  const {SESSIONS, id, dir, workspace, challenge} = await fixture();
  try {
    const assistant = assistantRoutes({SESSIONS, OLLAMA: 'http://127.0.0.1:9', models: MODELS, workspace});
    const ws = await workspace.open('repo', id);
    const before = challenge.files['pricing.py'], after = before + '\n# agent edit\n';
    await ws.write('pricing.py', after, 'ai');
    const chatId = '00000000-0000-4000-8000-0000000000bb';
    const chat = {id: chatId, title: 'Edit', created: 1, updated: 1, mode: 'agent', pending: null, usage: null, checkpoints: [],
      items: [{id: 'u1', type: 'user', text: 'edit'}, {id: 't1', type: 'tool', name: 'edit_file', status: 'done', summary: 'Edited pricing.py', diff: {path: 'pricing.py', before, after, created: false, deleted: false}}],
      messages: [{role: 'user', content: 'edit'}]};
    await fs.mkdir(path.join(dir, 'assistant'), {recursive: true});
    await fs.writeFile(path.join(dir, 'assistant', `${chatId}.json`), JSON.stringify(chat));
    const undo = () => assistant.handle({method: 'POST'}, new URL('http://x/api/assistant/undo'), {scope: 'ws', kind: 'repo', id, chat: chatId, item: 't1'});
    await ws.write('pricing.py', after + 'more\n', 'candidate');
    await assert.rejects(undo(), /has changed since this edit/);
    await ws.write('pricing.py', after, 'candidate');
    const result = await undo();
    assert.equal(await ws.read('pricing.py'), before);
    assert.equal(result.chat.items.find(i => i.id === 't1').undone, true);
    assert.match(result.chat.items.at(-1).text, /Undid the change to pricing\.py/);
    await assert.rejects(undo(), /can't be undone/);
  } finally { await fs.rm(SESSIONS, {recursive: true, force: true}); }
});

test('edits get a quick syntax check', async () => {
  assert.deepEqual(await checkSyntax('a.js', 'export const x = 1;\n'), {ok: true});
  const broken = await checkSyntax('src/a.js', 'function (\n');
  assert.equal(broken.ok, false);
  assert.match(broken.message, /SyntaxError/);
  assert.equal((await checkSyntax('data.json', '{"a": }')).ok, false);
  assert.equal(await checkSyntax('notes.md', '# anything'), null);
});
