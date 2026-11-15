// HackerRank-style coding questions: the question bank in questions/, saved
// drafts and submissions per question, and Run Code / Submit Code routes.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JUDGE_LANGUAGES, judge, ensureJudgeImage} from './judge.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const QUESTIONS_DIR = path.join(ROOT, 'questions');
export const CODE_LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'go'];
export const TEMPLATE_FILES = {python: 'python.py', javascript: 'javascript.js', java: 'Solution.java', cpp: 'cpp.cpp', go: 'go.go'};
export const SKILLS = ['Arrays', 'Strings', 'Hash Tables', 'Sorting', 'Searching', 'Two Pointers', 'Sliding Window', 'Stacks', 'Queues', 'Linked Lists', 'Trees', 'Graphs', 'BFS', 'DFS', 'Greedy', 'Dynamic Programming', 'Recursion', 'Math', 'Bit Manipulation', 'Heaps', 'Intervals', 'Simulation', 'Implementation'];
const SCORES = {Easy: 30, Medium: 50, Hard: 80};

export function validateQuestion(q, dirName) {
  const errors = [];
  if (q.id !== dirName) errors.push(`id must match directory ${dirName}`);
  for (const key of ['title', 'summary', 'statement', 'functionDescription', 'inputFormat', 'constraints', 'outputFormat']) if (typeof q[key] !== 'string' || !q[key].trim()) errors.push(`${key} is required`);
  if (!SCORES[q.difficulty]) errors.push('difficulty must be Easy, Medium or Hard');
  if (q.maxScore !== SCORES[q.difficulty]) errors.push(`maxScore must be ${SCORES[q.difficulty]} for ${q.difficulty}`);
  if (!Array.isArray(q.skills) || !q.skills.length || q.skills.some(s => !SKILLS.includes(s))) errors.push('skills must come from the list in questions/AUTHORING.md');
  if (!Array.isArray(q.samples) || !q.samples.length || q.samples.some(s => typeof s.input !== 'string' || typeof s.output !== 'string')) errors.push('samples need input and output strings');
  if (!Array.isArray(q.tests) || q.tests.length < 6 || q.tests.some(t => !/^\d{2,3}$/.test(t.file || ''))) errors.push('tests must list at least 6 entries with a 2-3 digit file id');
  else if (q.tests.filter(t => t.sample).length !== q.samples.length) errors.push('mark exactly one test as sample per entry in samples');
  return errors;
}

let cached = null, cachedAt = 0;
export async function loadQuestions({fresh = false} = {}) {
  if (cached && !fresh && Date.now() - cachedAt < 10000) return cached;
  const list = [];
  let entries = [];
  try { entries = await fs.readdir(QUESTIONS_DIR, {withFileTypes: true}); } catch {}
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const q = JSON.parse(await fs.readFile(path.join(QUESTIONS_DIR, entry.name, 'question.json'), 'utf8'));
      if (!validateQuestion(q, entry.name).length) list.push(q);
    } catch {}
  }
  const order = {Easy: 0, Medium: 1, Hard: 2};
  cached = list.sort((a, b) => order[a.difficulty] - order[b.difficulty] || a.title.localeCompare(b.title));
  cachedAt = Date.now();
  return cached;
}

export async function getQuestion(id) {
  const q = (await loadQuestions()).find(item => item.id === id);
  if (!q) throw new Error('Unknown question.');
  return q;
}

export async function readTemplate(q, language, kind = 'templates') {
  if (!TEMPLATE_FILES[language]) throw new Error('Choose a supported language.');
  return fs.readFile(path.join(QUESTIONS_DIR, q.id, kind, TEMPLATE_FILES[language]), 'utf8');
}

export async function readTests(q, {samplesOnly = false} = {}) {
  const tests = [];
  for (const [index, test] of q.tests.entries()) {
    if (samplesOnly && !test.sample) continue;
    const dir = path.join(QUESTIONS_DIR, q.id, 'tests');
    tests.push({
      name: test.sample ? `Sample Test case ${q.tests.slice(0, index).filter(t => t.sample).length}` : `Test case ${index}`,
      // Test files may have been saved with CRLF endings; programs and the UI see LF.
      input: (await fs.readFile(path.join(dir, `input${test.file}.txt`), 'utf8')).replace(/\r\n/g, '\n'),
      expected: (await fs.readFile(path.join(dir, `output${test.file}.txt`), 'utf8')).replace(/\r\n/g, '\n'),
      sample: !!test.sample, hidden: !test.sample, weight: test.weight ?? 1
    });
  }
  return tests;
}

