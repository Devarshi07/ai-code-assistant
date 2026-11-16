// Tests for the ML, API and SQL content: the question bank, the practice-test
// templates and their skills filter, question titles, the ML interview formats
// and the prep guides.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadMcqBank} from '../mcq.mjs';
import {loadQuestions} from '../coding.mjs';
import {testRoutes, TEST_TEMPLATES} from '../tests-engine.mjs';
import {TALK_FORMATS, ROLES} from '../mock.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ML_TOPICS = ['Machine Learning', 'Deep Learning', 'LLMs and RAG', 'ML Systems'];
const NON_CS = [...ML_TOPICS, 'REST APIs', 'SQL'];

async function withTests(fn) {
  const SESSIONS = await fs.mkdtemp(path.join(os.tmpdir(), 'dg-content-'));
  try { await fn(testRoutes({SESSIONS, job: f => f(() => {}), coding: {}, models: async () => ({models: []}), OLLAMA: 'http://127.0.0.1:9'})); }
  finally { await fs.rm(SESSIONS, {recursive: true, force: true}); }
}
const create = (tests, data) => tests.handle({method: 'POST'}, new URL('http://x/api/tests/create'), data);

test('the bank has ML, REST API and SQL questions, with several-answer and written ones', async () => {
  const bank = await loadMcqBank({fresh: true});
  assert.deepEqual(bank.problems, []);
  const ml = bank.mcq.filter(q => ML_TOPICS.includes(q.topic));
  assert.ok(ml.length >= 40, `${ml.length} ML multiple-choice questions`);
  for (const topic of ML_TOPICS) assert.ok(ml.some(q => q.topic === topic), topic);
  assert.ok(ml.filter(q => q.type === 'multiple').length >= 8, 'some ML questions have several answers');
  assert.ok(bank.subjective.filter(q => ML_TOPICS.includes(q.topic)).length >= 8, 'ML written answers');
  for (const topic of ['REST APIs', 'SQL']) assert.ok(bank.mcq.filter(q => q.topic === topic).length >= 5, topic);
});

test('the ML and API/SQL templates build, drawing from their topics', () => withTests(async tests => {
  const template = TEST_TEMPLATES.find(t => t.id === 'ml-engineer');
  const ml = await create(tests, {template: 'ml-engineer'});
  assert.equal(ml.questions.length, template.sections.reduce((sum, s) => sum + s.count, 0));
  assert.ok(ml.questions.filter(q => q.type !== 'coding').every(q => ML_TOPICS.includes(q.topic)));
  assert.equal(ml.questions.filter(q => q.type === 'coding').length, 2);
  assert.equal(ml.questions.filter(q => q.type === 'subjective').length, 1);
  const api = await create(tests, {template: 'api-sql-backend'});
  assert.ok(api.questions.filter(q => q.type === 'mcq').every(q => ['REST APIs', 'SQL', 'Databases', 'Web'].includes(q.topic)));
  assert.equal(api.questions.filter(q => q.type === 'coding').length, 2);
}));

test('a skills filter prefers questions with the skill and falls back when none has it', () => withTests(async tests => {
  const questions = await loadQuestions({fresh: true});
  const easyStacks = questions.filter(q => q.difficulty === 'Easy' && q.skills.includes('Stacks')).map(q => q.id);
  assert.ok(easyStacks.length, 'the bank has an Easy question with the Stacks skill');
  const extra = [
    {id: 'skill-prefers', title: 'x', minutes: 10, sections: [{type: 'coding', count: 1, difficulty: 'Easy', skills: ['Stacks']}]},
    {id: 'skill-missing', title: 'x', minutes: 10, sections: [{type: 'coding', count: 2, difficulty: 'Easy', skills: ['No Such Skill']}]}
  ];
  TEST_TEMPLATES.push(...extra);
  try {
    for (let i = 0; i < 5; i++) assert.ok(easyStacks.includes((await create(tests, {template: 'skill-prefers'})).questions[0].ref));
    const fallback = await create(tests, {template: 'skill-missing'});
    assert.equal(fallback.questions.length, 2);
    assert.ok(fallback.questions.every(q => q.difficulty === 'Easy'));
  } finally { TEST_TEMPLATES.splice(TEST_TEMPLATES.length - extra.length, extra.length); }
}));

