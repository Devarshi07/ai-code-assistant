// Validates open-ended tasks. See open-tasks/AUTHORING.md.
// Usage: node scripts/validate-open-tasks.mjs [task-id ...]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readTree} from '../problems.mjs';
import {TASKS_DIR, validateTask} from '../open-ended.mjs';
import {parseResults} from '../sandbox.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const NAMES = {python: {public: 'tests/test_public.py', hidden: 'tests/test_acceptance.py'}, javascript: {public: 'tests/public.test.js', hidden: 'tests/acceptance.test.js'}};

function run(command, args, cwd, timeout) {
  return new Promise(resolve => {
    const child = spawn(command, args, {cwd, windowsHide: true, env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', NODE_TEST_CONTEXT: ''}});
    let out = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => { clearTimeout(timer); resolve({out, code, timedOut}); });
  });
}

async function execute(language, dir, files) {
  if (language === 'javascript') {
    const result = await run(process.execPath, [path.join(ROOT, 'scripts', 'run-js.mjs'), dir, 'tests', ...files], ROOT, 90000);
    try { return JSON.parse(result.out).results; } catch { return [{file: files[0], name: 'runner crashed', status: 'error', message: result.out.slice(-300)}]; }
  }
  const result = await run(PYTHON, [path.join(ROOT, 'harness', 'pyrunner.py'), 'tests', ...files], dir, 120000);
  return parseResults(result.out).results;
}

async function stage(taskDir, language, parts) {
  const files = {};
  for (const part of parts) Object.assign(files, await readTree(path.join(taskDir, language, part)));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-open-'));
  for (const [name, text] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(name)), {recursive: true});
    await fs.writeFile(path.join(dir, name), text);
  }
  return {dir, files};
}

const count = (results, file) => {
  const rows = results.filter(r => r.file === file && r.status !== 'skip');
  return {pass: rows.filter(r => r.status === 'pass').length, total: rows.length, failures: rows.filter(r => r.status !== 'pass').map(r => `${r.name}: ${String(r.message || r.status).split('\n')[0].slice(0, 150)}`)};
};

async function validate(id) {
  const taskDir = path.join(TASKS_DIR, id);
  const report = {errors: [], notes: []};
  let task;
  try { task = JSON.parse(await fs.readFile(path.join(taskDir, 'task.json'), 'utf8')); }
  catch (error) { report.errors.push(`task.json: ${error.message}`); return report; }
  report.errors.push(...validateTask(task, id).map(e => `schema: ${e}`));
  for (const language of task.languages || []) {
    const names = NAMES[language];
    if (!names) continue;
    const starter = await stage(taskDir, language, ['starter', 'hidden']);
    const solved = await stage(taskDir, language, ['starter', 'hidden', 'solution']);
    try {
      const own = await readTree(path.join(taskDir, language, 'starter'));
      if (!own['README.md']) report.errors.push(`${language}: starter/README.md missing`);
      if (!own[names.public]) report.errors.push(`${language}: starter/${names.public} missing`);
      if (own[names.hidden]) report.errors.push(`${language}: hidden tests must not be in starter/`);
      if (!starter.files[names.hidden]) report.errors.push(`${language}: hidden/${names.hidden} missing`);
      if (language === 'javascript') {
        try { if (JSON.parse(own['package.json'] || '{}').type !== 'commonjs') report.errors.push('javascript: starter/package.json must set "type": "commonjs"'); }
        catch { report.errors.push('javascript: starter/package.json is not valid JSON'); }
      }
      if (report.errors.some(e => e.startsWith(language))) continue;
      const before = await execute(language, starter.dir, [names.public, names.hidden]);
      const after = await execute(language, solved.dir, [names.public, names.hidden]);
      const bp = count(before, names.public), bh = count(before, names.hidden), ap = count(after, names.public), ah = count(after, names.hidden);
      if (bp.total < 4) report.errors.push(`${language}: needs at least 4 provided tests (found ${bp.total})`);
      if (bh.total < 15) report.errors.push(`${language}: needs at least 15 hidden tests (found ${bh.total})`);
      if (bp.pass === bp.total) report.errors.push(`${language}: provided tests should fail on the stubbed starter`);
      if (bh.total && bh.pass / bh.total > 0.2) report.errors.push(`${language}: ${bh.pass}/${bh.total} hidden tests pass on the stubbed starter`);
      if (ap.pass !== ap.total) report.errors.push(`${language}: solution fails provided tests:\n      ${ap.failures.slice(0, 4).join('\n      ')}`);
      if (ah.pass !== ah.total || !ah.total) report.errors.push(`${language}: solution fails hidden tests:\n      ${ah.failures.slice(0, 4).join('\n      ')}`);
      report.notes.push(`${language}: ${ap.total} provided + ${ah.total} hidden tests; starter passes ${bp.pass} + ${bh.pass}; solution passes ${ap.pass} + ${ah.pass}`);
    } finally {
      await fs.rm(starter.dir, {recursive: true, force: true});
      await fs.rm(solved.dir, {recursive: true, force: true});
    }
  }
  return report;
}

const requested = process.argv.slice(2);
let ids = requested;
if (!ids.length) { try { ids = (await fs.readdir(TASKS_DIR, {withFileTypes: true})).filter(e => e.isDirectory()).map(e => e.name).sort(); } catch { ids = []; } }
let failed = 0;
for (const id of ids) {
  const report = await validate(id);
  console.log(`\n${report.errors.length ? '✗' : '✓'} ${id}`);
  for (const note of report.notes) console.log(`    · ${note}`);
  for (const error of report.errors) console.log(`    ✗ ${error}`);
  if (report.errors.length) failed++;
}
console.log(`\n${ids.length - failed}/${ids.length} tasks valid`);
process.exit(failed ? 1 : 0);
