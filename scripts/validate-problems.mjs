// Validates structured problems end to end. See problems/AUTHORING.md.
// Usage: node scripts/validate-problems.mjs [problem-id ...] [--lang=java,go]
// --lang checks only those languages (the schema is always checked in full),
// including a language problem.json does not list yet.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROBLEMS_DIR, LANGUAGES, readTree, validateProblem} from '../problems.mjs';
import {runStack, ensureStackImage} from '../stack-runner.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ONLY = process.argv.find(arg => arg.startsWith('--lang='))?.slice(7).split(',').filter(Boolean) || null;
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const MARK = '@@DGRESULT@@';

function run(command, args, cwd, timeout) {
  return new Promise(resolve => {
    const child = spawn(command, args, {cwd, windowsHide: true, env: {...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONHASHSEED: '0', NODE_TEST_CONTEXT: ''}});
    let out = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('error', error => { clearTimeout(timer); resolve({out: String(error), code: -1, timedOut}); });
    child.on('close', code => { clearTimeout(timer); resolve({out, code, timedOut}); });
  });
}

// Runs a command for the stack runner, which drives Docker.
function docker(command, args, {timeout = 60000} = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, {windowsHide: true});
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    child.stdout.on('data', d => { output = (output + d).slice(-400000); });
    child.stderr.on('data', d => { output = (output + d).slice(-400000); });
    child.on('error', error => { clearTimeout(timer); resolve({code: -1, output: String(error), timedOut}); });
    child.on('close', code => { clearTimeout(timer); resolve({code, output, timedOut}); });
  });
}

async function execute(language, dir, mode, targets) {
  // API projects run in their framework's Docker image, like the app runs them.
  if (LANGUAGES[language].runner === 'docker') {
    await ensureStackImage(docker, language, message => console.log(`    · ${message}`));
    return runStack(docker, {language, sourceDir: dir, mode, targets});
  }
  if (language === 'javascript') {
    const result = await run(process.execPath, [path.join(ROOT, 'scripts', 'run-js.mjs'), dir, mode, ...targets], ROOT, 60000);
    if (result.timedOut) return {timedOut: true, results: [], output: result.out};
    try { return JSON.parse(result.out); } catch { return {crashed: true, results: [], output: result.out}; }
  }
  const result = await run(PYTHON, [path.join(ROOT, 'harness', 'pyrunner.py'), mode, ...targets], dir, 120000);
  const results = [], output = [];
  let done = null;
  for (const line of result.out.split(/\r?\n/)) {
    const index = line.indexOf(MARK);
    if (index < 0) { output.push(line); continue; }
    if (index > 0) output.push(line.slice(0, index));
    const record = JSON.parse(line.slice(index + MARK.length));
    if (record.type === 'test') results.push(record); else done = record;
  }
  return {results, exitCode: done?.exitCode ?? (result.code === 0 ? 0 : 1), timedOut: result.timedOut, output: output.join('\n')};
}

async function stage(problemDir, language, overlays) {
  const files = {};
  for (const name of overlays) Object.assign(files, await readTree(path.join(problemDir, language, ...name.split('/'))));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-validate-'));
  for (const [name, text] of Object.entries(files)) {
    await fs.mkdir(path.join(dir, path.dirname(name)), {recursive: true});
    await fs.writeFile(path.join(dir, name), text);
  }
  return {dir, files};
}

const summarize = results => {
  const byFile = {};
  for (const r of results) {
    const entry = byFile[r.file] ||= {pass: 0, fail: 0, slowest: 0, failures: []};
    if (r.status === 'pass') entry.pass++;
    else if (r.status !== 'skip') { entry.fail++; entry.failures.push(`${r.name}: ${String(r.message || r.status).split('\n')[0].slice(0, 160)}`); }
    entry.slowest = Math.max(entry.slowest, r.ms || 0);
  }
  return byFile;
};

