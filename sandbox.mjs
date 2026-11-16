// Runs Python practice code in a network-less Docker container with the
// shared harness, and parses its structured results. With a sandbox pool and a
// key, runs reuse a warm container for the session instead of starting one.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {RESET_WORK} from './warm-sandbox.mjs';

const HARNESS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'harness');
const MARK = '@@DGRESULT@@';
export const PY_IMAGE = 'python:3.12-slim';

// Checking Docker and the image takes a few hundred milliseconds, so a success is remembered for ten minutes.
let readyAt = 0;
export async function ensurePythonImage(run, progress = () => {}) {
  if (Date.now() - readyAt < 600000) return {ready: true};
  const info = await run('docker', ['info', '--format', '{{.ServerVersion}}'], {timeout: 8000}).catch(() => ({code: 1, output: ''}));
  if (info.code !== 0 || !/^\d+\.\d+/m.test(info.output)) throw new Error('Docker is not running. Python code runs in an isolated Docker container: start Docker Desktop and try again, or practise in JavaScript, which runs in your browser.');
  const exists = await run('docker', ['image', 'inspect', PY_IMAGE], {timeout: 10000});
  if (exists.code !== 0 || !exists.output.trim().startsWith('[')) {
    progress(`Downloading the Python sandbox (${PY_IMAGE}). This happens once…`);
    const pulled = await run('docker', ['pull', PY_IMAGE], {timeout: 1800000});
    if (pulled.code !== 0) throw new Error('Could not download the Python image: ' + pulled.output.slice(-500));
  }
  readyAt = Date.now();
  return {ready: true};
}

export function parseResults(text) {
  const results = [], output = [];
  let done = null;
  for (const line of String(text).split(/\r?\n/)) {
    const index = line.indexOf(MARK);
    if (index < 0) { output.push(line); continue; }
    if (index > 0) output.push(line.slice(0, index));
    try {
      const record = JSON.parse(line.slice(index + MARK.length));
      if (record.type === 'test') results.push(record); else done = record;
    } catch { output.push(line); }
  }
  return {results, done, output: output.join('\n').replace(/\n+$/, '')};
}

// The warm container for a practice session: workspace, canonical tests and the harness.
export const pythonSpec = (key, sourceDir, overlayDir) => ({key, image: PY_IMAGE, mounts: [
  {source: sourceDir, target: '/candidate'}, ...(overlayDir ? [{source: overlayDir, target: '/canonical'}] : []), {source: HARNESS, target: '/dg'}]});

// sourceDir is copied first, then overlayDir (canonical tests) on top of it.
export async function runPython(run, {sourceDir, overlayDir, mode = 'tests', targets, timeout = 90000, pool = null, key = null}) {
  for (const name of targets) if (!/^[\w./-]+$/.test(name) || name.includes('..')) throw new Error('Unsupported file name for the runner.');
  const copy = `cp -R /candidate/. /work/ && ${overlayDir ? 'cp -R /canonical/. /work/ && ' : ''}cd /work`;
  const command = `python /dg/pyrunner.py ${mode === 'main' ? 'main' : 'tests'} ${targets.map(t => `'${t}'`).join(' ')}`;
  const started = Date.now();
  let result;
  if (pool && key) {
    result = await pool.exec(pythonSpec(key, sourceDir, overlayDir), `${RESET_WORK}; ${copy} && ${command}`, {timeout, env: {PYTHONHASHSEED: '0', PYTHONUNBUFFERED: '1'}});
  } else {
    const name = `dg-practice-${randomUUID()}`;
    const mounts = ['--mount', `type=bind,source=${sourceDir},target=/candidate,readonly`, '--mount', `type=bind,source=${HARNESS},target=/dg,readonly`];
    if (overlayDir) mounts.push('--mount', `type=bind,source=${overlayDir},target=/canonical,readonly`);
    const args = ['run', '--rm', '--name', name, '--network', 'none', '--memory', '1g', '--cpus', '2', '--pids-limit', '256', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
      '--tmpfs', '/tmp:rw,nosuid,size=256m', '--tmpfs', '/work:rw,nosuid,size=512m', '-e', 'HOME=/tmp', '-e', 'PYTHONDONTWRITEBYTECODE=1', '-e', 'PYTHONHASHSEED=0', '-e', 'PYTHONUNBUFFERED=1',
      ...mounts, '--entrypoint', '/bin/sh', PY_IMAGE, '-c', `${copy} && exec ${command}`];
    try { result = await run('docker', args, {timeout}); }
    finally { await run('docker', ['rm', '-f', name], {timeout: 10000}).catch(() => {}); }
  }
  const parsed = parseResults(result.output);
  if (!parsed.done && !parsed.results.length && /docker|daemon|Unable to find image/i.test(parsed.output)) throw new Error('The Python sandbox could not start: ' + parsed.output.slice(-400));
  const failed = parsed.results.some(r => r.status === 'fail' || r.status === 'error');
  return {
    results: parsed.results,
    output: result.timedOut ? parsed.output + `\n[Stopped: the run exceeded ${Math.round(timeout / 1000)} seconds]` : parsed.output,
    exitCode: parsed.done?.exitCode ?? (failed ? 1 : result.code),
    ms: Date.now() - started, timedOut: result.timedOut, tests: targets
  };
}
