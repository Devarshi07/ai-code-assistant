// One interface over the two kinds of code-repo workspace: guided practice
// problems ("practice") and real-world or imported repositories ("repo").
// The repo workspace UI and the AI agent both use it for files, diffs
// against the starting code, sandboxed terminal commands and tests.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {getProblem, overlay, readTree, problemFor, LANGUAGES, isStack} from './problems.mjs';
import {ensureStackImage, runStack, stackCommand} from './stack-runner.mjs';
import {readPractice, loadPractice, mutate, assertWritable, testTargets, recordRun, baselineFiles} from './practice.mjs';
import {diffStats} from './practice-review.mjs';
import {runPython, ensurePythonImage, pythonSpec} from './sandbox.mjs';
import {RESET_WORK} from './warm-sandbox.mjs';
import {runtimes} from './runtimes.mjs';
import {challenges} from './challenges.mjs';
import {exclusive} from './locks.mjs';

const TEXT_LIMIT = 400000;
const EVENT_LIMIT = 3000;
const validName = name => typeof name === 'string' && name.length > 0 && name.length <= 400 && !/[\\:\x00]/.test(name) && !name.split('/').some(part => !part || part === '..' || part === '.' || part.startsWith('.'));

// Repo sessions keep a simple event log (saves, runs, prompts) for reviews.
export async function readEvents(dir) {
  try { return JSON.parse(await fs.readFile(path.join(dir, 'events.json'), 'utf8')); } catch { return []; }
}
export function recordRepoEvidence(dir, event) {
  return exclusive(dir, async () => {
    const events = await readEvents(dir);
    events.push({...event, at: Date.now()});
    await fs.writeFile(path.join(dir, 'events.json'), JSON.stringify(events.slice(-EVENT_LIMIT)));
  }).catch(() => {});
}

