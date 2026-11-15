// Live check of the core repo API against a running app (npm start).
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3210';
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

const runtimes = await api('/api/runtimes');
assert.equal(Object.keys(runtimes).length, 16);
const session = await api('/api/session', {challenge: 'cart'});
assert.ok(session.files.includes('cart.mjs'));
const ws = `kind=repo&id=${session.id}`;
const file = await api(`/api/ws/file?${ws}&path=cart.mjs`);
assert.ok(file.content.includes('export function total'));
await api('/api/ws/file', {kind: 'repo', id: session.id, path: 'cart.mjs', content: file.content});
const forbidden = await fetch(base + '/api/ws/file', {method: 'POST', headers: {'Content-Type': 'application/json', 'Origin': 'http://untrusted.example'}, body: '{}'});
assert.equal(forbidden.status, 403);
const traversal = await fetch(base + `/api/ws/file?${ws}&path=..%2Fsession.json`);
assert.equal(traversal.status, 400);
assert.deepEqual(await api(`/api/ws/changes?${ws}`), []);
const status = await api('/api/status');
console.log('Core API verified.', status);
if (status.docker) {
  const result = await wait(await api('/api/run', {id: session.id, runtime: 'node', command: 'node --test'}));
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /empty cart/);
  console.log('Docker executed the intentionally failing tests.');
  const fixed = 'export function total(items,discount=0){return Math.round(items.reduce((s,i)=>s+i.price*i.quantity,0)*(1-discount)*100)/100;}';
  await api('/api/ws/file', {kind: 'repo', id: session.id, path: 'cart.mjs', content: fixed});
  assert.deepEqual(await api(`/api/ws/changes?${ws}`), [{path: 'cart.mjs', status: 'modified'}]);
  const passed = await wait(await api('/api/run', {id: session.id, runtime: 'node', command: 'node --test'}));
  assert.equal(passed.code, 0, passed.output);
  const terminal = await wait(await api('/api/ws/terminal', {kind: 'repo', id: session.id, command: 'ls'}));
  assert.match(terminal.output, /cart\.mjs/);
  console.log('Docker passed all four tests after repair, and the terminal ran a command.');
} else console.log('Docker unavailable: live execution not verified.');
if (process.argv.includes('--tasks')) {
  const first = await wait(await api('/api/task/random', {language: 'node', scope: 'all'}));
  const second = await wait(await api('/api/task/random', {language: 'node', scope: 'all'}));
  assert.notEqual(first.id, second.id);
  assert.ok(!('evalScript' in first));
  const imported = await wait(await api('/api/task/start', {taskId: first.id}));
  assert.equal(imported.commit, first.commit);
  assert.ok(imported.files.length > 0);
  console.log('Historical task imported:', imported.taskId, imported.commit, 'files:', imported.files.length);
}
