import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { challenges } from './challenges.mjs';
import { runtimes, detectRuntime } from './runtimes.mjs';
import { loadTasks, chooseTask, publicTask } from './task-source.mjs';
import { practiceRoutes } from './practice-routes.mjs';
import { openRoutes } from './open-ended.mjs';
import { codingRoutes } from './coding.mjs';
import { workspaceApi, recordRepoEvidence } from './workspace-api.mjs';
import { assistantRoutes } from './assistant.mjs';
import { mockRoutes } from './mock.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS = path.join(ROOT, '.sessions');
const MODEL = 'qwen2.5-coder:0.5b';
const PORT = Number(process.env.PORT || 3210);
const OLLAMA = 'http://127.0.0.1:11434';
const CACHE = path.join(ROOT, '.task-cache');
const jobs = new Map();
function job(action) {
  const id=randomUUID(); const state={id,status:'running',message:'Starting…'};jobs.set(id,state);
  Promise.resolve().then(()=>action(message=>state.message=message)).then(result=>Object.assign(state,{status:'done',result})).catch(error=>Object.assign(state,{status:'error',error:error.message}));
  const timer=setTimeout(()=>jobs.delete(id),3600000);timer.unref();return {job:id};
}
const ignored = new Set(['.git', 'node_modules', '.env', '.venv', '__pycache__']);
export function validRepo(value) {
  const match = /^https:\/\/github\.com\/([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(value || '');
  if (!match || match[2] === '.' || match[2] === '..') throw new Error('Use a public https://github.com/owner/repo URL.');
  return `https://github.com/${match[1]}/${match[2]}.git`;
}
export async function safeFile(root, name) {
  if (typeof name !== 'string' || /[\\:\x00]/.test(name) || name.split('/').some(x => !x || x === '..' || x.startsWith('.'))) throw new Error('Invalid file path.');
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid file path.');
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Symbolic links cannot be opened.');
  }
  if (!(await fs.stat(resolved)).isFile()) throw new Error('Select a file.');
  return resolved;
}
export async function createSourceFile(root,name,content=''){
  if(typeof name!=='string'||name.length>500||/[\\:\x00]/.test(name)||name.split('/').some(part=>!part||part.startsWith('.'))||typeof content!=='string'||content.length>150000)throw new Error('Use a relative source path, such as src/policy.js.');
  const parts=name.split('/');let parent=root;
  for(const part of parts.slice(0,-1)){parent=path.join(parent,part);try{await fs.mkdir(parent);}catch(error){if(error.code!=='EEXIST')throw error;}const stat=await fs.lstat(parent);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('Invalid parent directory.');}
  await fs.writeFile(path.join(parent,parts.at(-1)),content,{flag:'wx'});
}
function run(command, args, { cwd = ROOT, timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd, windowsHide: true, env: {...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1'} });
    let output = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; proc.kill(); }, timeout);
    const append = data => { output = (output + data.toString()).slice(-60000); };
    proc.stdout.on('data', append); proc.stderr.on('data', append);
    proc.on('error', error => { clearTimeout(timer); reject(new Error(`${command} is unavailable: ${error.message}`)); });
    proc.on('close', code => { clearTimeout(timer); resolve({code, output, timedOut}); });
  });
}
async function files(root, prefix = '', results = []) {
  for (const item of await fs.readdir(path.join(root, prefix), {withFileTypes: true})) {
    if (results.length >= 20000) break;
    if (ignored.has(item.name) || item.name.startsWith('.') || item.isSymbolicLink()) continue;
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) { if (name.split('/').length < 24) await files(root, name, results); }
    else if (item.isFile() && (await fs.stat(path.join(root, name))).size <= 150000) results.push(name);
  }
  return results.sort();
}
async function session(id) {
  if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Select a practice session first.');
  const dir = path.join(SESSIONS, id);
  return {dir, repo: path.join(dir, 'repo'), meta: JSON.parse(await fs.readFile(path.join(dir, 'session.json'), 'utf8'))};
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 200000) throw new Error('Request too large.'); }
  return JSON.parse(text || '{}');
}
async function ollama(endpoint, data, timeout = 120000) {
  let response;
  try { response = await fetch(OLLAMA + endpoint, {method: data ? 'POST' : 'GET', headers: {'Content-Type': 'application/json'}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(timeout)}); }
  catch { throw new Error('Ollama is not responding. Start Ollama locally, then retry.'); }
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || 'Ollama request failed.');
  return result;
}
// Runs a repo session's tests: the task's regression suite for SWE-bench tasks,
// otherwise the chosen command in a disposable copy of the code.
async function runRepo(s, data, progress = () => {}) {
  const runtime = runtimes[data.runtime || s.meta.runtime || 'node'];
  if (!runtime) throw new Error('Choose a supported language.');
  const benchmark = s.meta.benchmark && data.benchmark !== false;
  const image = benchmark ? s.meta.image : String(data.image || s.meta.testImage || runtime.image);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(image)) throw new Error('Invalid runtime image.');
  progress(`Preparing ${image}. The first download may be large…`);
  const exists = await run('docker', ['image', 'inspect', image], {timeout: 10000});
  if (exists.code !== 0) { const pull = await run('docker', ['pull', image], {timeout: 1800000}); if (pull.code !== 0) throw new Error('Runtime download failed. Start Docker Desktop and retry.\n' + pull.output); }
  const name = `debug-gym-${randomUUID()}`;
  const args = ['run', '--rm', '--name', name, '--network', 'none', '--memory', benchmark ? '4g' : '1g', '--cpus', '2', '--pids-limit', '256', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--mount', `type=bind,source=${s.repo},target=/candidate,readonly`];
  if (benchmark) args.push('--mount', `type=bind,source=${path.join(s.dir, 'eval.sh')},target=/practice-eval.sh,readonly`, '--entrypoint', '/bin/bash', image, '-c', 'cp -a /candidate/. /testbed/ && bash /practice-eval.sh');
  else args.push('--read-only', '--tmpfs', '/tmp:rw,exec,nosuid,size=256m', '--tmpfs', '/work:rw,exec,nosuid,size=768m', '-e', 'HOME=/tmp', '-e', 'GOCACHE=/tmp/go-cache', '-e', 'GOPATH=/tmp/go', '--entrypoint', '/bin/sh', image, '-c', `cp -R /candidate/. /work/ && cd /work && ${String(data.command || s.meta.testCommand || runtime.command).slice(0, 2000)}`);
  progress(benchmark ? 'Running task-specific regression tests (up to 15 minutes)…' : 'Running in an isolated container…');
  try {
    const result = {...await run('docker', args, {timeout: benchmark ? 900000 : 120000}), benchmark};
    await recordRepoEvidence(s.dir, {type: 'test', code: result.code, benchmark, timedOut: result.timedOut});
    return result;
  } finally { await run('docker', ['rm', '-f', name], {timeout: 10000}).catch(() => {}); }
}

