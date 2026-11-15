// Live smoke test of a structured practice session against a running server.
// Plays Maze Solver end to end: run, fix the bug, pass phase 1, advance, ask
// the assistant, submit, debrief and print the feedback report.
// Usage: node scripts/practice-smoke.mjs [python|javascript]   (server on :3210)
// Python needs Docker. JavaScript runs are simulated through the API with the
// same runner the browser uses.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProject} from '../dist/runner-core.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = `http://127.0.0.1:${process.env.PORT || 3210}`;
const language = process.argv[2] || 'python';

async function call(url, data) {
  const response = await fetch(BASE + url, data ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)} : {});
  const result = await response.json();
  if (!response.ok) throw new Error(`${url}: ${result.error}`);
  return result;
}
async function wait(value) {
  if (!value?.job) return value;
  for (;;) {
    const state = await call('/api/job?id=' + value.job);
    if (state.status === 'done') return state.result;
    if (state.status === 'error') throw new Error(state.error);
    await new Promise(resolve => setTimeout(resolve, 800));
  }
}
async function run(id, target = 'tests') {
  if (language === 'python') return wait(await call('/api/practice/run', {id, target}));
  const bundle = await call('/api/practice/bundle?id=' + id);
  const output = [];
  const result = await runProject({files: bundle.files, mode: target === 'main' ? 'main' : 'tests', testFiles: bundle.tests, main: bundle.main}, event => { if (event.type === 'log') output.push(event.text); });
  return call('/api/practice/result', {id, target, results: result.results, exitCode: result.exitCode, ms: result.ms, output: output.join('')});
}
const show = (label, result) => console.log(label, JSON.stringify(result.summary?.phases), 'newly passed:', result.newlyPassed);

const pre = language === 'python' ? await wait(await call('/api/practice/preflight', {language})) : null;
if (pre) console.log('preflight', pre);
const session = await call('/api/practice/start', {problem: 'maze-solver', language});
const id = session.id;
console.log('session', id, session.files.length, 'files');
show('baseline run', await run(id));

const fixPath = language === 'python' ? 'maze/level.py' : 'src/level.js';
const fixed = await fs.readFile(path.join(ROOT, 'problems/maze-solver', language, 'solution/phase1', fixPath), 'utf8');
await call('/api/practice/event', {id, type: 'open', path: fixPath});
await call('/api/practice/file', {id, path: fixPath, content: fixed});
show('after fix', await run(id));

const advanced = await call('/api/practice/advance', {id});
console.log('advanced to phase', advanced.practice.unlocked, 'added', advanced.added);
const hint = await call('/api/practice/hint', {id});
console.log('hint', hint.index + 1, '/', hint.total, hint.hint.slice(0, 80));

try {
  const response = await fetch(BASE + '/api/practice/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id, message: `In ${fixPath}, what does the moves_from / movesFrom method return? One sentence.`, openFile: fixPath})});
  const text = await response.text();
  const reply = text.split('\n').filter(Boolean).map(line => JSON.parse(line)).map(part => part.delta || '').join('');
  console.log('assistant:', reply.slice(0, 160).replace(/\s+/g, ' '));
} catch (error) { console.log('assistant unavailable:', error.message); }

await call('/api/practice/submit', {id});
const reviewed = await wait(await call('/api/practice/debrief', {id, answers: [
  'The bounds check compared the column to the height instead of the width, so non-square levels broke. Every original fixture was square, so the tests never exercised it.',
  'I would BFS between every pair of stops, keeping directional legs because gates are one-way, then try every permutation of gems. That is O(k! * k) plus the BFS work.',
  'I did not get to phase three in this smoke run.'
]}));
const report = reviewed.report;
console.log('verdict', report.verdict, report.average, 'by', report.generatedBy);
for (const area of report.areas) console.log(' ', area.label, area.score, '-', area.summary.slice(0, 110));
console.log('top fixes:', report.topFixes);
