// Tool calls that small local models print as text instead of using the
// tool-call channel are recognised, run, and kept out of the visible reply.
import test from 'node:test';
import assert from 'node:assert/strict';
import {extractTextCalls, mayBeToolText} from '../assistant.mjs';

const known = new Set(['view_changes', 'read_file', 'edit_file', 'list_files']);

test('bare JSON reply becomes a call with no visible text', () => {
  const out = extractTextCalls('{"name": "view_changes", "arguments": {}}', known);
  assert.deepEqual(out.calls, [{name: 'view_changes', args: {}}]);
  assert.equal(out.text, '');
});

test('tagged, fenced, array and per-line forms', () => {
  assert.deepEqual(extractTextCalls('<tool_call>\n{"name":"read_file","arguments":{"path":"a.js"}}\n</tool_call>', known).calls, [{name: 'read_file', args: {path: 'a.js'}}]);
  const fenced = extractTextCalls('Let me look.\n```json\n{"name": "read_file", "arguments": {"path": "src/x.py"}}\n```', known);
  assert.deepEqual(fenced.calls, [{name: 'read_file', args: {path: 'src/x.py'}}]);
  assert.equal(fenced.text, 'Let me look.');
  assert.equal(extractTextCalls('[{"name":"list_files","arguments":{}},{"function":{"name":"read_file","arguments":"{\\"path\\":\\"b\\"}"}}]', known).calls.length, 2);
  const lines = extractTextCalls('Checking both.\n{"name": "read_file", "parameters": {"path": "a"}}\n{"name": "read_file", "parameters": {"path": "b"}}', known);
  assert.deepEqual(lines.calls.map(c => c.args.path), ['a', 'b']);
  assert.equal(lines.text, 'Checking both.');
});

test('ordinary JSON and code stay as text', () => {
  const sample = 'The response looks like:\n```json\n{"name": "Ada", "arguments": 3}\n```';
  assert.deepEqual(extractTextCalls(sample, known), {calls: [], text: sample});
  assert.deepEqual(extractTextCalls('{"id": 1}', known).calls, []);
  assert.equal(extractTextCalls('Use `x = {"a": 1}`.', known).text, 'Use `x = {"a": 1}`.');
});

test('streaming hold: only replies that could be a printed call are held', () => {
  for (const held of ['', '  ', '{', '{"na', '<tool', '<tool_call>', '`', '```', '```j', '```json', '```json\n{', '[']) assert.ok(mayBeToolText(held), JSON.stringify(held));
  for (const shown of ['Hi', 'The bug', '```python', '```js\nconst', '# Plan', '1. Read']) assert.ok(!mayBeToolText(shown), JSON.stringify(shown));
});

test('a reply stuck on one sentence is cut after its first copy', async () => {
  const {repetitionCut} = await import('../ai-runtime.mjs');
  const intro = 'The tokenizer splits words at apostrophes. ';
  const loop = 'The issue is that the tokenizer is not correctly handling contractions and possessives. ';
  const text = intro + loop.repeat(8);
  const cut = repetitionCut(text);
  assert.equal(text.slice(0, cut).trim(), (intro + loop).trim());
  assert.equal(repetitionCut(intro + loop + 'Here is the fix.\n```js\nconst x = 1;\n```'), -1);
  assert.equal(repetitionCut('    assert.equal(result.length, 2);\n'.repeat(3)), -1);
});