const practice = practiceRoutes({SESSIONS, run, listFiles: root => files(root), job, ollama, OLLAMA});
const openEnded = openRoutes({SESSIONS, run, job, ollama, models: () => practice.models()});
const coding = codingRoutes({SESSIONS, run, job});
const workspace = workspaceApi({SESSIONS, run, listFiles: root => files(root), repoSession: session, runRepo, job});
const assistant = assistantRoutes({SESSIONS, OLLAMA, models: () => practice.models(), workspace});
const mock = mockRoutes({SESSIONS, OLLAMA, ollama, job, models: () => practice.models(), coding, workspace});
const routeGroups = [practice, openEnded, coding, workspace, assistant, mock];
const STREAMS = {'/api/practice/chat': (req, res, data) => practice.chat(req, res, data), '/api/assistant/send': (req, res, data) => assistant.stream(req, res, data, 'send'), '/api/assistant/resume': (req, res, data) => assistant.stream(req, res, data, 'resume'), '/api/mock/message': (req, res, data) => mock.stream(req, res, data)};
async function api(req, url) {
  if (req.method === 'GET') {
    for (const routes of routeGroups) { const handled = await routes.handle(req, url, {}); if (handled !== undefined) return handled; }
  }
  if (req.method === 'GET' && url.pathname === '/api/runtimes') return runtimes;
  if (req.method === 'GET' && url.pathname === '/api/job') { const state=jobs.get(url.searchParams.get('id')); if(!state)throw new Error('Job expired. Please retry.');return state; }
  if (req.method === 'GET' && url.pathname === '/api/tasks') { const tasks=await loadTasks(CACHE);return {count:tasks.length,languages:[...new Set(tasks.map(t=>t.language))],repositories:new Set(tasks.map(t=>t.repo)).size}; }
  if (req.method === 'GET' && url.pathname === '/api/challenges') return challenges.map(({files, ...item}) => item);
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const [docker, models] = await Promise.allSettled([run('docker', ['info', '--format', '{{.ServerVersion}}'], {timeout: 5000}), ollama('/api/tags', null, 3000)]);
    return {docker: docker.status === 'fulfilled' && docker.value.code === 0 && /^\d+\.\d+/m.test(docker.value.output), ollama: models.status === 'fulfilled', model: MODEL, modelReady: models.status === 'fulfilled' && models.value.models.some(m => m.name === MODEL)};
  }
  if (req.method === 'GET' && url.pathname === '/api/search') {
    const q = (url.searchParams.get('q') || 'debugging practice javascript').slice(0, 150);
    const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=6`, {headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'DebugGym'}, signal: AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error('GitHub search is unavailable or rate limited. You can paste a repository URL instead.');
    return (await res.json()).items.map(r => ({name: r.full_name, url: r.html_url, description: r.description, language: r.language}));
  }
  if (req.method === 'GET' && url.pathname === '/api/session') { const s = await session(url.searchParams.get('id')); return {...s.meta, files: await files(s.repo)}; }
  if (req.method === 'GET' && url.pathname === '/api/repos/history') return repoHistory();
  if (req.method !== 'POST') throw new Error('Unknown endpoint.');
  const data = await body(req);
  for (const routes of routeGroups) { const handled = await routes.handle(req, url, data); if (handled !== undefined) return handled; }
  if (url.pathname === '/api/task/random') return job(async progress=>{
    progress('Loading the public task library…');const tasks=await loadTasks(CACHE);let seen=[];try{seen=JSON.parse(await fs.readFile(path.join(CACHE,'seen.json'),'utf8'));}catch{}
    const chosen=chooseTask(tasks,seen,data.language||'all',data.scope||'all');
    if(chosen.recycled)seen=seen.filter(id=>!tasks.some(t=>t.id===id&&(data.language==='all'||!data.language||t.language===data.language)));
    await fs.writeFile(path.join(CACHE,'seen.json'),JSON.stringify([...seen,chosen.task.id]));
    return {...publicTask(chosen.task),recycled:chosen.recycled,total:chosen.total};
  });
  if (url.pathname === '/api/task/start') return job(async progress=>{
    const task=(await loadTasks(CACHE)).find(t=>t.id===data.taskId);if(!task)throw new Error('Unknown task. Pick another task.');
    const id=randomUUID(),dir=path.join(SESSIONS,id),repo=path.join(dir,'repo');await fs.mkdir(repo,{recursive:true});
    progress(`Fetching ${task.repo} at the historical task commit. Large repositories can take several minutes…`);
    const gitOptions=['-c','core.hooksPath=','-c','protocol.file.allow=never','-c','core.autocrlf=false','-c','core.longpaths=true'];
    for(const args of [['init',repo],['-C',repo,'remote','add','origin',validRepo(`https://github.com/${task.repo}`)],['-C',repo,'fetch','--depth','1','origin',task.commit],['-C',repo,'checkout','--detach','FETCH_HEAD']]){
      const result=await run('git',[...gitOptions,...args],{timeout:600000});if(result.code!==0)throw new Error(`Could not prepare task: ${result.output}`);
    }
    progress('Indexing source files…');
    const meta={id,title:task.repo+' · '+task.id.split('-').pop(),brief:task.brief,minutes:60,source:task.source,started:Date.now(),runtime:task.language,benchmark:true,taskId:task.id,commit:task.commit,image:task.image,expectedFailures:task.expectedFailures};
    await fs.writeFile(path.join(dir,'eval.sh'),task.evalScript);await fs.writeFile(path.join(dir,'session.json'),JSON.stringify(meta));
    return {...meta,files:await files(repo)};
  });
  if (url.pathname === '/api/session') {
    const challenge = challenges.find(c => c.id === data.challenge);
    const repoUrl = challenge ? null : validRepo(data.url);
    const id = randomUUID(), dir = path.join(SESSIONS, id), repo = path.join(dir, 'repo');
    await fs.mkdir(dir, {recursive: true});
    if (challenge) {
      await fs.mkdir(repo);
      for (const [name, text] of Object.entries(challenge.files)) await fs.writeFile(path.join(repo, name), text);
    } else {
      const cloned = await run('git', ['-c', 'core.hooksPath=', '-c', 'protocol.file.allow=never', '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', 'clone', '--depth', '1', '--no-recurse-submodules', '--', repoUrl, repo], {timeout: 600000});
      if (cloned.code !== 0) throw new Error(`Clone failed: ${cloned.output}`);
    }
    const meta = {id, title: challenge?.title || repoUrl.split('/').pop().replace('.git', ''), brief: challenge?.brief || 'Explore the README and tests. Choose a reproducible failure, fix the code, and verify the result. Imported repositories are not guaranteed to contain an interview-ready bug.', minutes: challenge?.minutes || 45, source: repoUrl || 'Built-in challenge', started: Date.now(), challenge: challenge?.id};
    const names=await files(repo);meta.runtime=detectRuntime(names);meta.featureBrief=challenge?.featureBrief;
    await fs.writeFile(path.join(dir, 'session.json'), JSON.stringify(meta));
    return {...meta, files:names};
  }
  if (url.pathname === '/api/model/pull') {
    const available = await practice.models().catch(() => ({models: []}));
    const model = ['qwen3:8b', 'qwen2.5-coder:3b', MODEL].includes(data.model) ? data.model : 'qwen3:8b';
    if (available.models.some(m => m.name === model)) return {ready: true, model};
    return job(async progress => { progress(`Downloading ${model}. This can take several minutes…`); await ollama('/api/pull', {model, stream: false}, 3600000); return {ready: true, model}; });
  }
  const s = await session(data.id);
  if (url.pathname === '/api/prepare') return job(async progress => {
    const image = s.meta.benchmark ? s.meta.image : s.meta.testImage || runtimes[s.meta.runtime || 'node'].image;
    progress(`Downloading the test environment ${image}. This happens once…`);
    const exists = await run('docker', ['image', 'inspect', image], {timeout: 10000});
    if (exists.code !== 0 || !exists.output.trim().startsWith('[')) {
      const pulled = await run('docker', ['pull', image], {timeout: 1800000});
      if (pulled.code !== 0 || /Error response from daemon/.test(pulled.output)) throw new Error('Could not prepare Docker: ' + pulled.output);
    }
    return {ready: true, image};
  });
  if (url.pathname === '/api/repo/settings') {
    const runtime = runtimes[data.runtime] ? data.runtime : s.meta.runtime;
    const image = String(data.image || '').trim();
    if (image && !/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(image)) throw new Error('Invalid runtime image.');
    const meta = {...s.meta, runtime, testCommand: String(data.command || '').trim().slice(0, 2000) || undefined, testImage: image || undefined};
    await fs.writeFile(path.join(s.dir, 'session.json'), JSON.stringify(meta));
    return meta;
  }
  if (url.pathname === '/api/run') return job(progress => runRepo(s, data, progress));
  throw new Error('Unknown endpoint.');
}

