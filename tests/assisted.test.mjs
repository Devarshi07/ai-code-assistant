// Tests for coding questions, the judge, the AI assistant, workspaces and mock interviews.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fitContext, announcesAction, statementMarkdown, assistantRoutes} from '../assistant.mjs';
import {normalizeOutput} from '../judge.mjs';
import {validateQuestion, loadQuestions, readTests, getQuestion} from '../coding.mjs';
import {recommendationFor, codingBounds, fluencyBounds, stageOf} from '../mock.mjs';
import {workspaceApi} from '../workspace-api.mjs';
import {challenges} from '../challenges.mjs';
import {lineDiff} from '../dist/diff.js';

test('the judge ignores trailing whitespace and line-ending differences', () => {
  assert.equal(normalizeOutput('3 \r\n4\n\n\n'), '3\n4');
  assert.notEqual(normalizeOutput('3 4'), normalizeOutput('34'));
});

test('every coding question in questions/ is valid and has LF test input', async () => {
  const questions = await loadQuestions({fresh: true});
  assert.ok(questions.length >= 20, `expected at least 20 questions, found ${questions.length}`);
  for (const q of questions) {
    const tests = await readTests(q, {samplesOnly: true});
    assert.equal(tests.length, q.samples.length, q.id);
    for (const t of tests) assert.ok(!t.input.includes('\r'), `${q.id} input keeps CR characters`);
  }
  const bad = validateQuestion({id: 'x', title: 'X', difficulty: 'Easy', maxScore: 50, skills: ['Nope'], samples: [], tests: []}, 'x');
  assert.ok(bad.some(e => e.includes('maxScore')) && bad.some(e => e.includes('skills')) && bad.some(e => e.includes('tests')));
});

test('the assistant sees the full statement of a question', async () => {
  const q = await getQuestion('pairs-with-difference');
  const text = statementMarkdown(q);
  for (const part of ['Function Description', 'Input Format', 'Constraints', 'Output Format', 'Sample Input 0', 'Sample Output 1']) assert.ok(text.includes(part), part);
});

test('context fitting trims old tool output first, then drops whole old turns', () => {
  const big = 'x'.repeat(20000);
  const messages = [
    {role: 'user', content: 'first question'},
    {role: 'assistant', content: '', tool_calls: [{function: {name: 'read_file', arguments: {path: 'a'}}}]},
    {role: 'tool', content: big},
    {role: 'assistant', content: 'answer one'},
    {role: 'user', content: 'second question'},
    {role: 'tool', content: big}, {role: 'tool', content: 'small'}, {role: 'tool', content: 'small'}, {role: 'tool', content: 'small'},
    {role: 'user', content: 'latest question'}
  ];
  const roomy = fitContext('system', messages, [], 100000);
  assert.equal(roomy.dropped, 0);
  assert.equal(roomy.messages[2].content.length, 20000);
  // Trimming older tool output is enough here, so no turn is dropped.
  const trimmed = fitContext('system', messages, [], 4000);
  assert.ok(trimmed.used <= 4000 * 0.8, `used ${trimmed.used}`);
  assert.equal(trimmed.dropped, 0);
  assert.ok(trimmed.messages[2].content.length < 500);
  assert.equal(trimmed.messages.at(-1).content, 'latest question');
  assert.equal(messages[2].content.length, 20000, 'the stored conversation is not modified');
  // Long user turns can't be trimmed that way, so the oldest turns go.
  const turns = Array.from({length: 6}, (_, i) => [{role: 'user', content: `turn ${i} ` + 'y'.repeat(6000)}, {role: 'assistant', content: `reply ${i}`}]).flat();
  const dropped = fitContext('system', [...turns, {role: 'user', content: 'latest question'}], [], 8000);
  assert.ok(dropped.dropped > 0);
  assert.ok(dropped.used <= 8000 * 0.8, `used ${dropped.used}`);
  assert.equal(dropped.messages[0].role, 'user', 'a trimmed request still starts with a user turn');
  assert.equal(dropped.messages.at(-1).content, 'latest question');
});

test('agent replies that announce an action without taking it are detected', () => {
  assert.ok(announcesAction('The bug is in reduce. Let\'s make this change.'));
  assert.ok(announcesAction('I\'ll read the entire src/tokenizer.js file to understand it.'));
  assert.ok(announcesAction('Here is the plan:'));
  assert.ok(!announcesAction('All tests pass now. I changed the empty-basket check.'));
  assert.ok(!announcesAction('Should I also update the README?'));
});

