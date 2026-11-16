// HackerRank-style judge: compiles a single-file program once, then runs each
// test case from stdin in a disposable, network-less container and compares
// stdout with the expected output (ignoring trailing whitespace).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

// version and memory (MB) are shown in the editor's execution-environment panel.
export const JUDGE_LANGUAGES = {
  python: {label: 'Python 3', version: 'Python 3.12', image: 'python:3.12-slim', file: 'solution.py', run: 'python3 -X utf8 /code/solution.py', limit: 10, memory: 768, notes: 'Standard library only.'},
  javascript: {label: 'JavaScript (Node.js)', version: 'Node.js 22', image: 'node:22-alpine', file: 'solution.js', run: 'node --stack-size=65500 /code/solution.js', limit: 10, memory: 768, notes: 'CommonJS, standard library only.'},
  java: {label: 'Java 21', version: 'Java 21 (Eclipse Temurin), javac', image: 'eclipse-temurin:21-jdk-alpine', file: 'Solution.java', compile: 'javac -encoding UTF-8 -d /tmp/build /code/Solution.java', run: 'java -Xss64m -Xmx512m -XX:+UseSerialGC -cp /tmp/build Solution', limit: 4, memory: 512, notes: 'The public class must be named Solution.'},
  cpp: {label: 'C++20', version: 'g++ 14, -std=c++20 -O2', image: 'gcc:14', file: 'solution.cpp', compile: 'g++ -O2 -std=c++20 -pipe -o /tmp/build/solution /code/solution.cpp', run: '/tmp/build/solution', limit: 2, memory: 768, notes: 'bits/stdc++.h is available.'},
  go: {label: 'Go', version: 'Go 1.24', image: 'golang:1.24-alpine', file: 'solution.go', compile: 'cp /code/solution.go /tmp/build/main.go && cd /tmp/build && go build -o /tmp/build/solution main.go', run: '/tmp/build/solution', limit: 4, memory: 768, notes: 'Standard library only.'}
};

export const VERDICTS = {
  success: 'Success', wrong: 'Wrong Answer', runtime: 'Runtime Error', timeout: 'Terminated due to timeout', compile: 'Compilation error', output: 'Output limit exceeded'
};

export function normalizeOutput(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n').map(line => line.replace(/\s+$/, ''));
  while (lines.length && lines.at(-1) === '') lines.pop();
  return lines.join('\n');
}

const clip = (text, limit = 65536) => text.length > limit ? text.slice(0, limit) + `\n… (${(text.length - limit).toLocaleString()} more characters)` : text;

// The script that runs inside the container. Test names are validated before use.
function script(spec, names) {
  return [
    'mkdir -p /tmp/build /tmp/run',
    spec.compile ? `( ${spec.compile} ) > /out/compile.txt 2>&1; echo $? > /out/compile.code` : 'echo 0 > /out/compile.code',
    'if [ "$(cat /out/compile.code)" != "0" ]; then exit 0; fi',
    // Programs write to tmpfs: every flush to the bind-mounted /out is slow on
    // Docker Desktop, which would punish line-by-line output. Results move to
    // /out after the timed run. 20 MB output cap per test; uptime gives wall
    // time without depending on date +%N.
    `for t in ${names.join(' ')}; do`,
    '  cut -d" " -f1 /proc/uptime > /tmp/run/$t.start',
    `  ( ulimit -f 20480; timeout -s KILL ${spec.limit} sh -c '${spec.run}' < /tests/$t.in > /tmp/run/$t.out 2> /tmp/run/$t.err ); echo $? > /tmp/run/$t.code`,
    '  cut -d" " -f1 /proc/uptime > /tmp/run/$t.end',
    '  mv /tmp/run/$t.start /tmp/run/$t.end /tmp/run/$t.code /tmp/run/$t.out /tmp/run/$t.err /out/',
    'done'
  ].join('\n');
}

