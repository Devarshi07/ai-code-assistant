// Loads structured AI-coding problems from problems/<id>/ (see problems/AUTHORING.md).
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const PROBLEMS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'problems');
// Languages and framework stacks a guided problem can ship in. "runner" says
// where tests run: in the browser, in the Python sandbox, or in a Docker image
// with the framework installed (see stack-runner.mjs).
const testsDir = name => name.startsWith('tests/');
const pyTest = phase => `tests/test_phase${phase}.py`, pyCustom = name => /^tests\/test_.*\.py$/.test(name);
const jsTest = phase => `tests/phase${phase}.test.js`, jsCustom = name => /^tests\/.*\.test\.js$/.test(name);
const tsTest = phase => `tests/phase${phase}.test.ts`, tsCustom = name => /^tests\/.*\.test\.ts$/.test(name);
export const LANGUAGES = {
  python: {label: 'Python', family: 'python', runner: 'python', main: 'main.py', ext: '.py', comment: '#', test: pyTest, custom: pyCustom, canonical: testsDir,
    customExample: 'tests/test_custom.py', testInfo: 'Tests use unittest and run in Python 3.12.'},
  javascript: {label: 'JavaScript', family: 'javascript', runner: 'browser', main: 'main.js', ext: '.js', comment: '//', test: jsTest, custom: jsCustom, canonical: testsDir,
    customExample: 'tests/custom.test.js', testInfo: 'Tests use node:test and node:assert and run in Node.js.'},
  // Guided problems in more languages. They run in Docker like the API stacks.
  typescript: {label: 'TypeScript', family: 'javascript', runner: 'docker', image: 'node-api', main: 'main.ts', ext: '.ts', comment: '//', test: tsTest, custom: tsCustom, canonical: testsDir,
    customExample: 'tests/custom.test.ts', testInfo: 'Tests use node:test and node:assert/strict in Node.js 22, which runs TypeScript directly by stripping the types (there is no type check). Imports keep the .ts extension, types are imported with import type, and enums, namespaces and constructor parameter properties are not supported.'},
  java: {label: 'Java', family: 'java', runner: 'docker', image: 'java-junit', main: 'src/Main.java', ext: '.java', comment: '//', test: phase => `tests/Phase${phase}Test.java`, custom: name => /^tests\/.+Test\.java$/.test(name), canonical: testsDir,
    customExample: 'tests/CustomTest.java', testInfo: 'Tests are JUnit 5 on Java 21. Test classes live in tests/ and declare package tests. A run compiles everything in src/ and tests/ first (about 2 to 4 seconds).'},
  go: {label: 'Go', family: 'go', runner: 'docker', image: 'go-test', main: 'main.go', ext: '.go', comment: '//', test: phase => `tests/phase${phase}_test.go`, custom: name => /^tests\/.+_test\.go$/.test(name), canonical: testsDir,
    customExample: 'tests/custom_test.go', testInfo: 'Tests use the standard testing package (go test) in Go 1.24, with no third-party modules. The tests package in tests/ imports the code under test.'},
  express: {label: 'Node.js · Express', family: 'javascript', runner: 'docker', api: true, image: 'node-api', main: 'demo.js', ext: '.js', comment: '//', test: jsTest, custom: jsCustom, canonical: testsDir,
    customExample: 'tests/custom.test.js', testInfo: 'Tests use node:test and node:assert/strict in Node.js 22 with Express 4 installed. They start the app on a free port and send real HTTP requests.'},
  django: {label: 'Python · Django REST', family: 'python', runner: 'docker', api: true, image: 'python-django', main: 'demo.py', ext: '.py', comment: '#', test: pyTest, custom: pyCustom, canonical: testsDir,
    customExample: 'tests/test_custom.py', testInfo: 'Tests use unittest with the Django REST Framework test client (Django 5.2) on an in-memory SQLite database, in Python 3.12.'},
  fastapi: {label: 'Python · FastAPI', family: 'python', runner: 'docker', api: true, image: 'python-fastapi', main: 'demo.py', ext: '.py', comment: '#', test: pyTest, custom: pyCustom, canonical: testsDir,
    customExample: 'tests/test_custom.py', testInfo: "Tests use unittest with FastAPI's TestClient in Python 3.12."},
  spring: {label: 'Java · Spring Boot', family: 'java', runner: 'docker', api: true, image: 'java-spring', main: null, ext: '.java', comment: '//',
    test: phase => `src/test/java/com/debuggym/api/Phase${phase}Test.java`, custom: name => /^src\/test\/java\/.+Test\.java$/.test(name), canonical: name => name.startsWith('src/test/'),
    customExample: 'src/test/java/com/debuggym/api/CustomTest.java', testInfo: 'Tests are JUnit 5 with MockMvc (@SpringBootTest) on Spring Boot 3.4 and Java 21, built offline with Maven. A run compiles the project first, so a run takes about 10 to 20 seconds.'}
};
// Languages whose tests run in a Docker image through stack-runner.mjs.
export const isStack = language => LANGUAGES[language]?.runner === 'docker';
// Problems in a framework stack are back-end API projects.
export const isApi = language => LANGUAGES[language]?.api === true;
export const KINDS = ['bug', 'feature', 'optimize'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const TEXT_LIMIT = 150000;

export async function readTree(root, prefix = '', out = {}) {
  let entries;
  try { entries = await fs.readdir(path.join(root, prefix), {withFileTypes: true}); }
  catch (error) { if (error.code === 'ENOENT') return out; throw error; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name === '__pycache__' || entry.name === 'node_modules' || entry.isSymbolicLink()) continue;
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await readTree(root, name, out);
    else if (entry.isFile()) {
      const text = await fs.readFile(path.join(root, name), 'utf8');
      if (text.length <= TEXT_LIMIT && !text.includes('\0')) out[name] = text.replace(/\r\n/g, '\n');
    }
  }
  return out;
}

