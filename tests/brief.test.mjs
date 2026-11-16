// The question panel's view of phase instructions, file links and test
// lookups, and restarting a guided attempt. No browser or Docker needed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseInstructions, parseReport, mentionedFiles, resolveFile, testNameCandidates} from '../dist/brief.js';
import {getProblem, loadProblems} from '../problems.mjs';
import {createPractice, readPractice, recordRun, submit, abandon, saveDebrief, listPractice, mutate} from '../practice.mjs';
import {refersToEditor} from '../assistant.mjs';

test('reports keep their order, sender and text; the goal is separate', () => {
  const brief = parseInstructions([
    'QA filed ticket **#212** this morning:',
    '',
    '> *"The bot kept firing at the same squares."* (QA)',
    '',
    'A developer added:',
    '',
    '> **Mobile team:** *"Checkout returns `200`."*',
    '> *"It used to be 201."*',
    '',
    'Find the root cause.',
    '',
    '**Done when:** all tests in `tests/phase1.test.js` pass.'
  ].join('\n'));
  assert.equal(brief.done, 'all tests in `tests/phase1.test.js` pass.');
  assert.equal(brief.reports, 2);
  assert.deepEqual(brief.segments.map(s => s.type), ['text', 'reports', 'text', 'reports', 'text']);
  assert.deepEqual(brief.segments[1].reports, [{who: 'QA', text: 'The bot kept firing at the same squares.'}]);
  assert.equal(brief.segments[3].reports[0].who, 'Mobile team');
  assert.match(brief.segments[3].reports[0].text, /Checkout returns `200`/);
  assert.equal(brief.segments[4].markdown, 'Find the root cause.');
});

test('a quote with an italic title inside drops the toggling asterisks, not bold or code', () => {
  assert.deepEqual(parseReport('*"We own one copy of* The Salt Road Atlas*, and **two** members got it. See `a*b`."*'),
    {who: null, text: 'We own one copy of The Salt Road Atlas, and **two** members got it. See `a*b`.'});
  assert.deepEqual(parseReport('Plain words with no quotes'), {who: null, text: 'Plain words with no quotes'});
});

test('every shipped phase has a goal and parses into segments', async () => {
  for (const problem of await loadProblems({fresh: true})) {
    for (const phase of problem.phases) {
      for (const text of typeof phase.instructions === 'string' ? [phase.instructions] : Object.values(phase.instructions)) {
        const brief = parseInstructions(text);
        assert.ok(brief.done, `${problem.id}: ${phase.title} has a "Done when" line`);
        assert.ok(brief.segments.length, `${problem.id}: ${phase.title} has text`);
        for (const segment of brief.segments) if (segment.type === 'reports') for (const report of segment.reports) assert.ok(report.text && !/^\*|\*$/.test(report.text), `${problem.id}: clean report text`);
      }
    }
  }
});

test('file mentions resolve to workspace files only', () => {
  const files = ['README.md', 'src/graph.js', 'src/loader.js', 'lib/loader.js', 'tests/phase1.test.js'];
  assert.equal(resolveFile('src/graph.js', files), 'src/graph.js');
  assert.equal(resolveFile('graph.js', files), 'src/graph.js');
  assert.equal(resolveFile('loader.js', files), null, 'ambiguous names are not linked');
  assert.equal(resolveFile('./loader.js', files, 'lib/README.md'), 'lib/loader.js', 'relative to the document');
  assert.equal(resolveFile('../src/graph.js', files, 'docs/guide.md'), 'src/graph.js');
  assert.equal(resolveFile('../../etc/passwd.txt', files, 'README.md'), null);
  assert.equal(resolveFile('removeFriendship()', files), null);
  assert.equal(resolveFile('npm test', files), null);
  assert.deepEqual(mentionedFiles('Start with `README.md`, then `src/graph.js` and `graph.js` and `GraphError`.', files), ['README.md', 'src/graph.js']);
});