async function validate(id) {
  const problemDir = path.join(PROBLEMS_DIR, id);
  const report = {id, errors: [], notes: []};
  let problem;
  try { problem = JSON.parse(await fs.readFile(path.join(problemDir, 'problem.json'), 'utf8')); }
  catch (error) { report.errors.push(`problem.json: ${error.message}`); return report; }
  report.errors.push(...validateProblem(problem, id).map(e => `schema: ${e}`));
  // --lang can also check a language that problem.json doesn't list yet, so a
  // port is validated before the app offers it.
  const languages = [...new Set([...(problem.languages || []), ...(ONLY || []).filter(l => LANGUAGES[l])])];
  for (const language of languages) {
    if (!LANGUAGES[language] || (ONLY && !ONLY.includes(language))) continue;
    if (!(problem.languages || []).includes(language)) report.notes.push(`${language}: not listed in problem.json yet (checked because of --lang)`);
    const lang = LANGUAGES[language];
    const tests = [1, 2, 3].map(lang.test);
    const tag = `${language}`;
    const stages = {
      starter: ['starter'],
      fix: ['starter', 'solution/phase1'],
      fixWithPhase2: ['starter', 'phase2', 'solution/phase1'],
      phase2: ['starter', 'phase2', 'solution/phase1', 'solution/phase2'],
      phase2WithPhase3: ['starter', 'phase2', 'phase3', 'solution/phase1', 'solution/phase2'],
      final: ['starter', 'phase2', 'phase3', 'solution/phase1', 'solution/phase2', 'solution/phase3']
    };
    const made = {};
    try {
      for (const [name, overlays] of Object.entries(stages)) made[name] = await stage(problemDir, language, overlays);
      const starter = made.starter.files;
      if (lang.main && !starter[lang.main]) report.errors.push(`${tag}: starter is missing ${lang.main}`);
      if (!starter['README.md']) report.errors.push(`${tag}: starter is missing README.md`);
      if (!starter[tests[0]]) report.errors.push(`${tag}: starter is missing ${tests[0]}`);
      if (starter[tests[1]] || starter[tests[2]]) report.errors.push(`${tag}: phase 2/3 tests must not be in starter/`);
      if (!made.phase2.files[tests[1]]) report.errors.push(`${tag}: phase2/ is missing ${tests[1]}`);
      if (!made.final.files[tests[2]]) report.errors.push(`${tag}: phase3/ is missing ${tests[2]}`);
      const sourceLines = Object.entries(starter).filter(([n]) => n.endsWith(lang.ext) && !lang.canonical(n)).reduce((sum, [, t]) => sum + t.split('\n').length, 0);
      const sourceFiles = Object.keys(starter).filter(n => n.endsWith(lang.ext) && !lang.canonical(n)).length;
      report.notes.push(`${tag}: starter has ${sourceFiles} source files, ${sourceLines} lines`);
      for (const [name, text] of Object.entries(made.final.files)) if (text.length > 100000) report.errors.push(`${tag}: ${name} is larger than 100 KB`);
      if (report.errors.some(e => e.startsWith(tag))) continue;

      const check = async (stageName, files, expect) => {
        const result = await execute(language, made[stageName].dir, 'tests', files);
        if (result.timedOut) { report.errors.push(`${tag} ${stageName}: run timed out`); return; }
        if (result.crashed) { report.errors.push(`${tag} ${stageName}: runner crashed: ${result.output.slice(-400)}`); return; }
        const byFile = summarize(result.results);
        for (const [file, want] of Object.entries(expect)) {
          const got = byFile[file] || {pass: 0, fail: 0, failures: [], slowest: 0};
          const total = got.pass + got.fail;
          if (!total) { report.errors.push(`${tag} ${stageName}: ${file} reported no tests. Output: ${result.output.slice(-300)}`); continue; }
          if (want === 'pass' && got.fail) report.errors.push(`${tag} ${stageName}: ${file} should pass but ${got.fail}/${total} failed:\n      ${got.failures.slice(0, 4).join('\n      ')}`);
          if (want === 'fail' && !got.fail) report.errors.push(`${tag} ${stageName}: ${file} should fail but all ${total} passed`);
          if (want === 'partial') {
            if (!got.fail) report.errors.push(`${tag} ${stageName}: ${file} should fail on the starter but all ${total} passed`);
            if (!got.pass) report.notes.push(`${tag} ${stageName}: warning: no phase-1 test passes on the starter`);
          }
          if (file === tests[2]) report.notes.push(`${tag} ${stageName}: ${file} ${got.pass}/${total} pass, slowest test ${got.slowest} ms${got.fail ? ` (fails: ${got.failures.slice(0, 2).join(' | ')})` : ''}`);
        }
      };
      await check('starter', [tests[0]], {[tests[0]]: 'partial'});
      await check('fix', [tests[0]], {[tests[0]]: 'pass'});
      await check('fixWithPhase2', [tests[1]], {[tests[1]]: 'fail'});
      await check('phase2', [tests[0], tests[1]], {[tests[0]]: 'pass', [tests[1]]: 'pass'});
      await check('phase2WithPhase3', [tests[2]], {[tests[2]]: 'fail'});
      await check('final', tests, {[tests[0]]: 'pass', [tests[1]]: 'pass', [tests[2]]: 'pass'});
      const main = lang.main ? await execute(language, made.final.dir, 'main', [lang.main]) : null;
      if (!main) report.notes.push(`${tag} final: no demo entry point for this stack`);
      else if (main.timedOut || main.exitCode !== 0) report.errors.push(`${tag} final: ${lang.main} exited with ${main.timedOut ? 'a timeout' : main.exitCode}: ${String(main.output).slice(-400)}`);
      else report.notes.push(`${tag} final: ${lang.main} printed ${String(main.output).split('\n').length} lines`);
    } finally {
      for (const value of Object.values(made)) await fs.rm(value.dir, {recursive: true, force: true});
    }
  }
  return report;
}

const requested = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const ids = requested.length ? requested : (await fs.readdir(PROBLEMS_DIR, {withFileTypes: true})).filter(e => e.isDirectory()).map(e => e.name).sort();
let failed = 0;
for (const id of ids) {
  const report = await validate(id);
  console.log(`\n${report.errors.length ? '✗' : '✓'} ${id}`);
  for (const note of report.notes) console.log(`    · ${note}`);
  for (const error of report.errors) console.log(`    ✗ ${error}`);
  if (report.errors.length) failed++;
}
console.log(`\n${ids.length - failed}/${ids.length} problems valid`);
process.exit(failed ? 1 : 0);