export function localize(value, language) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value[language] ?? value.python ?? Object.values(value)[0] ?? '';
  return value ?? '';
}

export function validateProblem(problem, dirName) {
  const errors = [];
  // Text is one string for every language, or one entry per language the problem ships in.
  const text = (value, label) => {
    if (typeof value === 'string' ? !value.trim() : !(value && typeof value === 'object' && Object.values(value).every(v => typeof v === 'string' && v.trim()))) errors.push(`${label} must be non-empty markdown (a string, or one per language).`);
    else if (typeof value === 'object' && Array.isArray(problem.languages)) for (const language of problem.languages) if (!(language in value)) errors.push(`${label} has no ${language} version.`);
  };
  if (problem.id !== dirName) errors.push(`id "${problem.id}" must match its directory "${dirName}".`);
  if (!/^[a-z0-9-]+$/.test(problem.id || '')) errors.push('id must be kebab-case.');
  for (const key of ['title', 'pattern', 'summary']) if (typeof problem[key] !== 'string' || !problem[key].trim()) errors.push(`${key} is required.`);
  if (!DIFFICULTIES.includes(problem.difficulty)) errors.push(`difficulty must be one of ${DIFFICULTIES.join(', ')}.`);
  if (!Number.isInteger(problem.minutes) || problem.minutes < 15 || problem.minutes > 90) errors.push('minutes must be an integer between 15 and 90.');
  if (!Array.isArray(problem.languages) || !problem.languages.length || problem.languages.some(l => !LANGUAGES[l])) errors.push(`languages must list ${Object.keys(LANGUAGES).join(', ')}.`);
  text(problem.overview, 'overview');
  if (!Array.isArray(problem.phases) || problem.phases.length !== 3) errors.push('phases must contain exactly 3 entries.');
  else problem.phases.forEach((phase, index) => {
    if (phase.kind !== KINDS[index]) errors.push(`phase ${index + 1} kind must be "${KINDS[index]}".`);
    if (typeof phase.title !== 'string' || !phase.title.trim()) errors.push(`phase ${index + 1} title is required.`);
    text(phase.instructions, `phase ${index + 1} instructions`);
    text(phase.answer, `phase ${index + 1} answer`);
    if (!Array.isArray(phase.hints) || phase.hints.length < 2 || phase.hints.length > 4) errors.push(`phase ${index + 1} needs 2–4 hints.`);
    else phase.hints.forEach((hint, i) => text(hint, `phase ${index + 1} hint ${i + 1}`));
  });
  if (!Array.isArray(problem.debrief) || problem.debrief.length !== 3 || problem.debrief.some(q => typeof q !== 'string' || !q.trim())) errors.push('debrief must contain 3 questions.');
  return errors;
}

let cached = null, cachedAt = 0;
export async function loadProblems({fresh = false} = {}) {
  // A short cache keeps newly authored content visible without a restart.
  if (cached && !fresh && Date.now() - cachedAt < 10000) return cached;
  const list = [];
  let entries = [];
  try { entries = await fs.readdir(PROBLEMS_DIR, {withFileTypes: true}); } catch {}
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const problem = JSON.parse(await fs.readFile(path.join(PROBLEMS_DIR, entry.name, 'problem.json'), 'utf8'));
      if (validateProblem(problem, entry.name).length) continue;
      list.push(problem);
    } catch {}
  }
  const order = {Easy: 0, Medium: 1, Hard: 2};
  list.sort((a, b) => order[a.difficulty] - order[b.difficulty] || a.title.localeCompare(b.title));
  cached = list;
  cachedAt = Date.now();
  return list;
}

export async function getProblem(id) {
  const problem = (await loadProblems()).find(p => p.id === id);
  if (!problem) throw new Error('Unknown problem.');
  return problem;
}

export function problemSummary(problem) {
  const {id, title, difficulty, pattern, summary, minutes, languages} = problem;
  return {id, title, difficulty, pattern, summary, minutes, languages, track: languages.some(isApi) ? 'api' : 'algorithm', languageLabels: Object.fromEntries(languages.map(l => [l, LANGUAGES[l].label]))};
}

// Problem content for one language, without answers unless requested.
export function problemFor(problem, language, {answers = false, unlocked = 3} = {}) {
  return {
    ...problemSummary(problem), language,
    overview: localize(problem.overview, language),
    phases: problem.phases.map((phase, index) => index < unlocked ? {
      number: index + 1, kind: phase.kind, title: phase.title,
      instructions: localize(phase.instructions, language),
      hintCount: phase.hints.length,
      ...(answers ? {answer: localize(phase.answer, language)} : {})
    } : {number: index + 1, kind: phase.kind, locked: true}),
    debrief: problem.debrief
  };
}

export function hint(problem, language, phase, index) {
  const list = problem.phases[phase - 1]?.hints || [];
  return index < list.length ? localize(list[index], language) : null;
}

export async function overlay(problem, language, name) {
  return readTree(path.join(PROBLEMS_DIR, problem.id, language, ...name.split('/')));
}

export function canonicalTests(language, unlocked) {
  return Array.from({length: unlocked}, (_, i) => LANGUAGES[language].test(i + 1));
}
