// Multiple-choice and written-answer (subjective) questions for practice
// tests. Each topic lives in mcq/<topic-file>.json; written answers live in
// mcq/subjective.json. See mcq/AUTHORING.md.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const MCQ_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mcq');
export const MCQ_TOPICS = ['Data Structures', 'Algorithms', 'Complexity', 'Databases', 'Operating Systems', 'Networking', 'Concurrency', 'Security', 'Object-Oriented Design', 'System Design', 'Testing', 'Git', 'Web', 'Python', 'JavaScript', 'Java', 'Machine Learning', 'Deep Learning', 'LLMs and RAG', 'ML Systems', 'REST APIs', 'SQL'];
export const MCQ_POINTS = {Easy: 5, Medium: 10, Hard: 15};
export const SUBJECTIVE_POINTS = {Easy: 10, Medium: 20, Hard: 30};

export function validateMcq(q) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(q.id || '')) errors.push('id must be kebab-case');
  if (!MCQ_TOPICS.includes(q.topic)) errors.push(`topic must be one of: ${MCQ_TOPICS.join(', ')}`);
  if (!MCQ_POINTS[q.difficulty]) errors.push('difficulty must be Easy, Medium or Hard');
  if (q.points !== MCQ_POINTS[q.difficulty]) errors.push(`points must be ${MCQ_POINTS[q.difficulty]}`);
  if (!['single', 'multiple'].includes(q.type)) errors.push('type must be single or multiple');
  if (typeof q.question !== 'string' || !q.question.trim()) errors.push('question is required');
  if (!Array.isArray(q.options) || q.options.length < 4 || q.options.length > 6 || q.options.some(o => typeof o !== 'string' || !o.trim())) errors.push('options must be 4–6 non-empty strings');
  else if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length) errors.push('options must be distinct');
  if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some(i => !Number.isInteger(i) || i < 0 || i >= (q.options?.length || 0)) || new Set(q.answer).size !== q.answer.length) errors.push('answer must list valid option indexes');
  else if (q.type === 'single' && q.answer.length !== 1) errors.push('a single-answer question has exactly one answer');
  else if (q.type === 'multiple' && q.answer.length < 2) errors.push('a multiple-answer question has at least two answers');
  if (typeof q.explanation !== 'string' || !q.explanation.trim()) errors.push('explanation is required');
  return errors;
}

export function validateSubjective(q) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(q.id || '')) errors.push('id must be kebab-case');
  if (!MCQ_TOPICS.includes(q.topic)) errors.push('topic must come from the MCQ topic list');
  if (!SUBJECTIVE_POINTS[q.difficulty]) errors.push('difficulty must be Easy, Medium or Hard');
  if (q.points !== SUBJECTIVE_POINTS[q.difficulty]) errors.push(`points must be ${SUBJECTIVE_POINTS[q.difficulty]}`);
  if (typeof q.question !== 'string' || !q.question.trim()) errors.push('question is required');
  if (!Array.isArray(q.rubric) || q.rubric.length < 3 || q.rubric.length > 6 || q.rubric.some(r => typeof r !== 'string' || !r.trim())) errors.push('rubric must list 3–6 points a strong answer makes');
  if (typeof q.sampleAnswer !== 'string' || q.sampleAnswer.trim().split(/\s+/).length < 40) errors.push('sampleAnswer must be at least 40 words');
  return errors;
}

let cache = null, cachedAt = 0;
export async function loadMcqBank({fresh = false} = {}) {
  if (cache && !fresh && Date.now() - cachedAt < 10000) return cache;
  const mcq = [], subjective = [], problems = [];
  let names = [];
  try { names = (await fs.readdir(MCQ_DIR)).filter(n => n.endsWith('.json')); } catch {}
  for (const name of names.sort()) {
    let items;
    try { items = JSON.parse(await fs.readFile(path.join(MCQ_DIR, name), 'utf8')); } catch (error) { problems.push(`${name}: ${error.message}`); continue; }
    if (!Array.isArray(items)) { problems.push(`${name}: must contain an array`); continue; }
    for (const item of items) {
      const errors = name === 'subjective.json' ? validateSubjective(item) : validateMcq(item);
      if (errors.length) problems.push(`${name} · ${item.id || '(no id)'}: ${errors.join('; ')}`);
      else (name === 'subjective.json' ? subjective : mcq).push(item);
    }
  }
  const ids = new Set();
  for (const item of [...mcq, ...subjective]) { if (ids.has(item.id)) problems.push(`duplicate id ${item.id}`); ids.add(item.id); }
  cache = {mcq, subjective, problems};
  cachedAt = Date.now();
  return cache;
}

// What the candidate sees: no answers, explanations or rubrics.
export const publicMcq = ({answer, explanation, ...q}) => ({...q, multiple: q.type === 'multiple'});
export const publicSubjective = ({rubric, sampleAnswer, ...q}) => q;

// Single-answer questions are all or nothing. Multiple-answer questions give
// partial credit for each correct option chosen, but choosing more options
// than there are correct answers scores zero, as on assessment platforms.
export function scoreMcq(q, selected) {
  const chosen = [...new Set((Array.isArray(selected) ? selected : []).filter(Number.isInteger))];
  const correct = new Set(q.answer);
  const hits = chosen.filter(i => correct.has(i)).length;
  const right = hits === correct.size && chosen.length === correct.size;
  let score = 0;
  if (q.type === 'single') score = right ? q.points : 0;
  else if (chosen.length <= correct.size) score = Math.round(q.points * hits / correct.size * 100) / 100;
  return {correct: right, partial: !right && score > 0, score, answered: chosen.length > 0};
}