// cases: [{name, input, expected?, sample?, weight?, hidden?}]
export async function judge(run, {language, code, cases, scratch = os.tmpdir(), onProgress = () => {}}) {
  const spec = JUDGE_LANGUAGES[language];
  if (!spec) throw new Error('Choose a supported language.');
  if (typeof code !== 'string' || !code.trim()) throw new Error('Write some code first.');
  if (code.length > 200000) throw new Error('Code is too long (200 KB limit).');
  if (!cases.length) throw new Error('No test cases to run.');
  const id = randomUUID();
  const root = path.join(scratch, `judge-${id}`);
  const dirs = {code: path.join(root, 'code'), tests: path.join(root, 'tests'), out: path.join(root, 'out')};
  for (const dir of Object.values(dirs)) await fs.mkdir(dir, {recursive: true});
  const names = cases.map((_, i) => `t${i}`);
  await fs.writeFile(path.join(dirs.code, spec.file), code);
  // Inputs always use LF line endings, whatever the test files were saved with.
  await Promise.all(cases.map((c, i) => fs.writeFile(path.join(dirs.tests, `${names[i]}.in`), String(c.input ?? '').replace(/\r\n/g, '\n'))));
  const name = `dg-judge-${id}`;
  const args = ['run', '--rm', '--name', name, '--network', 'none', '--memory', '768m', '--cpus', '1', '--pids-limit', '128', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
    '--tmpfs', '/tmp:rw,exec,nosuid,size=512m', '-e', 'HOME=/tmp', '-e', 'GOCACHE=/gocache', '-e', 'GOPATH=/tmp/go', '-e', 'CGO_ENABLED=0', '-e', 'GOFLAGS=-buildvcs=false', '-e', 'PYTHONDONTWRITEBYTECODE=1',
    '--mount', `type=bind,source=${dirs.code},target=/code,readonly`, '--mount', `type=bind,source=${dirs.tests},target=/tests,readonly`, '--mount', `type=bind,source=${dirs.out},target=/out`,
    // A persistent build cache keeps Go compiles to about a second after the first run.
    ...(language === 'go' ? ['--mount', 'type=volume,source=dg-judge-gocache,target=/gocache'] : []),
    '--entrypoint', '/bin/sh', spec.image, '-c', script(spec, names)];
  try {
    onProgress(spec.compile ? 'Compiling…' : 'Running…');
    const result = await run('docker', args, {timeout: 90000 + cases.length * (spec.limit + 2) * 1000});
    const read = async file => { try { return await fs.readFile(path.join(dirs.out, file), 'utf8'); } catch { return null; } };
    const compileCode = (await read('compile.code'))?.trim();
    if (compileCode === undefined || compileCode === null) {
      const text = result.output || '';
      if (/Unable to find image|pull access denied|Cannot connect to the Docker daemon|error during connect/i.test(text)) throw new Error('Docker could not start the judge: ' + text.slice(-300));
      throw new Error('The judge did not run: ' + (text.slice(-400) || 'no output'));
    }
    const compileMessage = clip((await read('compile.txt')) || '', 20000);
    if (compileCode !== '0') {
      return {language, compiled: false, compileMessage: compileMessage || 'Compilation failed.', tests: cases.map((c, i) => ({name: c.name, index: i, sample: !!c.sample, hidden: !!c.hidden, status: 'compile', verdict: VERDICTS.compile, ms: 0})), score: 0, passed: 0, total: cases.length};
    }
    const tests = [];
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i], t = names[i];
      const exit = Number((await read(`${t}.code`))?.trim() ?? -1);
      const stdout = (await read(`${t}.out`)) ?? '';
      const stderr = (await read(`${t}.err`)) ?? '';
      const start = parseFloat(await read(`${t}.start`)), end = parseFloat(await read(`${t}.end`));
      const ms = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) * 1000)) : null;
      let status;
      if (exit === 137 || exit === 124) status = 'timeout';
      else if (exit === 153 || /File size limit exceeded/i.test(stderr)) status = 'output';
      else if (exit !== 0) status = 'runtime';
      else if (c.expected === undefined || c.expected === null) status = 'success';
      else status = normalizeOutput(stdout) === normalizeOutput(c.expected) ? 'success' : 'wrong';
      tests.push({
        name: c.name, index: i, sample: !!c.sample, hidden: !!c.hidden, custom: !!c.custom, status, verdict: VERDICTS[status], ms, exitCode: exit, weight: c.weight ?? 1,
        // Hidden test inputs and expected outputs stay hidden, like on HackerRank.
        ...(c.hidden ? {} : {input: clip(c.input ?? '', 20000), expected: c.expected === undefined || c.expected === null ? undefined : clip(c.expected, 20000)}),
        stdout: clip(stdout, c.hidden ? 4000 : 65536), stderr: clip(stderr, 8000)
      });
    }
    const totalWeight = tests.reduce((s, t) => s + (t.weight || 1), 0);
    const earned = tests.filter(t => t.status === 'success').reduce((s, t) => s + (t.weight || 1), 0);
    return {language, compiled: true, compileMessage, tests, passed: tests.filter(t => t.status === 'success').length, total: tests.length, fraction: totalWeight ? earned / totalWeight : 0};
  } finally {
    await run('docker', ['rm', '-f', name], {timeout: 10000}).catch(() => {});
    await fs.rm(root, {recursive: true, force: true}).catch(() => {});
  }
}

export async function ensureJudgeImage(run, language, progress = () => {}) {
  const spec = JUDGE_LANGUAGES[language];
  if (!spec) throw new Error('Choose a supported language.');
  const info = await run('docker', ['info', '--format', '{{.ServerVersion}}'], {timeout: 8000}).catch(() => ({code: 1, output: ''}));
  if (info.code !== 0 || !/^\d+\.\d+/m.test(info.output)) throw new Error('Docker is not running. Code runs in an isolated Docker container: start Docker Desktop and try again.');
  const exists = await run('docker', ['image', 'inspect', spec.image], {timeout: 10000});
  if (exists.code !== 0 || !exists.output.trim().startsWith('[')) {
    progress(`Downloading the ${spec.label} environment (${spec.image}). This happens once…`);
    const pulled = await run('docker', ['pull', spec.image], {timeout: 1800000});
    if (pulled.code !== 0) throw new Error(`Could not download ${spec.image}: ` + pulled.output.slice(-400));
  }
}