// Repo sessions (incidents, real-world tasks and imports), newest first.
async function repoHistory() {
  let entries = [];
  try { entries = await fs.readdir(SESSIONS, {withFileTypes: true}); } catch { return []; }
  const list = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name)) continue;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(SESSIONS, entry.name, 'session.json'), 'utf8'));
      if (meta.practice) continue;
      list.push({id: meta.id || entry.name, title: meta.title, source: meta.source, runtime: meta.runtime, benchmark: !!meta.benchmark, started: meta.started, challenge: meta.challenge || null});
    } catch {}
  }
  return list.sort((a, b) => (b.started || 0) - (a.started || 0));
}
export const server = http.createServer(async (req, res) => {
  const allowedHosts = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
  if (!allowedHosts.has(req.headers.host) || (req.headers.origin && ![`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`].includes(req.headers.origin))) { res.writeHead(403); res.end('Forbidden'); return; }
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'POST' && !req.headers['content-type']?.startsWith('application/json')) throw new Error('JSON required.');
      if (req.method === 'POST' && STREAMS[url.pathname]) { await STREAMS[url.pathname](req, res, await body(req)); return; }
      const result = await api(req, url); res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(result));
    } else {
      const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      const type = {html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', ttf: 'font/ttf', woff2: 'font/woff2', json: 'application/json'}[name.split('.').pop()];
      // Top-level app assets, plus vendored files (the Monaco editor and the Inter font) under vendor/.
      const allowed = /^[\w-]+\.(html|js|css|svg)$/.test(name) || (/^vendor\/[\w./-]+\.(js|css|ttf|woff2|json)$/.test(name) && !name.split('/').some(part => part === '..' || part === '.'));
      if (!allowed || !type) { res.writeHead(404); res.end('Not found'); return; }
      let content;
      try { content = await fs.readFile(path.join(ROOT, 'dist', ...name.split('/'))); } catch { res.writeHead(404); res.end('Not found'); return; }
      // Candidate JavaScript runs in a worker that may evaluate code but has no network access.
      // Monaco needs blob: workers, injected <style> elements and a data: icon font.
      const policy = /^runner-(worker|core)\.js$/.test(name)
        ? "default-src 'none'; script-src 'self' 'unsafe-eval'"
        : "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'";
      const cache = name.startsWith('vendor/') ? 'public, max-age=86400' : 'no-cache';
      res.writeHead(200, {'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': cache, 'Content-Security-Policy': policy}); res.end(content);
    }
  } catch (error) {
    if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
    res.writeHead(400, {'Content-Type': 'application/json'}); res.end(JSON.stringify({error: error.message}));
  }
});
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) server.listen(PORT, '127.0.0.1', () => console.log(`Debug Gym ready at http://127.0.0.1:${PORT}`));
