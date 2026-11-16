// Measures how quickly the AI answers through the running app (npm start first):
// time to the first streamed word and to the end of the reply, for the coding
// assistant and the mock interviewer, alternating between them the way an
// interview with an AI assistant does. It leaves two assistant chats and an
// ended mock interview in your history.
//   node scripts/ai-benchmark.mjs
const BASE = process.env.DG_URL || 'http://127.0.0.1:3210';
const QUESTION = 'pairs-with-difference';

async function json(path, body) {
  const response = await fetch(BASE + path, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `${path} failed`);
  return data;
}

async function timed(path, body) {
  const started = performance.now();
  const response = await fetch(BASE + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `${path} failed`);
  const decoder = new TextDecoder();
  let buffer = '', first = null, text = '', chat = null;
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, {stream: true});
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === 'start' && event.chat) chat = event.chat;
      if (event.type === 'delta') { first ??= performance.now(); text += event.text; }
      if (event.type === 'error') throw new Error(event.message);
    }
  }
  return {first: first === null ? null : (first - started) / 1000, total: (performance.now() - started) / 1000, chars: text.length, chat};
}

const rows = [];
const record = (label, r) => { rows.push({step: label, 'first word (s)': r.first?.toFixed(2) ?? '—', 'full reply (s)': r.total.toFixed(2), chars: r.chars}); console.log(`${label}: first word ${r.first?.toFixed(2) ?? '—'} s, full reply ${r.total.toFixed(2)} s`); };

const code = (await json(`/api/coding/template?id=${QUESTION}&language=python`)).code;
const ask = (message, chat) => timed('/api/assistant/send', {scope: 'question', question: QUESTION, language: 'python', code, lastRun: '', help: 'guided', mode: 'ask', message, ...(chat ? {chat} : {})});

const first = await ask('Explain the problem with a small example.');
record('1. Assistant, first question', first);
record('2. Assistant, follow-up', await ask('What approach would fit these constraints?', first.chat));
// The interview uses another question: the assistant is locked for a question under interview.
const MOCK_QUESTION = 'bracket-checker';
const mockCode = (await json(`/api/coding/template?id=${MOCK_QUESTION}&language=python`)).code;
const mock = await json('/api/mock/start', {type: 'coding', question: MOCK_QUESTION, language: 'python', minutes: 30});
const say = text => timed('/api/mock/message', {id: mock.id, kind: 'message', text, code: mockCode});
record('3. Interviewer reply', await say('Can I assume the whole input fits in memory? I am thinking of a hash set.'));
record('4. Assistant again', await ask('What edge cases should I test?'));
record('5. Interviewer again', await say('I would push opening brackets on a stack and pop on a match. That is O(n).'));
await json('/api/mock/end', {id: mock.id}).catch(() => {});
console.table(rows);
