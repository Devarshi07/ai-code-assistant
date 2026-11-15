import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runProject, isDeepStrictEqual} from '../dist/runner-core.js';
import {loadProblems, getProblem, validateProblem, LANGUAGES, overlay} from '../problems.mjs';
import {createPractice, loadPractice, readPractice, writePractice, recordRun, advance, useHint, submit, saveDebrief, assertWritable, summarize, promptSignals, codebaseVocabulary, testTargets} from '../practice.mjs';
import {bounds, review, diffText, diffStats, verdictFor} from '../practice-review.mjs';
import {openBounds, validateTask} from '../open-ended.mjs';
import {parseResults} from '../sandbox.mjs';

async function tempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-practice-test-'));
  try { await fn(dir); } finally { await fs.rm(dir, {recursive: true, force: true}); }
}

test('runner reports passes, assertion failures, errors and load failures', async () => {
  const files = {
    'src/math.js': "exports.add = (a, b) => a + b;\nexports.boom = () => missing.value;",
    'tests/a.test.js': "const {test, describe, beforeEach} = require('node:test');\nconst assert = require('node:assert/strict');\nconst {add, boom} = require('../src/math');\nlet n = 0;\ndescribe('math', () => {\n beforeEach(() => { n++; });\n test('adds', () => assert.equal(add(1, 2), 3));\n test('wrong', () => assert.deepEqual(new Map([[1, [2]]]), new Map([[1, [3]]])));\n test('error', () => boom());\n test('hooks ran', () => assert.equal(n, 4));\n});",
    'tests/b.test.js': "require('./missing');"
  };
  const run = await runProject({files, testFiles: ['tests/a.test.js', 'tests/b.test.js']});
  const by = Object.fromEntries(run.results.map(r => [r.name, r]));
  assert.equal(by['math › adds'].status, 'pass');
  assert.equal(by['math › wrong'].status, 'fail');
  assert.match(by['math › wrong'].message, /deeply equal/);
  assert.equal(by['math › error'].status, 'error');
  assert.match(by['math › error'].stack, /src\/math\.js:2/);
  assert.equal(by['math › hooks ran'].status, 'pass');
  assert.equal(by['Could not load test file'].status, 'error');
});

test('runner isolates modules per test file and supports main, fs and require.main', async () => {
  const files = {
    'src/counter.js': 'let count = 0; module.exports = () => ++count;',
    'tests/one.test.js': "const {test} = require('node:test'); const assert = require('node:assert/strict'); const next = require('../src/counter'); test('first', () => assert.equal(next(), 1));",
    'tests/two.test.js': "const {test} = require('node:test'); const assert = require('node:assert/strict'); const next = require('../src/counter'); test('fresh module', () => assert.equal(next(), 1));",
    'data/words.txt': 'a\nb',
    'main.js': "const fs = require('node:fs'); const path = require('node:path'); console.log(fs.readFileSync(path.join(__dirname, 'data', 'words.txt'), 'utf8').split('\\n').length, require.main === module);"
  };
  const tests = await runProject({files, testFiles: ['tests/one.test.js', 'tests/two.test.js']});
  assert.deepEqual(tests.results.map(r => r.status), ['pass', 'pass']);
  const logs = [];
  const main = await runProject({files, mode: 'main', main: 'main.js'}, event => { if (event.type === 'log') logs.push(event.text); });
  assert.equal(main.exitCode, 0);
  assert.equal(logs.join('').trim(), '2 true');
  assert.ok(isDeepStrictEqual(new Set([{a: 1}]), new Set([{a: 1}])));
  assert.ok(!isDeepStrictEqual([1, 2], [1, '2']));
});

test('every shipped problem passes schema validation and has both language trees', async () => {
  const problems = await loadProblems({fresh: true});
  assert.ok(problems.length >= 13, `expected 13 problems, found ${problems.length}`);
  for (const problem of problems) {
    assert.deepEqual(validateProblem(problem, problem.id), []);
    for (const language of problem.languages) {
      const starter = await overlay(problem, language, 'starter');
      assert.ok(starter[LANGUAGES[language].main], `${problem.id}/${language} has a main entry point`);
      assert.ok(starter[LANGUAGES[language].test(1)], `${problem.id}/${language} has phase 1 tests`);
      assert.ok((await overlay(problem, language, 'phase2'))[LANGUAGES[language].test(2)], `${problem.id}/${language} has phase 2 tests`);
      assert.ok(Object.keys(await overlay(problem, language, 'solution/phase3')).length, `${problem.id}/${language} has a phase 3 solution`);
    }
  }
});