export function publicQuestion(q) {
  const {tests, ...rest} = q;
  return {...rest, testCount: tests.length, sampleCount: tests.filter(t => t.sample).length, languages: CODE_LANGUAGES.map(id => ({id, label: JUDGE_LANGUAGES[id].label, limit: JUDGE_LANGUAGES[id].limit}))};
}

export function codingRoutes({SESSIONS, run, job}) {
  const stateDir = path.join(SESSIONS, 'coding');
  const statePath = id => path.join(stateDir, `${id}.json`);
  const readState = async id => { try { return JSON.parse(await fs.readFile(statePath(id), 'utf8')); } catch { return {drafts: {}, language: null, submissions: [], runs: 0}; } };
  const writeState = async (id, state) => { await fs.mkdir(stateDir, {recursive: true}); await fs.writeFile(statePath(id), JSON.stringify(state)); };
  const locks = new Map();
  const exclusive = async (id, fn) => {
    const previous = locks.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    locks.set(id, next);
    try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
  };
  const summary = state => {
    const best = state.submissions.reduce((top, s) => !top || s.score > top.score ? s : top, null);
    return {status: best && best.passed === best.total ? 'solved' : state.submissions.length || state.runs ? 'attempted' : 'new', best: best ? {score: best.score, language: best.language, at: best.at} : null};
  };

  async function evaluate({question, language, code, customInput, mode, progress}) {
    await ensureJudgeImage(run, language, progress);
    let cases;
    if (mode === 'custom') cases = [{name: 'Custom input', input: String(customInput ?? ''), custom: true}];
    else cases = await readTests(question, {samplesOnly: mode === 'run'});
    if (mode === 'submit') progress(`Running ${cases.length} test cases…`);
    const result = await judge(run, {language, code, cases, scratch: path.join(SESSIONS, 'coding', 'runs'), onProgress: progress});
    result.score = mode === 'submit' ? Math.round(question.maxScore * (result.fraction ?? 0) * 100) / 100 : undefined;
    result.maxScore = question.maxScore;
    result.mode = mode;
    return result;
  }

  async function handle(req, url, data) {
    const p = url.pathname;
    if (!p.startsWith('/api/coding')) return undefined;
    if (req.method === 'GET' && p === '/api/coding/questions') {
      const questions = await loadQuestions();
      return Promise.all(questions.map(async q => ({id: q.id, title: q.title, difficulty: q.difficulty, maxScore: q.maxScore, skills: q.skills, summary: q.summary, ...summary(await readState(q.id))})));
    }
    if (req.method === 'GET' && p === '/api/coding/question') {
      const q = await getQuestion(url.searchParams.get('id'));
      const state = await readState(q.id);
      return {...publicQuestion(q), state: {drafts: state.drafts, language: state.language, submissions: state.submissions.slice(-30).reverse(), ...summary(state)}};
    }
    if (req.method === 'GET' && p === '/api/coding/template') {
      const q = await getQuestion(url.searchParams.get('id'));
      return {code: await readTemplate(q, url.searchParams.get('language'))};
    }
    if (req.method !== 'POST') return undefined;
    const q = await getQuestion(data.id);
    if (p === '/api/coding/save') {
      if (!CODE_LANGUAGES.includes(data.language) || typeof data.code !== 'string' || data.code.length > 200000) throw new Error('Invalid draft.');
      return exclusive(q.id, async () => { const state = await readState(q.id); state.drafts[data.language] = data.code; state.language = data.language; await writeState(q.id, state); return {saved: true}; });
    }
    if (p === '/api/coding/run' || p === '/api/coding/submit') {
      if (!CODE_LANGUAGES.includes(data.language)) throw new Error('Choose a supported language.');
      const mode = p.endsWith('submit') ? 'submit' : data.customInput !== undefined && data.customInput !== null ? 'custom' : 'run';
      return job(async progress => {
        const result = await evaluate({question: q, language: data.language, code: data.code, customInput: data.customInput, mode, progress});
        await exclusive(q.id, async () => {
          const state = await readState(q.id);
          state.drafts[data.language] = data.code;
          state.language = data.language;
          state.runs = (state.runs || 0) + 1;
          if (mode === 'submit') state.submissions.push({at: Date.now(), language: data.language, score: result.score, maxScore: q.maxScore, passed: result.passed, total: result.total, compiled: result.compiled, verdicts: result.tests.map(t => t.status), code: data.code});
          state.submissions = state.submissions.slice(-50);
          await writeState(q.id, state);
        });
        return result;
      });
    }
    throw new Error('Unknown endpoint.');
  }

  return {handle, evaluate, readState};
}
