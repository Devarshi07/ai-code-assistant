// Tests for practice tests (the assessment simulator), the multiple-choice
// bank and conversation mock interviews.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scoreMcq, loadMcqBank, validateMcq} from '../mcq.mjs';
import {testRoutes, TEST_TEMPLATES} from '../tests-engine.mjs';
import {talkBounds, TALK_FORMATS} from '../mock.mjs';

test('multiple-choice scoring: single answers are all or nothing, multiple answers give partial credit', () => {
  const single = {type: 'single', points: 5, answer: [2]};
  assert.equal(scoreMcq(single, [2]).score, 5);
  assert.equal(scoreMcq(single, [1]).score, 0);
  assert.equal(scoreMcq(single, []).answered, false);
  const multi = {type: 'multiple', points: 10, answer: [0, 2, 3]};
  assert.deepEqual([scoreMcq(multi, [0, 2, 3]).score, scoreMcq(multi, [0, 2, 3]).correct], [10, true]);
  assert.equal(scoreMcq(multi, [0, 2]).score, 6.67);
  assert.equal(scoreMcq(multi, [0, 2]).partial, true);
  assert.equal(scoreMcq(multi, [0, 1]).score, 3.33, 'a wrong option within the answer count keeps the right ones');
  assert.equal(scoreMcq(multi, [0, 1, 2, 3]).score, 0, 'choosing more options than there are answers scores zero');
});

test('the multiple-choice and written-answer bank is valid', async () => {
  const bank = await loadMcqBank({fresh: true});
  assert.deepEqual(bank.problems, []);
  assert.ok(bank.mcq.length >= 60, `${bank.mcq.length} multiple-choice questions`);
  assert.ok(bank.subjective.length >= 8, `${bank.subjective.length} written-answer questions`);
  assert.ok(bank.mcq.some(q => q.type === 'multiple'));
  assert.ok(validateMcq({id: 'x', topic: 'Git', difficulty: 'Easy', points: 5, type: 'single', question: 'q', options: ['a', 'b', 'c', 'c'], answer: [0], explanation: 'e'}).some(e => e.includes('distinct')));
});

test('every ready-made test can be built from the question bank', async () => {
  const SESSIONS = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-tests-'));
  try {
    const tests = testRoutes({SESSIONS, job: fn => fn(() => {}), coding: {}, models: async () => ({models: []}), OLLAMA: 'http://127.0.0.1:9'});
    for (const template of TEST_TEMPLATES) {
      const t = await tests.handle({method: 'POST'}, new URL('http://x/api/tests/create'), {template: template.id});
      const expected = template.sections.reduce((sum, s) => sum + s.count, 0);
      assert.equal(t.questions.length, expected, template.id);
      assert.equal(new Set(t.questions.map(q => q.ref)).size, expected, `${template.id} repeats a question`);
      assert.equal(t.status, 'ready');
    }
  } finally { await fs.rm(SESSIONS, {recursive: true, force: true}); }
});

test('at the end of a test, code counts from Save & Proceed, then Run Tests, then Run Code, and never-run code does not count', async () => {
  const SESSIONS = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-tests-'));
  const evaluated = [];
  const coding = {evaluate: async ({code, mode}) => { evaluated.push({code, mode}); return {score: mode === 'submit' ? 30 : undefined, passed: 13, total: 13, compiled: true, fraction: 1, mode, tests: []}; }};
  try {
    const tests = testRoutes({SESSIONS, job: fn => fn(() => {}), coding, models: async () => ({models: []}), OLLAMA: 'http://127.0.0.1:9'});
    const call = (p, data) => tests.handle({method: 'POST'}, new URL(`http://x${p}`), data);
    const created = await call('/api/tests/create', {custom: {coding: {Easy: 2, Medium: 2}, minutes: 30, ai: 'none', integrity: 'standard'}});
    const id = created.id;
    await assert.rejects(call('/api/tests/save', {id, key: 'q1', language: 'python', code: 'x'}), /Start the test first/);
    await call('/api/tests/start', {id});
    const [q1, q2, q3, q4] = created.questions.map(q => q.key);
    await call('/api/tests/run', {id, key: q1, language: 'python', code: 'ran-code'});
    await call('/api/tests/save', {id, key: q1, language: 'python', code: 'saved-code', proceed: true});
    await call('/api/tests/run', {id, key: q2, language: 'python', code: 'sample-run'});
    await call('/api/tests/runtests', {id, key: q2, language: 'python', code: 'tests-run'});
    await call('/api/tests/run', {id, key: q3, language: 'python', code: 'only-run'});
    await call('/api/tests/save', {id, key: q3, language: 'python', code: 'typed-later', changed: true});
    await call('/api/tests/save', {id, key: q4, language: 'python', code: 'never-run', changed: true});
    evaluated.length = 0;
    const done = await call('/api/tests/finish', {id});
    const rows = Object.fromEntries(done.report.rows.map(r => [r.key, r]));
    assert.equal(rows[q1].source, 'Save & Proceed');
    assert.equal(rows[q1].code, 'saved-code');
    assert.equal(rows[q2].source, 'Run Tests');
    assert.equal(rows[q2].code, 'tests-run');
    assert.equal(rows[q3].source, 'Run Code');
    assert.equal(rows[q3].code, 'only-run');
    assert.equal(rows[q3].unsavedChanges, true);
    assert.equal(rows[q4].source, null);
    assert.equal(rows[q4].score, 0);
    assert.deepEqual(evaluated.map(e => e.code).sort(), ['only-run', 'saved-code', 'tests-run']);
    assert.ok(evaluated.every(e => e.mode === 'submit'), 'evaluation runs every test case');
    assert.equal(done.status, 'ended');
    await assert.rejects(call('/api/tests/save', {id, key: q4, language: 'python', code: 'late'}), /ended/);
  } finally { await fs.rm(SESSIONS, {recursive: true, force: true}); }
});

test('conversation interview scores are capped by how much the candidate said', () => {
  for (const format of Object.keys(TALK_FORMATS)) {
    const silent = talkBounds(format, {answers: 0, words: 0, averageWords: 0, shortAnswers: 0, examples: 0, notesWords: 0});
    assert.ok(Object.values(silent).every(b => b.ceiling === 1), format);
    const terse = talkBounds(format, {answers: 4, words: 60, averageWords: 15, shortAnswers: 3, examples: 0, notesWords: 0});
    assert.ok(Object.values(terse).every(b => b.ceiling <= 2), format);
    const full = talkBounds(format, {answers: 8, words: 900, averageWords: 110, shortAnswers: 0, examples: 3, notesWords: 120});
    assert.ok(Object.values(full).every(b => b.ceiling === 5 && b.floor === 1), format);
  }
  const noNotes = talkBounds('design', {answers: 8, words: 900, averageWords: 110, shortAnswers: 0, examples: 0, notesWords: 0});
  assert.ok(noNotes.architecture.ceiling <= 3, 'a design without notes caps the high-level design score');
});