test('the general quizzes stay on computer-science topics', () => withTests(async tests => {
  for (let i = 0; i < 5; i++) {
    for (const id of ['fundamentals', 'swe-full', 'sample']) {
      const quiz = await create(tests, {template: id});
      assert.ok(quiz.questions.every(q => !NON_CS.includes(q.topic)), id);
    }
  }
}));

test('multiple-choice and written titles are prose, cut at a word boundary with an ellipsis', () => withTests(async tests => {
  const bank = await loadMcqBank();
  const byId = new Map([...bank.mcq, ...bank.subjective].map(q => [q.id, q]));
  let cut = 0;
  for (let round = 0; round < 6; round++) {
    const t = await create(tests, {custom: {mcq: 30, subjective: 4, minutes: 60}});
    for (const q of t.questions) {
      assert.ok(q.title.length > 0 && q.title.length <= 80, q.title);
      assert.ok(!q.title.startsWith('|') && !/^\S{1,30}:$/.test(q.title), `title is prose: ${q.title}`);
      if (!q.title.endsWith('…')) continue;
      cut++;
      const prefix = q.title.slice(0, -1);
      const source = byId.get(q.ref).question.replace(/[`*#]/g, '');
      const at = source.indexOf(prefix);
      assert.ok(at >= 0, `title comes from the question: ${q.title}`);
      assert.match(source[at + prefix.length] || ' ', /[\s,;:.(-]/, `cut at a word boundary: ${q.title}`);
    }
  }
  assert.ok(cut > 0, 'some long titles were shortened');
}));

test('the ML interview formats are complete', () => {
  for (const id of ['ml-design', 'ml-screen', 'ml-deep-dive']) {
    const f = TALK_FORMATS[id];
    assert.ok(f, id);
    assert.equal(f.areas.length, 4, id);
    assert.ok(f.areas.every(a => a.key && a.label && a.description), id);
    assert.ok(f.title && f.blurb && f.guide && f.minutes > 0, id);
    const intro = f.intro({minutes: f.minutes, role: 'Machine learning engineer', level: 'Senior', topic: f.topics?.[0] ?? null});
    assert.ok(intro.includes(`${f.minutes}`), `${id} intro mentions the length`);
  }
  const design = TALK_FORMATS['ml-design'];
  assert.equal(design.topics.length, 6);
  assert.ok(design.notes && design.stages.at(-1)[0] > 1);
  assert.ok(TALK_FORMATS['ml-deep-dive'].examples && TALK_FORMATS['ml-screen'].roleBased);
  for (const role of ['Machine learning engineer', 'AI engineer', 'Data scientist']) assert.ok(ROLES.includes(role), role);
});

test('every prep guide is listed in the index, exists and has a sensible length', async () => {
  const index = JSON.parse(await fs.readFile(path.join(ROOT, 'prep', 'index.json'), 'utf8'));
  const ids = new Set();
  for (const guide of index) {
    assert.match(guide.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(guide.id), `duplicate ${guide.id}`);
    ids.add(guide.id);
    assert.ok(guide.title && guide.summary && guide.minutes > 0, guide.id);
    const text = await fs.readFile(path.join(ROOT, 'prep', `${guide.id}.md`), 'utf8');
    const words = text.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 600 && words <= 1500, `${guide.id}: ${words} words`);
    assert.match(text, /^# \S/, `${guide.id} starts with a title`);
  }
  for (const id of ['ai-assisted-oa', 'hackerrank-style-oa', 'ml-interviews', 'api-and-backend', 'sql', 'sources']) assert.ok(ids.has(id), id);
  const files = (await fs.readdir(path.join(ROOT, 'prep'))).filter(name => name.endsWith('.md')).sort();
  assert.deepEqual(files, [...ids].map(id => `${id}.md`).sort(), 'every guide file is in the index');
});
