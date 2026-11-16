// Switching a guided session's language mid-session, and restarting in
// another language. No Docker needed: the runs are recorded directly.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {getProblem, overlay, readTree, LANGUAGES} from '../problems.mjs';
import {createPractice, readPractice, recordRun, advance, switchLanguage, solvedPhases, startingFiles, baselineFiles, workspaceFiles, writePractice} from '../practice.mjs';

async function tempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-language-test-'));
  try { await fn(dir); } finally { await fs.rm(dir, {recursive: true, force: true}); }
}
const passPhase = (dir, problem, language, n) => recordRun(dir, problem, {target: 'tests', results: [{file: LANGUAGES[language].test(n), name: 'all', status: 'pass'}]});

test('switching carries progress, keeps each language\'s code and rebuilds the provided tests', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'python');
  const dir = path.join(sessions, state.id);
  await passPhase(dir, problem, 'python', 1);
  await advance(dir, problem);
  const mine = path.join(dir, 'repo', 'notes.txt');
  await fs.writeFile(mine, 'my python notes');

  const toJs = await switchLanguage(dir, problem, 'javascript');
  assert.equal(toJs.restored, false);
  let saved = await readPractice(dir);
  assert.equal(saved.language, 'javascript');
  assert.deepEqual(saved.readonly, ['tests/phase1.test.js', 'tests/phase2.test.js']);
  assert.deepEqual(saved.base, {solved: 1}, 'phase 1 was passed, so its reference fix is in');
  assert.equal(saved.lastRun, null);
  assert.ok(saved.phases[0].passedAt, 'phase progress carries over');
  const js = await workspaceFiles(dir);
  const expected = await startingFiles(problem, 'javascript', 2, 1);
  for (const [name, text] of Object.entries(expected)) assert.equal(js[name], text, name);
  assert.ok(!('notes.txt' in js), 'the Python workspace is not mixed in');
  assert.deepEqual(Object.keys(await readTree(path.join(dir, 'canonical'))).sort(), ['tests/phase1.test.js', 'tests/phase2.test.js'], 'the provided tests are the JavaScript ones');
  assert.deepEqual(await baselineFiles(problem, saved), expected, 'changes are measured from where the JavaScript code started');

  const back = await switchLanguage(dir, problem, 'python');
  assert.equal(back.restored, true, 'switching back at the same phase brings the Python code back');
  saved = await readPractice(dir);
  assert.equal(await fs.readFile(mine, 'utf8'), 'my python notes');
  assert.equal(saved.base, null);
  assert.deepEqual(saved.readonly, ['tests/test_phase1.py', 'tests/test_phase2.py']);
  assert.deepEqual(saved.events.filter(e => e.type === 'language').map(e => [e.from, e.to, e.restored]), [['python', 'javascript', false], ['javascript', 'python', true]]);
}));

test('a skipped phase stays unsolved in the new language', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'javascript');
  const dir = path.join(sessions, state.id);
  await advance(dir, problem, {skip: true});
  assert.equal(solvedPhases(await readPractice(dir)), 0);
  await switchLanguage(dir, problem, 'python');
  const saved = await readPractice(dir);
  assert.equal(saved.base, null);
  const files = await workspaceFiles(dir);
  const starter = await overlay(problem, 'python', 'starter');
  const fix = await overlay(problem, 'python', 'solution/phase1');
  for (const name of Object.keys(fix)) if (name in starter) assert.equal(files[name], starter[name], `${name} keeps the bug`);
}));

test('a switch back at a later phase starts that language fresh at the new phase', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'python');
  const dir = path.join(sessions, state.id);
  await switchLanguage(dir, problem, 'javascript');
  await passPhase(dir, problem, 'javascript', 1);
  await advance(dir, problem);
  const back = await switchLanguage(dir, problem, 'python');
  assert.equal(back.restored, false, 'the Python draft is from phase 1');
  const files = await workspaceFiles(dir);
  assert.ok(files['tests/test_phase2.py'], 'phase 2 tests are there');
  assert.deepEqual((await readPractice(dir)).base, {solved: 1});
}));

test('switching is refused for unknown languages, mock interviews and ended sessions', () => tempDir(async sessions => {
  const problem = await getProblem('maze-solver');
  const state = await createPractice(sessions, problem, 'python');
  const dir = path.join(sessions, state.id);
  await assert.rejects(switchLanguage(dir, problem, 'cobol'), /not available/);
  await assert.rejects(switchLanguage(dir, problem, 'express'), /not available/);
  const mock = await readPractice(dir);
  await writePractice(dir, {...mock, mock: 'interview-1'});
  await assert.rejects(switchLanguage(dir, problem, 'javascript'), /mock interview/);
  await writePractice(dir, {...mock, status: 'ended', endReason: 'submitted'});
  await assert.rejects(switchLanguage(dir, problem, 'javascript'), /submitted/);
}));
