// Loads structured AI-coding problems from problems/<id>/ (see problems/AUTHORING.md).
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const PROBLEMS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'problems');
export const LANGUAGES = {
  python: {label: 'Python', main: 'main.py', ext: '.py', comment: '#', test: phase => `tests/test_phase${phase}.py`, custom: name => /^tests\/test_.*\.py$/.test(name)},
  javascript: {label: 'JavaScript', main: 'main.js', ext: '.js', comment: '//', test: phase => `tests/phase${phase}.test.js`, custom: name => /^tests\/.*\.test\.js$/.test(name)}
};
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
  const text = (value, label) => {
    if (typeof value === 'string' ? !value.trim() : !(value && typeof value === 'object' && Object.values(value).every(v => typeof v === 'string' && v.trim()))) errors.push(`${label} must be non-empty markdown (string or {python, javascript}).`);
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
  return {id, title, difficulty, pattern, summary, minutes, languages};
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
