// HTTP routes for structured AI-coding practice. Wired up by server.mjs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {LANGUAGES, isStack, loadProblems, getProblem, problemSummary, problemFor, localize, overlay} from './problems.mjs';
import {
  createPractice, loadPractice, publicPractice, mutate, record, assertWritable, advance, useHint, hintsShown,
  testTargets, recordRun, submit, abandon, saveDebrief, finishReview, assistantMessages, workspaceFiles, runFiles, switchLanguage, baselineFiles,
  solutionFiles, listPractice, codebaseVocabulary, promptSignals, readPractice
} from './practice.mjs';
import {review, diffText, diffStats} from './practice-review.mjs';
import {ensurePythonImage, runPython as sandboxPython} from './sandbox.mjs';
import {ensureStackImage, runStack} from './stack-runner.mjs';
import {chatRequest} from './ai-runtime.mjs';
const ASSISTANT_PREFERENCE = ['qwen3:8b', 'qwen3.5:9b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'llama3.1:8b', 'qwen2.5-coder:3b', 'qwen2.5-coder:1.5b', 'qwen2.5-coder:0.5b'];
const REVIEW_PREFERENCE = ['qwen3.5:9b', 'qwen3:8b', 'qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'llama3.1:8b', 'qwen2.5-coder:3b'];

export function practiceRoutes({SESSIONS, run, listFiles, job, ollama, OLLAMA, pool = null}) {
  const vocabularies = new Map();
  const vocabulary = async (problem, language) => {
    const key = `${problem.id}:${language}`;
    if (!vocabularies.has(key)) vocabularies.set(key, await codebaseVocabulary(problem, language));
    return vocabularies.get(key);
  };

  // The model list is cached briefly: every AI request needs it, and asking Ollama each time adds latency.
  let tagsCache = null, tagsAt = 0;
  async function models({fresh = false} = {}) {
    if (fresh || !tagsCache || Date.now() - tagsAt > 30000) { tagsCache = await ollama('/api/tags', null, 4000); tagsAt = Date.now(); }
    const tags = tagsCache;
    const list = tags.models
      .filter(m => !(m.capabilities || []).includes('embedding') && !/embed/i.test(m.name))
      .map(m => {
        const caps = m.capabilities || [];
        // Older Ollama builds omit capabilities from /api/tags; assume tool support then.
        return {name: m.name, parameterSize: m.details?.parameter_size || '', family: m.details?.family || '', size: m.size,
          thinking: caps.includes('thinking'), tools: caps.length ? caps.includes('tools') : true, insert: caps.length ? caps.includes('insert') : /coder/i.test(m.name), vision: caps.includes('vision')};
      });
    const pick = (preference, env) => list.find(m => m.name === env) || preference.map(name => list.find(m => m.name === name)).find(Boolean) || [...list].sort((a, b) => (b.size || 0) - (a.size || 0))[0] || null;
    return {models: list, assistant: pick(ASSISTANT_PREFERENCE, process.env.DG_ASSISTANT_MODEL)?.name || null, reviewer: pick(REVIEW_PREFERENCE, process.env.DG_REVIEW_MODEL)?.name || null};
  }

  async function open(id) {
    if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Select a practice session first.');
    const dir = path.join(SESSIONS, id);
    const raw = await readPractice(dir);
    if (!raw || raw.kind !== 'structured') throw new Error('Practice session not found.');
    const problem = await getProblem(raw.problemId);
    const state = await loadPractice(dir, problem);
    return {dir, repo: path.join(dir, 'repo'), problem, state};
  }

  function safeName(name) {
    if (typeof name !== 'string' || name.length > 300 || /[\\:\x00]/.test(name) || name.split('/').some(p => !p || p === '..' || p.startsWith('.'))) throw new Error('Invalid file path.');
    return name;
  }

  async function view(session) {
    const names = await listFiles(session.repo);
    return {...publicPractice(session.state, session.problem), files: names, hintsShown: hintsShown(session.state, session.problem)};
  }

  // Python sessions use the Python sandbox; framework stacks (Express, Django,
  // FastAPI, Spring Boot) use their own image. JavaScript runs in the browser.
  const ensureImage = (language, progress) => isStack(language) ? ensureStackImage(run, language, progress) : ensurePythonImage(run, progress);

  async function runServer(session, target) {
    const names = await listFiles(session.repo);
    const language = session.state.language, lang = LANGUAGES[language];
    const options = {sourceDir: session.repo, overlayDir: path.join(session.dir, 'canonical'), mode: target, pool, key: `practice:${session.state.id}`};
    const targets = target === 'main' ? [lang.main] : testTargets(session.state, names);
    const result = isStack(language) ? await runStack(run, {...options, language, targets: target === 'main' ? [] : targets}) : await sandboxPython(run, {...options, targets});
    return {target, ...result};
  }

  async function handle(req, url, data) {
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/problems') {
      const [problems, history] = await Promise.all([loadProblems(), listPractice(SESSIONS)]);
      return problems.map(problem => {
        const attempts = history.filter(h => h.problemId === problem.id && !h.mock);
        const best = attempts.filter(a => a.score !== null).sort((a, b) => b.score - a.score)[0];
        const active = attempts.find(a => a.status === 'active' || a.status === 'debrief' || a.status === 'reviewing');
        return {...problemSummary(problem), attempts: attempts.length, best: best ? {verdict: best.verdict, score: best.score, id: best.id} : null, active: active ? {id: active.id, status: active.status, language: active.language} : null};
      });
    }
    if (req.method === 'GET' && p === '/api/problems/answers') {
      const problem = await getProblem(url.searchParams.get('problem'));
      if ((await listPractice(SESSIONS)).some(h => h.problemId === problem.id && h.status === 'active')) throw new Error('Submit or finish your session on this problem before opening its answer key.');
      const language = url.searchParams.get('language') || problem.languages[0];
      if (!problem.languages.includes(language)) throw new Error('Unknown language.');
      return {...problemFor(problem, language, {answers: true}), solutions: await solutionFiles(problem, language), starter: await overlay(problem, language, 'starter')};
    }
    if (req.method === 'GET' && p === '/api/models') return models({fresh: true});
    if (req.method === 'GET' && p === '/api/practice/history') return listPractice(SESSIONS);
    if (req.method === 'GET' && p === '/api/practice') return view(await open(url.searchParams.get('id')));
    if (req.method === 'GET' && p === '/api/practice/file') {
      const session = await open(url.searchParams.get('id'));
      const name = safeName(url.searchParams.get('path'));
      const files = await workspaceFiles(session.dir);
      if (!(name in files)) throw new Error('File not found or not editable.');
      return {content: files[name], readonly: session.state.readonly.includes(name) || session.state.status !== 'active'};
    }
    if (req.method === 'GET' && p === '/api/practice/bundle') {
      const session = await open(url.searchParams.get('id'));
      if (LANGUAGES[session.state.language].runner !== 'browser') throw new Error('This session runs on the server.');
      const files = await runFiles(session.dir);
      return {files, tests: testTargets(session.state, Object.keys(files)), main: LANGUAGES.javascript.main};
    }
    if (req.method !== 'POST' || !p.startsWith('/api/practice')) return undefined;

    if (p === '/api/practice/preflight') {
      const lang = LANGUAGES[data.language];
      if (!lang) throw new Error('Choose a language.');
      if (lang.runner === 'browser') return {ready: true};
      return job(progress => ensureImage(data.language, progress));
    }
    if (p === '/api/practice/start') {
      const problem = await getProblem(data.problem);
      if (!LANGUAGES[data.language] || !problem.languages.includes(data.language)) throw new Error('Choose one of the languages this problem offers.');
      const state = await createPractice(SESSIONS, problem, data.language);
      return view(await open(state.id));
    }
    const session = await open(data.id);
    const {dir, problem} = session;
    if (p === '/api/practice/file') {
      const name = safeName(data.path);
      if (typeof data.content !== 'string' || data.content.length > 150000) throw new Error('Invalid file content.');
      return mutate(dir, problem, async state => {
        assertWritable(state, name);
        const target = path.join(session.repo, ...name.split('/'));
        let before;
        try { before = await fs.readFile(target, 'utf8'); } catch { throw new Error('File not found.'); }
        if (before !== data.content) {
          await fs.writeFile(target, data.content);
          state.events.push({type: 'save', path: name, ...diffStats(before, data.content), at: Date.now(), phase: state.unlocked});
        }
        return {saved: true};
      });
    }
    if (p === '/api/practice/file/create') {
      const name = safeName(data.path);
      if (!/\.(py|js|java|json|txt|md|csv|properties|ya?ml|html|sql)$/.test(name)) throw new Error('Create a source, config, text or data file (for example .py, .js, .java, .json, .md).');
      return mutate(dir, problem, async state => {
        assertWritable(state, name);
        const target = path.join(session.repo, ...name.split('/'));
        await fs.mkdir(path.dirname(target), {recursive: true});
        await fs.writeFile(target, typeof data.content === 'string' ? data.content.slice(0, 150000) : '', {flag: 'wx'}).catch(error => { throw new Error(error.code === 'EEXIST' ? 'That file already exists.' : error.message); });
        state.events.push({type: 'create', path: name, at: Date.now(), phase: state.unlocked});
        return {files: await listFiles(session.repo)};
      });
    }
    if (p === '/api/practice/event') {
      const type = String(data.type);
      if (type === 'open') await record(dir, problem, {type, path: String(data.path || '').slice(0, 300)});
      else if (type === 'paste') {
        const text = String(data.text || '').slice(0, 40000);
        const squash = s => s.replace(/\s+/g, '');
        const pasted = squash(text);
        const fromAI = pasted.length >= 20 && session.state.chat.some(m => m.role === 'assistant' && [...m.content.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].some(block => { const code = squash(block[1]); return code.includes(pasted) || (pasted.includes(code) && code.length >= 20); }));
        await record(dir, problem, {type, path: String(data.path || '').slice(0, 300), chars: text.length, lines: text.split('\n').length, fromAI});
      } else if (type === 'copy') await record(dir, problem, {type, chars: Number(data.chars) || 0});
      else throw new Error('Unknown event.');
      return {ok: true};
    }
    if (p === '/api/practice/run') {
      if (session.state.status !== 'active') throw new Error('This session has ended.');
      const target = data.target === 'main' ? 'main' : 'tests';
      const lang = LANGUAGES[session.state.language];
      if (lang.runner === 'browser') throw new Error('JavaScript runs in the browser.');
      if (target === 'main' && !lang.main) throw new Error(`${lang.label} projects have no demo entry point. Run the tests instead.`);
      return job(async progress => {
        progress(isStack(session.state.language) ? `Starting the ${lang.label} environment…` : 'Starting the Python sandbox…');
        await ensureImage(session.state.language, progress);
        progress(target === 'main' ? `Running ${lang.main}…` : session.state.language === 'spring' ? 'Compiling and running the JUnit tests…' : 'Running tests…');
        const result = await runServer(session, target);
        const recorded = await recordRun(dir, problem, result);
        return {...result, summary: recorded.summary, newlyPassed: recorded.newlyPassed, practice: await view(await open(data.id))};
      });
    }
    if (p === '/api/practice/result') {
      if (LANGUAGES[session.state.language].runner !== 'browser') throw new Error('This session runs on the server.');
      const recorded = await recordRun(dir, problem, {target: data.target, results: data.results, output: data.output, exitCode: data.exitCode, ms: data.ms, timedOut: data.timedOut});
      return {summary: recorded.summary, newlyPassed: recorded.newlyPassed, practice: await view(await open(data.id))};
    }
    // Switch the workspace to another language mid-session: the timer and
    // phase progress carry over, and each language keeps its own code.
    if (p === '/api/practice/language') {
      const language = String(data.language || '');
      if (!LANGUAGES[language] || !problem.languages.includes(language)) throw new Error('This problem is not available in that language.');
      if (language === session.state.language) return {restored: false, practice: await view(session)};
      const result = await switchLanguage(dir, problem, language);
      for (const key of [`practice:${session.state.id}`, `practice-js:${session.state.id}`]) pool?.forget(key);
      await cancelPendingAgentCalls(dir, `Cancelled: the workspace switched to ${LANGUAGES[language].label}, so this change no longer applies.`);
      return {restored: result.restored, practice: await view(await open(data.id))};
    }
    if (p === '/api/practice/advance') {
      const result = await advance(dir, problem, {skip: !!data.skip});
      return {added: result.added, practice: await view(await open(data.id))};
    }
    if (p === '/api/practice/hint') {
      const result = await useHint(dir, problem);
      return {hint: result.hint, index: result.index, total: result.total, practice: await view(await open(data.id))};
    }
    if (p === '/api/practice/submit') {
      await submit(dir, problem, data.reason);
      return view(await open(data.id));
    }
    // Restart: close this attempt without a review and start a fresh copy of
    // the same problem in the same language, with a new timer.
    if (p === '/api/practice/restart') {
      // The new attempt can be in another of the problem's languages.
      const language = data.language === undefined || data.language === null || data.language === '' ? session.state.language : String(data.language);
      if (!LANGUAGES[language] || !problem.languages.includes(language)) throw new Error('This problem is not available in that language.');
      // The new attempt is created first, so a failure never leaves the
      // candidate with a closed attempt and nothing to continue in. If the old
      // one can't be closed (a second click got there first), the new one goes.
      const state = await createPractice(SESSIONS, problem, language);
      try { await abandon(dir, problem); }
      catch (error) { await fs.rm(path.join(SESSIONS, state.id), {recursive: true, force: true}).catch(() => {}); throw error; }
      // Free the old attempt's warm containers (tests, terminal).
      for (const key of [`practice:${session.state.id}`, `practice-js:${session.state.id}`]) pool?.forget(key);
      return view(await open(state.id));
    }
    if (p === '/api/practice/debrief') {
      const state = await saveDebrief(dir, problem, data.answers);
      if (state.status === 'ended') return {job: null, practice: await view(await open(data.id))};
      return job(async progress => {
        progress('Reviewing your session: tests, prompts, code and answers…');
        const latest = await readPractice(dir);
        const diff = await finalDiff(dir, problem, latest);
        let llm = null, model = null;
        try {
          const available = await models();
          model = available.models.find(m => m.name === available.reviewer) || null;
          llm = request => ollama('/api/chat', request, 300000);
        } catch {}
        const report = await review(latest, problem, {llm, model, diff});
        await finishReview(dir, report);
        return view(await open(data.id));
      });
    }
    throw new Error('Unknown endpoint.');
  }

  // An edit or command waiting for approval in an agent chat names the old
  // language's files; after a language switch it must not run.
  async function cancelPendingAgentCalls(dir, text) {
    const folder = path.join(dir, 'assistant');
    let names = [];
    try { names = (await fs.readdir(folder)).filter(name => name.endsWith('.json')); } catch { return; }
    for (const name of names) {
      const file = path.join(folder, name);
      try {
        const chat = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!chat.pending) continue;
        chat.pending = null;
        chat.items = [...(chat.items || []), {id: randomUUID(), at: Date.now(), type: 'notice', text}];
        await fs.writeFile(file, JSON.stringify(chat));
      } catch {}
    }
  }

  async function finalDiff(dir, problem, state) {
    // Measured from where this language's code started (after a switch, that includes reference fixes).
    const baseline = await baselineFiles(problem, state);
    const current = await workspaceFiles(dir);
    let text = '';
    for (const name of [...new Set([...Object.keys(baseline), ...Object.keys(current)])].sort()) {
      if (LANGUAGES[state.language].canonical(name) && state.readonly.includes(name)) continue;
      const before = baseline[name] ?? '', after = current[name] ?? '';
      if (before !== after) text += diffText(before, after, name + (baseline[name] === undefined ? ' (new file)' : ''));
    }
    return text || '(no code changes)';
  }

  // Streams the assistant's reply as NDJSON lines: {delta} … {done}.
  async function chat(req, res, data) {
    const session = await open(data.id);
    const {dir, problem, state} = session;
    if (state.status !== 'active') throw new Error('This session has ended.');
    const question = String(data.message || '').trim();
    if (!question || question.length > 12000) throw new Error('Enter a message under 12,000 characters.');
    const available = await models();
    const model = available.models.find(m => m.name === data.model) || available.models.find(m => m.name === available.assistant);
    if (!model) throw new Error('No local chat model is installed. Open Local setup to download one.');
    const files = await workspaceFiles(dir);
    const openFile = typeof data.openFile === 'string' && data.openFile in files ? data.openFile : null;
    const messages = assistantMessages(state, problem, files, {openFile, question});
    const signals = promptSignals(question, problem, state.language, await vocabulary(problem, state.language));
    const asked = Date.now();
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });
    let response;
    try {
      response = await fetch(OLLAMA + '/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal, body: JSON.stringify(chatRequest(model, {messages, temperature: 0.3, numPredict: 2048}))});
    } catch { throw new Error('Ollama is not responding. Start Ollama, then try again.'); }
    if (!response.ok) { const text = await response.text(); let message = text; try { message = JSON.parse(text).error; } catch {} throw new Error(message || 'The model request failed.'); }
    res.writeHead(200, {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    res.write(JSON.stringify({start: true, model: model.name}) + '\n');
    let reply = '', buffer = '', stopped = false, failure = null;
    const decoder = new TextDecoder();
    try {
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, {stream: true});
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line) continue;
          const part = JSON.parse(line);
          if (part.error) throw new Error(part.error);
          const delta = part.message?.content || '';
          if (delta) { reply += delta; res.write(JSON.stringify({delta}) + '\n'); }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) stopped = true; else failure = error.message;
    }
    await mutate(dir, problem, s => {
      const now = Date.now();
      s.chat.push({role: 'user', content: question, at: asked, phase: s.unlocked, model: model.name, openFile});
      if (reply) s.chat.push({role: 'assistant', content: reply, at: now, phase: s.unlocked, model: model.name, stopped});
      s.events.push({type: 'prompt', at: asked, phase: s.unlocked, chars: question.length, model: model.name, ...signals});
      if (reply) s.events.push({type: 'reply', at: now, phase: s.unlocked, chars: reply.length, codeBlocks: (reply.match(/```/g) || []).length / 2 | 0});
    }, {requireActive: false}).catch(() => {});
    if (!res.writableEnded) {
      res.write(JSON.stringify(failure ? {error: failure} : {done: true, stopped}) + '\n');
      res.end();
    }
  }

  return {handle, chat, models};
}