export function workspaceApi({SESSIONS, run, listFiles, repoSession, runRepo, job, pool = null}) {
  const baselineCache = new Map();

  async function openPractice(id) {
    const dir = path.join(SESSIONS, id);
    const raw = await readPractice(dir);
    if (!raw || raw.kind !== 'structured') throw new Error('Practice session not found.');
    const problem = await getProblem(raw.problemId);
    const state = await loadPractice(dir, problem);
    const root = path.join(dir, 'repo');
    return {
      kind: 'practice', id, dir, root, state, problem, language: state.language, active: state.status === 'active',
      title: problem.title,
      problemText: () => {
        const view = problemFor(problem, state.language, {unlocked: state.unlocked});
        return [view.overview, ...view.phases.filter(p => !p.locked).map(p => `### Phase ${p.number}: ${p.title}\n\n${p.instructions}`)].join('\n\n');
      },
      async files() { return listFiles(root); },
      readonly: name => state.readonly.includes(name),
      async read(name) {
        if (!validName(name)) throw new Error('Invalid file path.');
        const text = await fs.readFile(path.join(root, ...name.split('/')), 'utf8');
        if (text.includes('\0')) throw new Error('Binary files cannot be opened.');
        return text;
      },
      async write(name, content, source = 'candidate') {
        if (!validName(name)) throw new Error('Invalid file path.');
        if (typeof content !== 'string' || content.length > TEXT_LIMIT) throw new Error('Invalid file content.');
        return mutate(dir, problem, async st => {
          assertWritable(st, name);
          const target = path.join(root, ...name.split('/'));
          let before = null;
          try { before = await fs.readFile(target, 'utf8'); } catch {}
          await fs.mkdir(path.dirname(target), {recursive: true});
          await fs.writeFile(target, content);
          if (before !== content) st.events.push({type: before === null ? 'create' : 'save', path: name, source, ...diffStats(before || '', content), at: Date.now(), phase: st.unlocked});
          return {created: before === null};
        });
      },
      async remove(name) {
        if (!validName(name)) throw new Error('Invalid file path.');
        return mutate(dir, problem, async st => { assertWritable(st, name); await fs.rm(path.join(root, ...name.split('/')), {force: true}); st.events.push({type: 'delete', path: name, at: Date.now(), phase: st.unlocked}); });
      },
      async baseline() {
        // Per language and phase: after a language switch the starting point changes.
        const key = `practice:${id}:${state.language}:${state.unlocked}:${state.base?.solved || 0}`;
        if (!baselineCache.has(key)) baselineCache.set(key, await baselineFiles(problem, state));
        return baselineCache.get(key);
      },
      record: event => mutate(dir, problem, st => { st.events.push({...event, at: Date.now(), phase: st.unlocked}); }).catch(() => {}),
      async runTests(progress = () => {}) {
        const lang = LANGUAGES[state.language];
        if (lang.runner === 'browser') return {client: true};
        const names = await listFiles(root);
        const targets = testTargets(state, names);
        const options = {sourceDir: root, overlayDir: path.join(dir, 'canonical'), targets, pool, key: `practice:${id}`};
        let result;
        if (isStack(state.language)) {
          progress(`Running the phase tests in the ${lang.label} environment…`);
          await ensureStackImage(run, state.language, progress);
          result = await runStack(run, {...options, language: state.language});
        } else {
          progress('Running the phase tests in the Python sandbox…');
          await ensurePythonImage(run, progress);
          result = await runPython(run, options);
        }
        const recorded = await recordRun(dir, problem, {target: 'tests', ...result});
        return {text: formatResults(result.results, result.output), summary: recorded.summary, results: result.results};
      },
      async terminal(command, progress = () => {}) {
        const canonical = path.join(dir, 'canonical');
        if (isStack(state.language)) {
          if (typeof command !== 'string' || !command.trim() || command.length > 4000) throw new Error('Enter a command.');
          if (!pool) throw new Error('The terminal needs the sandbox pool.');
          await ensureStackImage(run, state.language, progress);
          progress(`Running in the ${LANGUAGES[state.language].label} environment…`);
          return stackCommand(pool, {language: state.language, key: `practice:${id}`, sourceDir: root, overlayDir: canonical, command});
        }
        if (state.language === 'python') {
          await ensurePythonImage(run, progress);
          return warmCommand(pythonSpec(`practice:${id}`, root, canonical), command, progress);
        }
        return warmCommand({key: `practice-js:${id}`, image: 'node:22-alpine', mounts: [{source: root, target: '/candidate'}, {source: canonical, target: '/canonical'}]}, command, progress, true);
      }
    };
  }

  async function openRepo(id) {
    const s = await repoSession(id);
    const root = s.repo;
    const isGit = await fs.access(path.join(root, '.git')).then(() => true, () => false);
    const challenge = challenges.find(c => c.id === s.meta.challenge || c.title === s.meta.title);
    return {
      kind: 'repo', id, dir: s.dir, root, meta: s.meta, language: s.meta.runtime || 'node', active: true, title: s.meta.title,
      problemText: () => s.meta.brief || '',
      async files() { return listFiles(root); },
      readonly: () => false,
      async read(name) {
        if (!validName(name)) throw new Error('Invalid file path.');
        const text = await fs.readFile(path.join(root, ...name.split('/')), 'utf8');
        if (text.includes('\0')) throw new Error('Binary files cannot be opened.');
        return text;
      },
      async write(name, content, source = 'candidate') {
        if (!validName(name)) throw new Error('Invalid file path.');
        if (typeof content !== 'string' || content.length > TEXT_LIMIT) throw new Error('Invalid file content.');
        const target = path.join(root, ...name.split('/'));
        let before = null;
        try { before = await fs.readFile(target, 'utf8'); } catch {}
        await fs.mkdir(path.dirname(target), {recursive: true});
        await fs.writeFile(target, content);
        if (before !== content) await recordRepoEvidence(s.dir, {type: before === null ? 'create' : 'save', path: name, source, ...diffStats(before || '', content)});
        return {created: before === null};
      },
      async remove(name) {
        if (!validName(name)) throw new Error('Invalid file path.');
        await fs.rm(path.join(root, ...name.split('/')), {force: true});
        await recordRepoEvidence(s.dir, {type: 'delete', path: name});
      },
      async baseline(name) {
        if (isGit) return name === undefined ? null : gitShow(root, name);
        return challenge ? challenge.files : {};
      },
      async changes() {
        if (!isGit) return null;
        const status = await run('git', ['-C', root, '-c', 'core.quotepath=off', 'status', '--porcelain=v1', '-uall'], {timeout: 30000});
        if (status.code !== 0) return [];
        return status.output.split('\n').filter(Boolean).map(line => {
          const code = line.slice(0, 2), file = line.slice(3).replace(/^"|"$/g, '');
          return {path: file.includes(' -> ') ? file.split(' -> ').pop() : file, status: code.includes('?') || code.includes('A') ? 'added' : code.includes('D') ? 'deleted' : 'modified'};
        }).filter(item => validName(item.path)).slice(0, 500);
      },
      record: event => recordRepoEvidence(s.dir, event),
      async runTests(progress = () => {}) {
        const fresh = await repoSession(id);
        const result = await runRepo(fresh, {runtime: fresh.meta.runtime, command: fresh.meta.testCommand, image: fresh.meta.testImage}, progress);
        return {text: result.output || '(no output)', code: result.code, benchmark: result.benchmark, timedOut: result.timedOut};
      },
      async terminal(command, progress = () => {}) {
        // Real-world tasks keep a fresh container per command: their environment lives in the image's /testbed.
        if (s.meta.benchmark) return sandboxCommand({image: s.meta.image, sourceDir: root, command, progress, testbed: true});
        const fresh = await repoSession(id);
        const runtime = runtimes[fresh.meta.runtime] || runtimes.node;
        const image = fresh.meta.testImage || runtime.image;
        await ensureImage(image, progress);
        return warmCommand({key: `repo:${id}`, image, mounts: [{source: root, target: '/candidate'}]}, command, progress);
      }
    };
  }

  async function open(kind, id) {
    if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Select a session first.');
    if (kind === 'practice') return openPractice(id);
    if (kind === 'repo') return openRepo(id);
    throw new Error('Unknown workspace kind.');
  }

  // Lists files that differ from the starting code.
  async function changes(ws) {
    if (ws.kind === 'repo') {
      const fromGit = await ws.changes();
      if (fromGit) return fromGit;
    }
    const base = await ws.baseline();
    const current = await readTree(ws.root);
    const out = [];
    for (const name of new Set([...Object.keys(base), ...Object.keys(current)])) {
      if (ws.kind === 'practice' && ws.state.readonly.includes(name)) continue;
      if (base[name] === undefined) out.push({path: name, status: 'added'});
      else if (current[name] === undefined) out.push({path: name, status: 'deleted'});
      else if (base[name] !== current[name]) out.push({path: name, status: 'modified'});
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  async function baselineOf(ws, name) {
    if (ws.kind === 'repo') {
      const value = await ws.baseline(name);
      if (typeof value === 'string' || value === null) return value;
      return value[name] ?? null;
    }
    return (await ws.baseline())[name] ?? null;
  }

  // Images that are known to be present, so each command doesn't ask Docker again.
  const readyImages = new Map();
  async function ensureImage(image, progress) {
    if (Date.now() - (readyImages.get(image) || 0) < 600000) return;
    const exists = await run('docker', ['image', 'inspect', image], {timeout: 10000});
    if (exists.code !== 0) {
      progress?.(`Downloading ${image}. This happens once…`);
      const pulled = await run('docker', ['pull', image], {timeout: 1800000});
      if (pulled.code !== 0) throw new Error('Could not prepare the sandbox: ' + pulled.output.slice(-300));
    }
    readyImages.set(image, Date.now());
  }

  // Runs one shell command on a fresh copy of the workspace in the session's
  // warm container. Without a pool, it starts a disposable container instead.
  async function warmCommand(spec, command, progress, withCanonical = spec.mounts.some(m => m.target === '/canonical')) {
    if (typeof command !== 'string' || !command.trim() || command.length > 4000) throw new Error('Enter a command.');
    if (!pool) return sandboxCommand({image: spec.image, sourceDir: spec.mounts[0].source, overlayDir: withCanonical ? spec.mounts.find(m => m.target === '/canonical')?.source : undefined, command, progress});
    progress?.(`Running in ${spec.image}…`);
    const result = await pool.exec(spec, `${RESET_WORK}; cp -a /candidate/. /work/${withCanonical ? ' && cp -a /canonical/. /work/' : ''} && cd /work && ${command}`, {timeout: 120000});
    return {output: result.output.slice(-100000), code: result.code, timedOut: result.timedOut, ms: result.ms};
  }

  // Runs one shell command against a disposable copy of the workspace.
  async function sandboxCommand({image, sourceDir, overlayDir, command, progress, testbed = false}) {
    if (typeof command !== 'string' || !command.trim() || command.length > 4000) throw new Error('Enter a command.');
    progress?.(`Running in ${image}…`);
    await ensureImage(image, progress);
    const name = `dg-term-${randomUUID()}`;
    const mounts = ['--mount', `type=bind,source=${sourceDir},target=/candidate,readonly`];
    if (overlayDir) mounts.push('--mount', `type=bind,source=${overlayDir},target=/canonical,readonly`);
    const copy = `cp -a /candidate/. ${testbed ? '/testbed' : '/work'}/${overlayDir ? ` && cp -a /canonical/. /work/` : ''}`;
    const args = testbed
      ? ['run', '--rm', '--name', name, '--network', 'none', '--memory', '4g', '--cpus', '2', '--pids-limit', '256', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', ...mounts,
        '--entrypoint', '/bin/bash', image, '-c', `${copy} && cd /testbed && { [ -f /opt/miniconda3/bin/activate ] && source /opt/miniconda3/bin/activate testbed >/dev/null 2>&1; true; } && ${command}`]
      : ['run', '--rm', '--name', name, '--network', 'none', '--memory', '1g', '--cpus', '2', '--pids-limit', '256', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--read-only',
        '--tmpfs', '/tmp:rw,exec,nosuid,size=256m', '--tmpfs', '/work:rw,exec,nosuid,size=768m', '-e', 'HOME=/tmp', '-e', 'PYTHONDONTWRITEBYTECODE=1', ...mounts,
        '--entrypoint', '/bin/sh', image, '-c', `${copy} && cd /work && ${command}`];
    const started = Date.now();
    try {
      const result = await run('docker', args, {timeout: testbed ? 300000 : 120000});
      return {output: result.output.slice(-100000), code: result.code, timedOut: result.timedOut, ms: Date.now() - started};
    } finally { await run('docker', ['rm', '-f', name], {timeout: 10000}).catch(() => {}); }
  }

  // HTTP routes shared by both workspace kinds: /api/ws/*.
  async function handle(req, url, data) {
    const p = url.pathname;
    if (p !== '/api/ws' && !p.startsWith('/api/ws/')) return undefined;
    const q = req.method === 'GET' ? Object.fromEntries(url.searchParams) : data;
    const ws = await open(q.kind, q.id);
    if (req.method === 'GET') {
      if (p === '/api/ws/files') return {files: await ws.files()};
      if (p === '/api/ws/file') {
        const content = await ws.read(q.path);
        return {content, readonly: ws.readonly(q.path) || !ws.active};
      }
      if (p === '/api/ws/changes') return changes(ws);
      if (p === '/api/ws/diff') {
        const before = await baselineOf(ws, q.path);
        const after = await ws.read(q.path).catch(() => null);
        return {path: q.path, before, after};
      }
      if (p === '/api/ws/events' && ws.kind === 'repo') return readEvents(ws.dir);
      throw new Error('Unknown endpoint.');
    }
    if (!ws.active) throw new Error('This session has ended.');
    if (p === '/api/ws/file') {
      if (!(await ws.files()).includes(data.path)) throw new Error('File not found.');
      await ws.write(data.path, data.content, 'candidate');
      return {saved: true};
    }
    if (p === '/api/ws/file/create') {
      if ((await ws.files()).includes(data.path)) throw new Error('That file already exists.');
      await ws.write(data.path, typeof data.content === 'string' ? data.content : '', 'candidate');
      return {files: await ws.files()};
    }
    if (p === '/api/ws/file/delete') {
      if (ws.readonly(data.path)) throw new Error('Provided test files cannot be deleted.');
      await ws.remove(data.path);
      return {files: await ws.files()};
    }
    if (p === '/api/ws/event') {
      const type = String(data.type || '');
      if (!['open', 'paste', 'copy', 'approval'].includes(type)) throw new Error('Unknown event.');
      await ws.record({type, path: typeof data.path === 'string' ? data.path.slice(0, 300) : undefined, chars: Number(data.chars) || undefined, decision: data.decision, tool: data.tool});
      return {ok: true};
    }
    if (p === '/api/ws/terminal') {
      const command = String(data.command || '').trim();
      return job(async progress => {
        const result = await ws.terminal(command, progress);
        await ws.record({type: 'command', source: 'candidate', command: command.slice(0, 300), code: result.code});
        return result;
      });
    }
    if (p === '/api/ws/tests') return job(progress => ws.runTests(progress));
    throw new Error('Unknown endpoint.');
  }

  return {open, changes, baselineOf, handle};
}

// Reads one file as committed at HEAD, without the output cap of run().
function gitShow(root, name) {
  return new Promise(resolve => {
    execFile('git', ['-C', root, 'show', `HEAD:${name}`], {maxBuffer: 8 * 1024 * 1024, windowsHide: true, timeout: 15000, encoding: 'utf8'}, (error, stdout) => resolve(error ? null : stdout.replace(/\r\n/g, '\n')));
  });
}

export function formatResults(results = [], output = '') {
  const lines = results.map(r => `${r.status === 'pass' ? 'PASS' : r.status === 'skip' ? 'SKIP' : 'FAIL'}  ${r.file} › ${r.name}${r.message ? `\n      ${String(r.message).split('\n')[0]}` : ''}`);
  const passed = results.filter(r => r.status === 'pass').length;
  return `${lines.join('\n')}\n\n${passed}/${results.filter(r => r.status !== 'skip').length} tests passed${output ? `\n\nProgram output:\n${output.slice(-3000)}` : ''}`;
}
