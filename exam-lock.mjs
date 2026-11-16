// While a practice test or a coding mock interview is running, its questions
// are locked for the regular AI assistant and inline suggestions. Inside the
// test, the test's own AI level applies, whatever the browser asks for.
import fs from 'node:fs/promises';
import path from 'node:path';

export const GRACE_MS = 15000;

// One instance per sessions folder, so tests and interviews can clear it the
// moment they start or end.
const instances = new Map();
export function examLocks(SESSIONS) {
  if (!instances.has(SESSIONS)) instances.set(SESSIONS, createLocks(SESSIONS));
  return instances.get(SESSIONS);
}

function createLocks(SESSIONS) {
  const seen = new Map();
  let cache = null, cachedAt = 0;

  // Reads each file only when it changed since the last scan.
  async function scan(dir, summarize) {
    let names = [];
    try { names = (await fs.readdir(dir)).filter(n => n.endsWith('.json')); } catch { return []; }
    const out = [];
    for (const name of names) {
      const file = path.join(dir, name);
      try {
        const {mtimeMs} = await fs.stat(file);
        let entry = seen.get(file);
        if (!entry || entry.mtimeMs !== mtimeMs) {
          entry = {mtimeMs, summary: summarize(JSON.parse(await fs.readFile(file, 'utf8')))};
          seen.set(file, entry);
        }
        if (entry.summary) out.push(entry.summary);
      } catch {}
    }
    return out;
  }

  async function all() {
    if (cache && Date.now() - cachedAt < 2000) return cache;
    const tests = await scan(path.join(SESSIONS, 'tests'), s => s.status === 'active' && s.deadline
      ? {kind: 'test', id: s.id, ai: s.settings?.ai || 'none', deadline: s.deadline, questions: (s.questions || []).filter(q => q.type === 'coding').map(q => q.ref)} : null);
    const mocks = await scan(path.join(SESSIONS, 'mock'), s => s.type === 'coding' && s.status === 'active'
      ? {kind: 'interview', id: s.id, deadline: s.deadline, questions: [s.questionId]} : null);
    cache = [...tests, ...mocks];
    cachedAt = Date.now();
    return cache;
  }

  return {
    async lockFor(questionId) {
      const now = Date.now();
      return (await all()).find(lock => now <= lock.deadline + GRACE_MS && lock.questions.includes(questionId)) || null;
    },
    clear() { cache = null; }
  };
}

export const lockMessage = lock => lock.kind === 'test'
  ? 'This question is part of a practice test that is in progress. Use the AI assistant inside the test, if the test allows it.'
  : 'This question is in a mock interview that is in progress. The AI assistant is off for it until the interview ends.';
