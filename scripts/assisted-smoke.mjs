// Live check of the AI-assisted features against a running app (npm start)
// with Ollama and Docker: a coding question, the repo agent with approvals and
// a checkpoint restore, and a short mock coding interview with its report.
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3210';
const model = process.argv.find(a => a.startsWith('--model='))?.slice(8);
async function api(route, data) {
  const res = await fetch(base + route, data ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)} : {});
  const result = await res.json();
  assert.equal(res.status, 200, JSON.stringify(result));
  return result;
}
async function wait(value) {
  if (!value.job) return value;
  for (;;) {
    const state = await api('/api/job?id=' + value.job);
    if (state.status === 'done') return state.result;
    if (state.status === 'error') throw new Error(state.error);
    await new Promise(r => setTimeout(r, 1500));
  }
}
async function stream(route, data) {
  const res = await fetch(base + route, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
  if (!res.ok) throw new Error((await res.json()).error);
  const events = (await res.text()).split('\n').filter(Boolean).map(line => JSON.parse(line));
  const error = events.find(e => e.type === 'error');
  if (error) throw new Error(error.message);
  return events;
}

// 1. A coding question: the template fails, the run reports verdicts.
const question = await api('/api/coding/question?id=pairs-with-difference');
const template = (await api('/api/coding/template?id=pairs-with-difference&language=python')).code;
const run = await wait(await api('/api/coding/run', {id: question.id, language: 'python', code: template}));
assert.equal(run.compiled, true);
assert.ok(run.tests.every(t => t.sample));
console.log(`Coding question: the template passes ${run.passed}/${run.total} sample tests, as expected.`);

// 2. The agent fixes an incident; every edit and command waits for approval.
const session = await api('/api/session', {challenge: 'python-cart'});
const ws = {kind: 'repo', id: session.id};
let events = await stream('/api/assistant/send', {...ws, mode: 'agent', model, message: 'Fix the crash in pricing.py for an empty basket, then run the tests.'});
let done = events.at(-1);
const approvals = [];
for (let i = 0; i < 8 && done.pending; i++) {
  approvals.push(done.chat.pending.name);
  events = await stream('/api/assistant/resume', {...ws, chat: done.chat.id, decision: 'allow', model});
  done = events.at(-1);
}
console.log('Agent tool calls approved:', approvals.join(', ') || 'none');
const changes = await api(`/api/ws/changes?kind=repo&id=${session.id}`);
console.log('Files changed by the agent:', changes.map(c => c.path).join(', ') || 'none');
const chat = await api(`/api/assistant/chat?kind=repo&id=${session.id}&chat=${done.chat.id}`);
const first = chat.items.find(i => i.type === 'user');
if (changes.length) {
  const restored = await api('/api/assistant/restore', {...ws, chat: chat.id, item: first.id});
  assert.deepEqual(await api(`/api/ws/changes?kind=repo&id=${session.id}`), []);
  console.log('Checkpoint restored:', restored.restored.join(', '));
}

// 3. A mock coding interview: one exchange, then the report.
const mock = await api('/api/mock/start', {type: 'coding', question: 'missing-ticket', language: 'python', minutes: 30});
events = await stream('/api/mock/message', {id: mock.id, kind: 'message', text: 'Can the duplicate and the missing ticket be next to each other? I plan to use a hash map: O(n) time.', model});
assert.ok(events.some(e => e.type === 'delta'));
const ended = await wait(await api('/api/mock/end', {id: mock.id}));
assert.equal(ended.status, 'ended');
assert.equal(ended.report.areas.length, 4);
console.log(`Mock interview report: ${ended.report.recommendation} (${ended.report.average}/5) by ${ended.report.generatedBy}.`);
