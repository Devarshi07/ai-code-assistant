// Measures the timed part of a guided problem's phase-3 tests, for
// calibrating limits (see "Phase 3 timing" in problems/AUTHORING.md).
// The validator only reports whole-test times, which include setup and
// warm-up. This runs the phase-3 tests against the optimized solution with
// every time comparison forced to fail, so each failure message reports the
// measured time, and against the phase-2 solution unchanged.
// Usage: node scripts/measure-phase3.mjs <problem-id> [--lang=typescript,java,go] [--runs=3] [--untimed]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {PROBLEMS_DIR, LANGUAGES, readTree} from '../problems.mjs';
import {runStack, ensureStackImage} from '../stack-runner.mjs';

const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
// By default, every language of the problem that runs in Docker (Python and
// JavaScript guided problems run elsewhere: use validate-problems.mjs for them).
const listed = id ? JSON.parse(await fs.readFile(path.join(PROBLEMS_DIR, id, 'problem.json'), 'utf8')).languages : [];
const langs = (args.find(a => a.startsWith('--lang='))?.slice(7).split(',') || listed).filter(l => LANGUAGES[l]?.runner === 'docker');
const runs = Number(args.find(a => a.startsWith('--runs='))?.slice(7)) || 1;
if (!id) { console.error('Usage: node scripts/measure-phase3.mjs <problem-id> [--lang=...] [--runs=N]'); process.exit(2); }

function docker(command, list, {timeout = 60000} = {}) {
  return new Promise(resolve => {
    const child = spawn(command, list, {windowsHide: true});
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', d => { output = (output + d).slice(-400000); });
    child.stderr.on('data', d => { output = (output + d).slice(-400000); });
    child.on('error', error => { clearTimeout(timer); resolve({code: -1, output: String(error), timedOut}); });
    child.on('close', code => { clearTimeout(timer); resolve({code, output, timedOut}); });
  });
}

// Forces the time checks to fail, by language family: "elapsed < LIMIT"
// (TypeScript, Express, Java, Spring), "elapsed >= limit" (Go) and
// "assertLess(elapsed, LIMIT" (Django, FastAPI).
const FORCE = {
  javascript: text => text.replace(/\b(elapsed\w*)\s*<\s*[\w.]+/g, '$1 < 0'),
  java: text => text.replace(/\b(elapsed\w*)\s*<\s*[\w.]+/g, '$1 < 0'),
  go: text => text.replace(/\b(elapsed\w*)\s*>=\s*[\w.]+/g, '$1 >= 0'),
  python: text => text.replace(/assertLess\(\s*(elapsed\w*)\s*,\s*[\w.]+/g, 'assertLess($1, 0')
};
// With --untimed, the phase-2 solution also runs with every time comparison
// forced to pass, so any failure left is a wrong result: a check that expected
// values computed with the optimized solution agree with the plain one.
const RELAX = {
  javascript: text => text.replace(/\b(elapsed\w*)\s*<\s*[\w.]+/g, '$1 < Infinity'),
  java: text => text.replace(/\b(elapsed\w*)\s*<\s*[\w.]+/g, '$1 < Double.MAX_VALUE'),
  go: text => text.replace(/\b(elapsed\w*)\s*>=\s*[\w.]+/g, '$1 >= 1<<62'),
  python: text => text.replace(/assertLess\(\s*(elapsed\w*)\s*,\s*[\w.]+/g, "assertLess($1, float('inf')")
};
const untimed = args.includes('--untimed');

async function stage(language, overlays, patch) {
  const files = {};
  for (const name of overlays) Object.assign(files, await readTree(path.join(PROBLEMS_DIR, id, language, ...name.split('/'))));
  const test = LANGUAGES[language].test(3);
  if (patch) files[test] = (patch === 'relax' ? RELAX : FORCE)[LANGUAGES[language].family](files[test]);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-measure-'));
  for (const [name, text] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(name)), {recursive: true});
    await fs.writeFile(path.join(dir, name), text);
  }
  return {dir, test};
}

const numbers = text => String(text).split('\n')[0].slice(0, 220);
for (const language of langs) {
  await ensureStackImage(docker, language);
  for (const [label, overlays, patch] of [
    ['optimized', ['starter', 'phase2', 'phase3', 'solution/phase1', 'solution/phase2', 'solution/phase3'], true],
    ['phase 2  ', ['starter', 'phase2', 'phase3', 'solution/phase1', 'solution/phase2'], false],
    ...(untimed ? [['untimed  ', ['starter', 'phase2', 'phase3', 'solution/phase1', 'solution/phase2'], 'relax']] : [])
  ]) {
    if (patch === 'relax') {
      const {dir, test} = await stage(language, overlays, patch);
      try {
        const result = await runStack(docker, {language, sourceDir: dir, mode: 'tests', targets: [test]});
        const bad = result.results.filter(r => r.status !== 'pass');
        console.log(`${id} ${language.padEnd(10)} ${label} phase-2 solution with no time limits: ${result.results.length - bad.length}/${result.results.length} pass${bad.length ? ` — ${bad.map(r => `[${r.name}] ${numbers(r.message)}`).join(' | ')}` : ''}${result.timedOut ? ' (run timed out)' : ''}`);
      } finally { await fs.rm(dir, {recursive: true, force: true}); }
      continue;
    }
    for (let n = 1; n <= runs; n++) {
      const {dir, test} = await stage(language, overlays, patch);
      try {
        const result = await runStack(docker, {language, sourceDir: dir, mode: 'tests', targets: [test]});
        const timed = result.results.filter(r => r.status !== 'pass' && /\d+(\.\d+)?\s*m?s\b/.test(r.message || ''));
        const other = result.results.filter(r => r.status !== 'pass' && !timed.includes(r));
        console.log(`${id} ${language.padEnd(10)} ${label} run ${n}: ${timed.map(r => `[${r.name}] ${numbers(r.message)}`).join(' | ') || '(no timed failures)'}${patch && other.length ? `  !! other failures: ${other.map(r => r.name).join(', ')}` : ''}`);
      } finally { await fs.rm(dir, {recursive: true, force: true}); }
    }
  }
}