test('practice lifecycle: canonical tests, phase passing, unlocking, hints, submit and debrief', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'python');
  const dir = path.join(sessions, state.id);
  assert.equal(state.unlocked, 1);
  assert.throws(() => assertWritable(state, 'tests/test_phase1.py'), /read-only/);
  await assert.rejects(advance(dir, problem), /not passing/);
  const failing = await recordRun(dir, problem, {target: 'tests', results: [{file: 'tests/test_phase1.py', name: 'a', status: 'pass'}, {file: 'tests/test_phase1.py', name: 'b', status: 'fail', message: 'nope'}]});
  assert.deepEqual(failing.newlyPassed, []);
  const passing = await recordRun(dir, problem, {target: 'tests', results: [{file: 'tests/test_phase1.py', name: 'a', status: 'pass'}, {file: 'tests/test_phase1.py', name: 'b', status: 'pass'}]});
  assert.deepEqual(passing.newlyPassed, [1]);
  const advanced = await advance(dir, problem);
  assert.equal(advanced.state.unlocked, 2);
  assert.ok(advanced.added.includes('tests/test_phase2.py'));
  await fs.access(path.join(dir, 'repo', 'tests', 'test_phase2.py'));
  await fs.access(path.join(dir, 'canonical', 'tests', 'test_phase2.py'));
  assert.deepEqual(testTargets(advanced.state, ['tests/test_phase1.py', 'tests/test_phase2.py', 'tests/test_mine.py']), ['tests/test_phase1.py', 'tests/test_phase2.py', 'tests/test_mine.py']);
  const hint = await useHint(dir, problem);
  assert.equal(hint.index, 0);
  await submit(dir, problem);
  const submitted = await readPractice(dir);
  assert.equal(submitted.status, 'debrief');
  assert.equal(submitted.debrief.questions.length, 3);
  await assert.rejects(recordRun(dir, problem, {target: 'tests', results: []}), /submitted/);
  await assert.rejects(saveDebrief(dir, problem, ['only one']), /Answer each/);
  const reviewing = await saveDebrief(dir, problem, ['a', 'b', 'c']);
  assert.equal(reviewing.status, 'reviewing');
}));

test('expired sessions move to the debrief and refuse further work', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'javascript');
  const dir = path.join(sessions, state.id);
  const raw = await readPractice(dir);
  raw.deadline = Date.now() - 1;
  await writePractice(dir, raw);
  const loaded = await loadPractice(dir, problem);
  assert.equal(loaded.status, 'debrief');
  assert.equal(loaded.endReason, 'time_up');
  await assert.rejects(useHint(dir, problem), /Time is up/);
}));

test('evidence summary links AI pastes to the runs that verified them', () => {
  const t = Date.now();
  const state = {started: t - 600000, deadline: t + 600000, phases: [{passedAt: t, skippedAt: null, hints: 1}], unlocked: 1, events: [
    {type: 'open', path: 'a.py', at: t - 500000},
    {type: 'prompt', at: t - 400000, chars: 120, specific: true},
    {type: 'paste', at: t - 300000, fromAI: true, chars: 400},
    {type: 'run', target: 'tests', at: t - 290000},
    {type: 'paste', at: t - 200000, fromAI: true, chars: 100},
    {type: 'prompt', at: t - 100000, chars: 40, specific: false}
  ]};
  const stats = summarize(state);
  assert.equal(stats.aiPastes, 2);
  assert.equal(stats.aiPastesVerified, 1);
  assert.equal(stats.prompts, 2);
  assert.equal(stats.specificPrompts, 1);
  assert.equal(stats.filesOpenedBeforeFirstPrompt, 1);
  assert.equal(stats.testRuns, 1);
});

