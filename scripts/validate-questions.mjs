// Validates coding questions through the real Docker judge. See questions/AUTHORING.md.
// Usage: node scripts/validate-questions.mjs [question-id ...] [--lang=python,java]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {QUESTIONS_DIR, CODE_LANGUAGES, TEMPLATE_FILES, validateQuestion, readTests} from '../coding.mjs';
import {judge, normalizeOutput, JUDGE_LANGUAGES} from '../judge.mjs';

function run(command, args, {timeout = 60000} = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, {windowsHide: true});
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', d => { output = (output + d).slice(-60000); });
    child.stderr.on('data', d => { output = (output + d).slice(-60000); });
    child.on('error', error => { clearTimeout(timer); resolve({code: -1, output: String(error), timedOut}); });
    child.on('close', code => { clearTimeout(timer); resolve({code, output, timedOut}); });
  });
}

const args = process.argv.slice(2);
const langArg = args.find(a => a.startsWith('--lang='));
const languages = langArg ? langArg.slice(7).split(',') : CODE_LANGUAGES;
let ids = args.filter(a => !a.startsWith('--'));
if (!ids.length) ids = (await fs.readdir(QUESTIONS_DIR, {withFileTypes: true})).filter(e => e.isDirectory()).map(e => e.name).sort();
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-questions-'));
let failed = 0;

for (const id of ids) {
  const errors = [], notes = [];
  const dir = path.join(QUESTIONS_DIR, id);
  let q;
  try { q = JSON.parse(await fs.readFile(path.join(dir, 'question.json'), 'utf8')); }
  catch (error) { errors.push(`question.json: ${error.message}`); }
  if (q) {
    errors.push(...validateQuestion(q, id).map(e => `schema: ${e}`));
    for (const language of CODE_LANGUAGES) for (const kind of ['templates', 'solutions']) {
      try { await fs.access(path.join(dir, kind, TEMPLATE_FILES[language])); } catch { errors.push(`missing ${kind}/${TEMPLATE_FILES[language]}`); }
    }
    let tests = [];
    try { tests = await readTests(q); } catch (error) { errors.push(`tests: ${error.message}`); }
    const samples = tests.filter(t => t.sample);
    q.samples?.forEach((s, i) => {
      if (!samples[i]) return;
      if (normalizeOutput(s.input) !== normalizeOutput(samples[i].input)) errors.push(`samples[${i}].input differs from its sample test file`);
      if (normalizeOutput(s.output) !== normalizeOutput(samples[i].expected)) errors.push(`samples[${i}].output differs from its sample test file`);
    });
    const sizes = tests.map(t => t.input.length);
    notes.push(`${tests.length} tests (${samples.length} sample), largest input ${(Math.max(0, ...sizes) / 1024).toFixed(0)} KB`);
    if (!errors.length) for (const language of languages) {
      const limit = JUDGE_LANGUAGES[language].limit;
      try {
        const template = await fs.readFile(path.join(dir, 'templates', TEMPLATE_FILES[language]), 'utf8');
        const solution = await fs.readFile(path.join(dir, 'solutions', TEMPLATE_FILES[language]), 'utf8');
        const stub = await judge(run, {language, code: template, cases: tests, scratch});
        if (stub.compiled && stub.passed === stub.total) errors.push(`${language}: the template passes every test`);
        const good = await judge(run, {language, code: solution, cases: tests, scratch});
        if (!good.compiled) { errors.push(`${language}: solution does not compile: ${good.compileMessage.slice(0, 300)}`); continue; }
        const bad = good.tests.filter(t => t.status !== 'success');
        if (bad.length) errors.push(`${language}: solution fails ${bad.length} test(s): ${bad.slice(0, 3).map(t => `${t.name} ${t.verdict}${t.stderr ? ' — ' + t.stderr.split('\n')[0].slice(0, 120) : ''}`).join('; ')}`);
        const slowest = Math.max(0, ...good.tests.map(t => t.ms ?? 0));
        if (slowest > limit * 500) errors.push(`${language}: slowest test took ${slowest} ms, more than half the ${limit}s limit`);
        notes.push(`${language}: template ${stub.compiled ? `${stub.passed}/${stub.total}` : 'compile error'}, solution ${good.passed}/${good.total}, slowest ${slowest} ms`);
      } catch (error) { errors.push(`${language}: ${error.message}`); }
    }
  }
  console.log(`\n${errors.length ? '✗' : '✓'} ${id}`);
  for (const note of notes) console.log(`    · ${note}`);
  for (const error of errors) console.log(`    ✗ ${error}`);
  if (errors.length) failed++;
}
await fs.rm(scratch, {recursive: true, force: true});
console.log(`\n${ids.length - failed}/${ids.length} questions valid`);
process.exit(failed ? 1 : 0);