test('mock interview scores stay within evidence bounds', () => {
  assert.equal(recommendationFor(4.6), 'Strong Hire');
  assert.equal(recommendationFor(3.8), 'Hire');
  assert.equal(recommendationFor(3), 'Lean Hire');
  assert.equal(recommendationFor(2.3), 'Lean No Hire');
  assert.equal(recommendationFor(1.4), 'No Hire');
  const base = {runs: 2, compileErrors: 0, runtimeErrors: 0, submissions: 1, bestSubmission: null, hints: 0, candidateMessages: 4, candidateWords: 200, clarifyingQuestions: 1, discussedComplexity: true, codeChanged: true, codeLines: 30};
  const solved = codingBounds({...base, finalTests: {passed: 12, total: 12, fraction: 1, compiled: true}});
  assert.ok(solved.problem_solving.floor >= 3);
  const untouched = codingBounds({...base, codeChanged: false, candidateWords: 10, discussedComplexity: false, finalTests: {passed: 0, total: 12, fraction: 0, compiled: true}});
  assert.equal(untouched.code_quality.ceiling, 1);
  assert.ok(untouched.problem_solving.ceiling <= 2);
  assert.ok(untouched.communication.ceiling <= 2);
  const silent = fluencyBounds({prompts: 0, specificPrompts: 0, pastedInstructions: 0, filesOpenedBeforeFirstPrompt: 0, firstPromptMinute: null, modes: {ask: 0, plan: 0, agent: 0}, aiPastes: 0, aiPastesVerified: 0, testRuns: 0, denials: 0, customTests: false, phasesPassed: 0, phasesSkipped: 0, restores: 0, interviewerReplies: 0});
  assert.ok(silent.framing.ceiling <= 2 && silent.judging.ceiling <= 2);
});

test('the interview stage follows the clock and jumps to follow-ups after a full submission', () => {
  const started = 0, deadline = 100;
  assert.equal(stageOf({started, deadline, submissions: []}, 5).key, 'intro');
  assert.equal(stageOf({started, deadline, submissions: []}, 50).key, 'coding');
  assert.equal(stageOf({started, deadline, submissions: [{passed: 5, total: 5}]}, 50).key, 'testing');
  assert.equal(stageOf({started, deadline, submissions: []}, 99).key, 'wrapup');
});

test('line diffs list removed lines before the lines that replace them', () => {
  const rows = lineDiff('a\nb\nc', 'a\nB\nc');
  assert.deepEqual(rows.map(r => r.op + r.text), [' a', '-b', '+B', ' c']);
  assert.deepEqual(lineDiff(null, 'x').map(r => r.op), ['+']);
});

async function repoFixture() {
  const SESSIONS = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-ws-'));
  const id = '00000000-0000-4000-8000-000000000001';
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

test('repo workspaces report changes against the starting code', async () => {
  const {SESSIONS, id, workspace, challenge} = await repoFixture();
  try {
    const ws = await workspace.open('repo', id);
    assert.deepEqual(await workspace.changes(ws), []);
    await ws.write('pricing.py', challenge.files['pricing.py'] + '\n# changed\n', 'ai');
    await ws.write('notes/plan.md', 'plan', 'candidate');
    assert.deepEqual(await workspace.changes(ws), [{path: 'notes/plan.md', status: 'added'}, {path: 'pricing.py', status: 'modified'}]);
    assert.equal(await workspace.baselineOf(ws, 'pricing.py'), challenge.files['pricing.py']);
    await assert.rejects(ws.read('../session.json'), /Invalid file path/);
    await assert.rejects(ws.write('.git/config', 'x'), /Invalid file path/);
  } finally { await fs.rm(SESSIONS, {recursive: true, force: true}); }
});

test('restoring a checkpoint undoes the agent\'s edits and trims the conversation', async () => {
  const {SESSIONS, id, dir, workspace, challenge} = await repoFixture();
  try {
    const assistant = assistantRoutes({SESSIONS, OLLAMA: 'http://127.0.0.1:9', models: async () => ({models: []}), workspace});
    const ws = await workspace.open('repo', id);
    await ws.write('pricing.py', 'broken by the agent\n', 'ai');
    await ws.write('extra.py', 'new file\n', 'ai');
    const chatId = '00000000-0000-4000-8000-0000000000aa';
    const chat = {id: chatId, title: 'Fix', created: 1, updated: 1, mode: 'agent', pending: null, usage: null,
      items: [{id: 'u1', type: 'user', text: 'fix the crash'}, {id: 'a1', type: 'assistant', text: 'done'}],
      messages: [{role: 'user', content: 'fix the crash'}, {role: 'assistant', content: 'done'}],
      checkpoints: [{item: 'u1', messageIndex: 0, files: {'pricing.py': challenge.files['pricing.py'], 'extra.py': null}}]};
    await fs.mkdir(path.join(dir, 'assistant'), {recursive: true});
    await fs.writeFile(path.join(dir, 'assistant', `${chatId}.json`), JSON.stringify(chat));
    const listed = await assistant.handle({method: 'GET'}, new URL(`http://x/api/assistant/chat?kind=repo&id=${id}&chat=${chatId}`), {});
    assert.equal(listed.items[0].restorable, true);
    const result = await assistant.handle({method: 'POST'}, new URL('http://x/api/assistant/restore'), {kind: 'repo', id, chat: chatId, item: 'u1'});
    assert.deepEqual(result.restored.sort(), ['extra.py', 'pricing.py']);
    assert.equal(result.text, 'fix the crash');
    assert.equal(await ws.read('pricing.py'), challenge.files['pricing.py']);
    assert.ok(!(await ws.files()).includes('extra.py'));
    assert.equal(result.chat.items.length, 1);
    assert.equal(result.chat.items[0].type, 'notice');
  } finally { await fs.rm(SESSIONS, {recursive: true, force: true}); }
});