test('test names map to the names in source files, exact forms first', () => {
  assert.ok(testNameCandidates('LendingTests › a member cannot go over the loan limit').includes('def test_a_member_cannot_go_over_the_loan_limit('));
  assert.ok(testNameCandidates('insufficient funds is422').includes('void insufficientFundsIs422('));
  const candidates = testNameCandidates('contractions typed on mobile stay whole');
  assert.equal(candidates[0], "'contractions typed on mobile stay whole'", 'the quoted name comes first');
  assert.equal(candidates.at(-1), 'contractions typed on mobile stay whole', 'a bare substring comes last');
});

test('relative links follow the document; rooted and encoded links resolve', () => {
  const files = ['README.md', 'setup.md', 'docs/README.md', 'docs/setup.md', 'src/app.py', 'docs/my file.md'];
  assert.equal(resolveFile('setup.md', files, 'docs/README.md'), 'docs/setup.md');
  assert.equal(resolveFile('setup.md', files, 'README.md'), 'setup.md');
  assert.equal(resolveFile('/src/app.py', files, 'docs/README.md'), 'src/app.py');
  assert.equal(resolveFile('my%20file.md', files, 'docs/README.md'), 'docs/my file.md');
  assert.equal(resolveFile('../setup.md', files, 'docs/README.md'), 'setup.md');
});

test('code blocks in instructions never become reports or goals', () => {
  const brief = parseInstructions('Try:\n\n```\n>>> tokenize("a")\n**Done when:** fake\n```\n\n**Done when:** real.');
  assert.equal(brief.reports, 0);
  assert.equal(brief.done, 'real.');
  assert.match(brief.segments[0].markdown, />>> tokenize/);
});

test('the assistant only sees the open file when the message points at it', () => {
  for (const message of ['hey', 'hello?', 'what do u mean bro', 'give me the answer']) assert.equal(refersToEditor(message), false, message);
  for (const message of ['what does this file do', 'explain line 12', 'fix it', 'why is the code here wrong']) assert.equal(refersToEditor(message), true, message);
});

async function tempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-restart-test-'));
  try { await fn(dir); } finally { await fs.rm(dir, {recursive: true, force: true}); }
}

test('restart closes an attempt once, from active or debrief, never while reviewing', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const first = await createPractice(sessions, problem, 'python');
  const dir = path.join(sessions, first.id);
  await recordRun(dir, problem, {target: 'tests', results: [{file: 'tests/test_phase1.py', name: 'a', status: 'fail', message: 'nope'}]});
  assert.deepEqual((await readPractice(dir)).lastRun.results, [{file: 'tests/test_phase1.py', name: 'a', status: 'fail'}], 'per-test results are kept for the question panel');
  const closed = await abandon(dir, problem);
  assert.equal(closed.status, 'ended');
  assert.equal(closed.endReason, 'restarted');
  assert.equal(closed.report, null);
  await assert.rejects(abandon(dir, problem), /already restarted/, 'a double click cannot restart twice');
  await assert.rejects(mutate(dir, problem, () => {}), /restarted/, 'the old attempt no longer accepts changes');
  await assert.rejects(saveDebrief(dir, problem, ['a', 'b', 'c']).then(state => { if (state.status !== 'ended') throw new Error('changed'); throw new Error('restarted'); }), /restarted/);
  const listed = (await listPractice(sessions)).find(item => item.id === first.id);
  assert.equal(listed.endReason, 'restarted');

  const second = await createPractice(sessions, problem, 'python');
  const dir2 = path.join(sessions, second.id);
  await submit(dir2, problem);
  assert.equal((await abandon(dir2, problem)).endReason, 'restarted', 'an attempt waiting for its debrief can be restarted');

  const third = await createPractice(sessions, problem, 'python');
  const dir3 = path.join(sessions, third.id);
  await submit(dir3, problem);
  await saveDebrief(dir3, problem, problem.debrief.map(() => 'An answer.'));
  await assert.rejects(abandon(dir3, problem), /review is being written/);
}));

test('a restarted attempt does not reveal the phase answers', () => tempDir(async sessions => {
  const {publicPractice} = await import('../practice.mjs');
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'python');
  const closed = await abandon(path.join(sessions, state.id), problem);
  assert.ok(publicPractice(closed, problem).problem.phases.every(phase => phase.answer === undefined));
}));