test('prompt signals detect codebase vocabulary and pasted instructions', async () => {
  const problem = await getProblem('maze-solver');
  const vocabulary = await codebaseVocabulary(problem, 'python');
  assert.ok(promptSignals('Why does in_bounds reject this position?', problem, 'python', vocabulary).specific);
  assert.ok(!promptSignals('How do I fix this bug?', problem, 'python', vocabulary).specific);
  const pasted = problem.phases[1].instructions.python.slice(0, 600);
  assert.ok(promptSignals(`Solve this: ${pasted}`, problem, 'python', vocabulary).pastedInstructions);
});

test('review scores stay within evidence bounds and fall back to rules without a model', async () => {
  const problem = await getProblem('maze-solver');
  const now = Date.now();
  const state = {language: 'python', started: now - 1800000, deadline: now + 900000, ended: now, endReason: 'submitted', unlocked: 1, chat: [], lastRun: null,
    phases: [{number: 1, unlockedAt: now - 1800000, passedAt: null, skippedAt: null, hints: 0, runs: 0}], events: [], debrief: {questions: problem.debrief, answers: ['', '', '']}};
  const limits = bounds(state, summarize(state));
  assert.equal(limits.verification.ceiling, 1, 'no test runs caps verification at 1');
  assert.equal(limits.communication.ceiling, 2);
  const generous = async () => ({message: {content: JSON.stringify({headline: 'Great', topFixes: ['a', 'b', 'c'], areas: ['problem_solving', 'ai_control', 'verification', 'communication'].map(key => ({key, score: 4, summary: 'x', strengths: [], improvements: []}))})}});
  const report = await review(state, problem, {llm: generous, model: {name: 'fake'}, diff: ''});
  for (const area of report.areas) assert.ok(area.score <= limits[area.key].ceiling, `${area.key} clamped to ${limits[area.key].ceiling}`);
  assert.equal(report.generatedBy, 'fake');
  const fallback = await review(state, problem, {llm: null, model: null, diff: ''});
  assert.equal(fallback.generatedBy, 'rules');
  assert.equal(fallback.verdict, verdictFor(fallback.average));
});

test('diff helpers describe changed lines', () => {
  const diff = diffText('a\nb\nc', 'a\nB\nc\nd', 'f.py');
  assert.match(diff, /^--- f\.py/);
  assert.match(diff, /\n-b\n/);
  assert.match(diff, /\n\+B\n/);
  assert.deepEqual(diffStats('a\nb', 'a\nc\nd'), {added: 2, removed: 1});
});

test('open-ended bounds follow hidden-test pass rate and transcript presence', () => {
  const base = {minutes: 60, started: 0, deadline: 3600000, submittedAt: 3000000, transcript: '', debrief: {answers: ['word '.repeat(30), 'word '.repeat(30), 'word '.repeat(30)]}};
  const strong = openBounds({...base, tests: {summary: {hidden: {passed: 19, total: 20}, public: {passed: 5, total: 5}, custom: {passed: 4, total: 4}}}});
  assert.equal(strong.problem_solving.baseline, 4);
  assert.equal(strong.ai_control.ceiling, 2, 'no transcript caps control over the AI');
  const weak = openBounds({...base, transcript: 'prompt '.repeat(100), tests: {summary: {hidden: {passed: 2, total: 20}, public: {passed: 1, total: 5}, custom: {passed: 0, total: 0}}}});
  assert.equal(weak.problem_solving.baseline, 1);
  assert.equal(weak.ai_control.baseline, 3);
  assert.deepEqual(validateTask({id: 'x', title: 'X', tagline: 't', minutes: 60, languages: ['python'], brief: 'b', debrief: ['1', '2', '3']}, 'x'), []);
});

test('sandbox output parsing separates program output from results', () => {
  const parsed = parseResults('hello\npartial@@DGRESULT@@{"type":"test","file":"t.py","name":"x","status":"pass","ms":1}\n@@DGRESULT@@{"type":"done","passed":1,"failed":0}\n');
  assert.equal(parsed.results.length, 1);
  assert.equal(parsed.done.passed, 1);
  assert.equal(parsed.output, 'hello\npartial');
});
