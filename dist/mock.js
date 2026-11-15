// AI mock interviews: the lobby, the coding interview room (interviewer chat
// with voice beside a code editor), the interviewer panel used inside the
// code-repo workspace for AI-fluency interviews, and the feedback report
// with a 15-minute follow-up conversation.
import {el, api, waitJob, notify, clock, confirmDialog, store, icon, splitter, DIFFICULTY_CLASS, VERDICT_CLASS} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {loadMonaco, editorOptions, applySettings, settings, monacoLanguage} from './monaco.js';
import {enterFullscreen, loadStatus, getStatus} from './app.js';

const EXT = {python: 'py', javascript: 'js', java: 'java', cpp: 'cpp', go: 'go'};
const LANGUAGE_LABEL = {python: 'Python 3', javascript: 'JavaScript (Node.js)', java: 'Java 21', cpp: 'C++20', go: 'Go'};
const SCORE_LABEL = {1: 'Poor', 2: 'Below expectations', 3: 'Meets expectations', 4: 'Strong', 5: 'Exceptional'};

// ---------- lobby ----------
export async function renderMockLobby(root) {
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading…'));
  const [options, history, s] = await Promise.all([api('/api/mock/options'), api('/api/mock/list'), getStatus() ? Promise.resolve(getStatus()) : loadStatus().catch(() => null)]);
  const select = (label, opts, value, key) => {
    const node = el('select', {'aria-label': label, onchange: () => store.set(key, node.value)}, opts.map(([v, t]) => el('option', {value: v, text: t})));
    node.value = store.get(key, value);
    if (!node.value) node.value = value;
    return el('label', {class: 'field'}, el('span', {text: label}), node);
  };
  const codingLang = select('Language', options.languages.map(l => [l.id, l.label]), 'python', 'dg-mock-language');
  const codingDiff = select('Difficulty', [['any', 'Any'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']], 'Medium', 'dg-mock-difficulty');
  const codingQ = select('Question', [['', 'Pick one for me'], ...options.questions.map(q => [q.id, `${q.title} · ${q.difficulty}`])], '', 'dg-mock-question');
  const codingTime = select('Duration', [['30', '30 minutes'], ['45', '45 minutes'], ['60', '60 minutes']], '45', 'dg-mock-minutes');
  const fluencyLang = select('Language', [['python', 'Python'], ['javascript', 'JavaScript']], 'python', 'dg-fluency-language');
  const fluencyProblem = select('Codebase', [['', 'Pick one for me'], ...options.problems.map(p => [p.id, `${p.title} · ${p.difficulty} · ${p.minutes} min`])], '', 'dg-fluency-problem');
  const needs = [];
  if (s && (!s.ollama || !s.models.models.length)) needs.push('Start Ollama and download a chat model (ollama pull qwen3:8b): the interviewer runs on it.');
  if (s && !s.docker) needs.push('Start Docker Desktop to run code during a coding interview.');
  const start = async (button, body) => {
    button.disabled = true;
    const label = button.textContent;
    button.textContent = 'Starting…';
    try {
      const mock = await api('/api/mock/start', body);
      location.hash = mock.type === 'fluency' ? `#/ade/practice/${mock.practiceId}/mock/${mock.id}` : `#/mock/${mock.id}`;
    } catch (error) { notify(error.message, 'error'); button.disabled = false; button.textContent = label; }
  };
  const codingStart = el('button', {class: 'button primary', onclick: e => start(e.currentTarget, {type: 'coding', language: codingLang.lastChild.value, difficulty: codingDiff.lastChild.value, question: codingQ.lastChild.value || undefined, minutes: Number(codingTime.lastChild.value)})}, 'Start coding interview');
  const fluencyStart = el('button', {class: 'button primary', onclick: e => start(e.currentTarget, {type: 'fluency', language: fluencyLang.lastChild.value, problem: fluencyProblem.lastChild.value || undefined})}, 'Start AI-fluency interview');
  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Mock interviews'}), el('span', {class: 'title-badge', text: 'AI interviewer'})),
    el('p', {class: 'page-lead', text: 'A realistic interview with an AI interviewer. Talk by text or voice, think out loud, and get a scored report with an overall recommendation when you finish. Then ask the interviewer about the feedback for 15 minutes.'}),
    ...(needs.length ? [el('div', {class: 'notice-banner'}, icon('bulb'), el('div', {}, needs.map(n => el('p', {text: n}))))] : []),
    el('div', {class: 'mock-grid'},
      el('section', {class: 'mock-card'},
        el('div', {class: 'mock-card-head'}, el('div', {class: 'track-icon'}, icon('code')), el('div', {}, el('h2', {text: 'Coding interview'}), el('p', {class: 'muted', text: 'Problem solving with a live interviewer'}))),
        el('ul', {class: 'check-list'}, el('li', {text: 'The interviewer presents a problem and answers clarifying questions'}), el('li', {text: 'Explain your approach and its complexity, then code it in the editor'}), el('li', {text: 'Run against samples, submit, and handle follow-up questions'}), el('li', {text: 'Scored on problem solving, code quality, communication and language proficiency'})),
        el('div', {class: 'field-grid'}, codingLang, codingDiff, codingQ, codingTime), codingStart),
      el('section', {class: 'mock-card'},
        el('div', {class: 'mock-card-head'}, el('div', {class: 'track-icon'}, icon('agent')), el('div', {}, el('h2', {text: 'AI-fluency interview'}), el('p', {class: 'muted', text: 'Working with an AI agent in a real codebase'}))),
        el('ul', {class: 'check-list'}, el('li', {text: 'Fix a bug, build a feature and optimize, using the AI agent'}), el('li', {text: 'The interviewer watches how you prompt, review and steer the AI'}), el('li', {text: 'It asks why you made each call and how you verified the result'}), el('li', {text: 'Scored on framing, judging and steering'})),
        el('div', {class: 'field-grid'}, fluencyLang, fluencyProblem), fluencyStart)),
    el('section', {class: 'panel'}, el('h2', {text: 'Previous interviews'}),
      history.length ? el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'Interview'}), el('th', {text: 'Type'}), el('th', {text: 'Date'}), el('th', {text: 'Result'}), el('th', {}))),
        el('tbody', {}, history.map(m => el('tr', {},
          el('td', {text: m.title}), el('td', {text: m.type === 'coding' ? `Coding · ${LANGUAGE_LABEL[m.language] || m.language}` : 'AI fluency'}), el('td', {text: new Date(m.started).toLocaleString()}),
          el('td', {}, m.recommendation ? el('span', {class: `result-chip verdict-text ${VERDICT_CLASS[m.recommendation]}`, text: `${m.recommendation} · ${m.average?.toFixed(1)}/5`}) : el('span', {class: 'status-pill active', text: m.status === 'active' ? 'In progress' : 'Reviewing'})),
          el('td', {class: 'actions'}, el('a', {class: 'button small', href: m.status === 'ended' ? `#/mockreport/${m.id}` : m.type === 'fluency' ? `#/ade/practice/${m.practiceId}/mock/${m.id}` : `#/mock/${m.id}`}, m.status === 'ended' ? 'Feedback' : 'Resume'))))))
        : el('p', {class: 'muted', text: 'No interviews yet.'})));
}

// ---------- voice ----------
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
function speak(text) {
  if (!('speechSynthesis' in window) || !store.get('dg-voice-out', true)) return;
  const plain = String(text).replace(/```[\s\S]*?```/g, ' (see the code in the chat) ').replace(/[*_`#>|]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(plain.slice(0, 1500));
  utterance.rate = 1.03;
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => /en[-_](US|GB)/i.test(v.lang) && /natural|neural|online/i.test(v.name)) || voices.find(v => /^en/i.test(v.lang));
  if (preferred) utterance.voice = preferred;
  speechSynthesis.speak(utterance);
}

// ---------- the interviewer panel ----------
export function createInterviewerPanel(id, {mode = 'interview', onEnded, getCode, getLanguage, onState, compact = false} = {}) {
  let state = null, streaming = null, recognition = null, listening = false, lastActivity = Date.now(), nudgeTimer = null, disposed = false;
  const refs = {};
  refs.log = el('div', {class: 'iv-log', role: 'log', 'aria-live': 'polite'});
  refs.input = el('textarea', {rows: 2, maxlength: 6000, placeholder: mode === 'followup' ? 'Ask about your feedback…' : 'Reply to the interviewer, or think out loud…', 'aria-label': 'Message the interviewer'});
  refs.send = el('button', {class: 'send-button', title: 'Send (Enter)', 'aria-label': 'Send', onclick: () => streaming ? streaming.abort() : send()}, icon('send'));
  refs.mic = el('button', {class: 'icon-button mic', title: Recognition ? 'Speak your answer' : 'Voice input is not supported in this browser', 'aria-label': 'Voice input', disabled: !Recognition, onclick: () => toggleMic()}, icon('mic'));
  refs.voice = el('button', {class: 'icon-button', title: 'Read the interviewer\'s replies aloud', 'aria-label': 'Toggle spoken replies', onclick: () => { store.set('dg-voice-out', !store.get('dg-voice-out', true)); if (!store.get('dg-voice-out', true)) speechSynthesis?.cancel(); paintVoice(); }});
  refs.hint = el('button', {class: 'button ghost small', onclick: () => send({kind: 'hint'})}, icon('bulb'), 'Hint');
  refs.status = el('div', {class: 'iv-status muted small', hidden: true});
  const paintVoice = () => { const on = store.get('dg-voice-out', true); refs.voice.replaceChildren(icon(on ? 'speaker' : 'mute')); refs.voice.setAttribute('aria-pressed', String(on)); };
  paintVoice();
  refs.input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!streaming) send(); } });
  refs.input.addEventListener('input', () => { refs.input.style.height = 'auto'; refs.input.style.height = Math.min(180, Math.max(48, refs.input.scrollHeight)) + 'px'; lastActivity = Date.now(); });
  const root = el('div', {class: `interviewer${compact ? ' compact' : ''}`},
    el('div', {class: 'iv-head'}, el('div', {class: 'iv-avatar'}, icon('user')), el('div', {}, el('strong', {text: 'AI interviewer'}), el('small', {class: 'muted', text: mode === 'followup' ? 'Feedback discussion' : 'Practice interview'})), el('span', {class: 'grow'}), refs.voice),
    refs.log, refs.status,
    el('div', {class: 'iv-composer'}, el('div', {class: 'composer-field'}, refs.input), el('div', {class: 'composer-foot'}, mode === 'interview' ? refs.hint : null, el('span', {class: 'grow'}), refs.mic, refs.send)),
    Recognition ? el('p', {class: 'iv-note muted small', text: 'Voice input uses your browser\'s speech service; in Chrome and Edge the audio is transcribed online.'}) : null);

  function transcript() { return mode === 'followup' ? state?.followup?.transcript || [] : state?.transcript || []; }
  function render() {
    const nodes = transcript().map(m => m.role === 'event'
      ? el('div', {class: 'iv-event'}, icon(m.run ? 'play' : 'flag'), el('span', {text: m.text}))
      : el('div', {class: `iv-msg ${m.role}`}, m.role === 'interviewer' ? el('div', {class: 'iv-avatar small'}, icon('user')) : null,
        el('div', {class: 'iv-bubble'}, m.role === 'interviewer' ? el('div', {class: 'md'}, renderMarkdown(m.text)) : el('div', {text: m.hint ? '💡 Asked for a hint' : m.text}))));
    if (streaming) nodes.push(streaming.node);
    refs.log.replaceChildren(...nodes);
    refs.log.scrollTop = refs.log.scrollHeight;
  }
  async function load() {
    state = await api(`/api/mock?id=${id}`);
    onState?.(state);
    render();
    return state;
  }
  async function send({kind = mode === 'followup' ? 'followup' : 'message', text = refs.input.value.trim(), silent = false} = {}) {
    if (streaming || disposed) return;
    if ((kind === 'message' || kind === 'followup') && !text) return;
    if (kind === 'message' || kind === 'followup') {
      refs.input.value = '';
      refs.input.style.height = 'auto';
      transcript().push({role: 'candidate', text, at: Date.now()});
    } else if (kind === 'hint') transcript().push({role: 'candidate', text: '', hint: true, at: Date.now()});
    lastActivity = Date.now();
    const controller = new AbortController();
    const md = el('div', {class: 'md'}, el('span', {class: 'dots'}, el('i'), el('i'), el('i')));
    streaming = {abort: () => controller.abort(), node: el('div', {class: 'iv-msg interviewer streaming'}, el('div', {class: 'iv-avatar small'}, icon('user')), el('div', {class: 'iv-bubble'}, md)), text: ''};
    refs.send.replaceChildren(icon('stop'));
    render();
    let final = null, failure = null;
    try {
      const response = await fetch('/api/mock/message', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal, body: JSON.stringify({id, kind, text, code: getCode?.() ?? undefined, language: getLanguage?.() ?? undefined, model: store.get('dg-assistant-model', undefined)})});
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'The interviewer is unavailable.'); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', frame = null;
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'delta') { streaming.text += ev.text; if (!frame) frame = requestAnimationFrame(() => { frame = null; md.replaceChildren(renderMarkdown(streaming.text)); refs.log.scrollTop = refs.log.scrollHeight; }); }
          else if (ev.type === 'done') final = ev.mock;
          else if (ev.type === 'error') failure = ev.message;
        }
      }
    } catch (error) { if (!controller.signal.aborted) failure = error.message; }
    const said = streaming?.text;
    streaming = null;
    refs.send.replaceChildren(icon('send'));
    if (final) { state = final; onState?.(state); } else await load().catch(() => {});
    render();
    if (failure) refs.log.append(el('div', {class: 'chat-error'}, icon('cross'), el('span', {text: failure})));
    else if (said && !silent) speak(said);
    refs.input.focus();
  }
  function toggleMic() {
    if (!Recognition) return;
    if (listening) { recognition?.stop(); return; }
    recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    const base = refs.input.value ? refs.input.value.trimEnd() + ' ' : '';
    recognition.onresult = e => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      refs.input.value = base + text;
      lastActivity = Date.now();
    };
    recognition.onend = () => { listening = false; refs.mic.classList.remove('listening'); refs.mic.replaceChildren(icon('mic')); };
    recognition.onerror = e => { if (e.error !== 'aborted' && e.error !== 'no-speech') notify(`Voice input stopped: ${e.error}`, 'error'); };
    speechSynthesis?.cancel();
    recognition.start();
    listening = true;
    refs.mic.classList.add('listening');
    refs.mic.replaceChildren(icon('micOff'));
  }
  async function end({timeUp = false} = {}) {
    if (!timeUp) {
      const ok = await confirmDialog({title: 'End the interview?', body: 'Your interviewer will review the session and write your feedback. You can\'t return to the interview afterwards.', confirm: 'End interview', cancel: 'Keep going'});
      if (!ok) return;
    }
    recognition?.stop();
    speechSynthesis?.cancel();
    const overlay = el('div', {class: 'fs-overlay'}, el('div', {class: 'overlay-card'}, el('span', {class: 'spinner'}), el('p', {text: timeUp ? 'Time is up. Your interviewer is reviewing the session…' : 'Your interviewer is reviewing the session…'})));
    document.body.append(overlay);
    try {
      const result = await api('/api/mock/end', {id, code: getCode?.() ?? undefined, reason: timeUp ? 'time_up' : 'ended'});
      await waitJob(result, message => { overlay.querySelector('p').textContent = message; });
      overlay.remove();
      onEnded?.();
    } catch (error) { overlay.remove(); notify(error.message, 'error'); }
  }
  // A gentle check-in after a long silence during the interview.
  if (mode === 'interview') nudgeTimer = setInterval(() => {
    if (!state || state.status !== 'active' || streaming || document.hidden) return;
    const lastNudge = Math.max(...transcript().filter(m => m.role === 'interviewer').map(m => m.at), 0);
    if (Date.now() - lastActivity > 6 * 60000 && Date.now() - lastNudge > 6 * 60000) { lastActivity = Date.now(); send({kind: 'nudge'}); }
  }, 30000);
  load().then(() => { const first = transcript().at(-1); if (first?.role === 'interviewer' && transcript().length === 1 && mode === 'interview') speak(first.text); }).catch(error => notify(error.message, 'error'));

  return {
    root, send, end, load, render,
    get state() { return state; },
    scroll: () => { refs.log.scrollTop = refs.log.scrollHeight; },
    notifyEvent: text => send({kind: 'event', text, silent: false}),
    react: () => send({kind: 'event', text: ''}),
    activity: () => { lastActivity = Date.now(); },
    timeUp: () => end({timeUp: true}),
    dispose() { disposed = true; clearInterval(nudgeTimer); recognition?.stop(); try { speechSynthesis.cancel(); } catch {} }
  };
}

// ---------- the coding interview room ----------
let room = null;
export async function closeFullscreen() {
  if (!room) return;
  const r = room;
  room = null;
  await r.dispose();
}

export async function openRoom(root, id) {
  if (room?.id === id && !root.hidden) return;
  await closeFullscreen();
  const state = await api(`/api/mock?id=${id}`);
  if (state.status === 'ended') { location.replace(`#/mockreport/${id}`); return; }
  if (state.type === 'fluency') { location.replace(`#/ade/practice/${state.practiceId}/mock/${id}`); return; }
  enterFullscreen('mock-room');
  root.replaceChildren(el('div', {class: 'fs-loading'}, el('span', {class: 'spinner'}), 'Joining the interview…'));
  const monaco = await loadMonaco();
  room = createRoom(root, state, monaco);
  document.title = `Interview: ${state.title} · Debug Gym`;
}

function createRoom(root, initial, monaco) {
  const id = initial.id;
  let state = initial, skew = initial.serverNow - Date.now(), language = initial.language, running = false, saveTimer = null, timer = null, ended = false;
  let editorOpen = store.get('dg-room-editor', true), rightTab = 'code';
  const q = initial.question;
  const refs = {};
  const models = {};

  const panel = createInterviewerPanel(id, {
    onEnded: () => { ended = true; location.hash = `#/mockreport/${id}`; },
    getCode: () => refs.editor?.getValue(), getLanguage: () => language,
    onState: s => { state = s; skew = s.serverNow - Date.now(); paintStage(); }
  });
  refs.timer = el('div', {class: 'timer'});
  refs.stage = el('span', {class: 'chip stage-chip'});
  refs.toggle = el('button', {class: 'button small', onclick: () => toggleEditor()});
  const top = el('header', {class: 'fs-top'},
    el('a', {class: 'icon-button', href: '#/mock', title: 'Leave (the interview keeps running)', 'aria-label': 'Leave the interview'}, icon('back')),
    el('div', {class: 'fs-title'}, el('strong', {text: `Coding interview: ${q.title}`}), el('span', {class: `difficulty ${DIFFICULTY_CLASS[q.difficulty]}`, text: q.difficulty}), refs.stage),
    el('span', {class: 'grow'}), refs.timer, refs.toggle,
    el('button', {class: 'button danger small', onclick: () => panel.end()}, 'End interview'));

  refs.languageSelect = el('select', {'aria-label': 'Language', onchange: () => switchLanguage(refs.languageSelect.value)}, Object.entries(LANGUAGE_LABEL).map(([v, t]) => el('option', {value: v, text: t})));
  refs.languageSelect.value = language;
  refs.editorHost = el('div', {class: 'monaco-host'});
  refs.results = el('div', {class: 'room-results'});
  refs.customToggle = el('input', {type: 'checkbox', id: 'roomCustom', onchange: () => { refs.custom.hidden = !refs.customToggle.checked; if (refs.customToggle.checked && !refs.custom.value) refs.custom.value = q.samples[0]?.input || ''; }});
  refs.custom = el('textarea', {class: 'custom-input', rows: 3, hidden: true, spellcheck: 'false', 'aria-label': 'Custom input'});
  refs.run = el('button', {class: 'button small', onclick: () => run(false)}, 'Run Code');
  refs.submit = el('button', {class: 'button primary small', onclick: () => run(true)}, 'Submit');
  refs.codeTab = el('button', {class: 'tab active', onclick: () => setRight('code')}, icon('code'), 'Code editor');
  refs.problemTab = el('button', {class: 'tab', onclick: () => setRight('problem')}, icon('book'), 'Problem');
  refs.codePane = el('div', {class: 'room-code'},
    el('div', {class: 'editor-bar'}, refs.languageSelect, el('span', {class: 'grow'}), el('label', {class: 'custom-check', for: 'roomCustom'}, refs.customToggle, 'Custom input'), refs.run, refs.submit),
    refs.editorHost, refs.custom, refs.results);
  refs.problemPane = el('div', {class: 'room-problem pane-scroll', hidden: true}, statementView(q));
  refs.right = el('section', {class: 'room-right'}, el('div', {class: 'tabs'}, refs.codeTab, refs.problemTab), refs.codePane, refs.problemPane);
  const split = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  refs.main = el('div', {class: `room-main${editorOpen ? ' editor-open' : ''}`}, el('section', {class: 'room-left'}, panel.root), split, refs.right);
  root.replaceChildren(top, refs.main);
  const sizes = store.get('dg-room-sizes', {});
  for (const [name, value] of Object.entries(sizes)) refs.main.style.setProperty(name, value + 'px');
  splitter(refs.main, split, '--room-left', x => x - refs.main.getBoundingClientRect().left, 300, 900, 'dg-room-sizes');

  refs.editor = monaco.editor.create(refs.editorHost, editorOptions({model: null}));
  refs.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run(false));
  const onSettings = () => applySettings(refs.editor);
  window.addEventListener('dg-editor-settings', onSettings);
  async function modelFor(lang) {
    if (models[lang]) return models[lang];
    const text = lang === initial.language ? state.code : (await api(`/api/coding/template?id=${encodeURIComponent(q.id)}&language=${lang}`)).code;
    const model = monaco.editor.createModel(text, monacoLanguage(lang), monaco.Uri.parse(`inmemory://mock/${id}/solution.${EXT[lang]}`));
    model.updateOptions({tabSize: settings.get().tabSize});
    model.onDidChangeContent(() => { panel.activity(); clearTimeout(saveTimer); saveTimer = setTimeout(saveCode, 2000); });
    models[lang] = model;
    return model;
  }
  async function switchLanguage(lang) {
    language = lang;
    refs.editor.setModel(await modelFor(lang));
    saveCode();
  }
  function saveCode() {
    clearTimeout(saveTimer);
    if (ended) return;
    api('/api/mock/code', {id, code: refs.editor.getValue(), language}).catch(() => {});
  }
  function toggleEditor() {
    editorOpen = !editorOpen;
    store.set('dg-room-editor', editorOpen);
    refs.main.classList.toggle('editor-open', editorOpen);
    paintToggle();
  }
  const paintToggle = () => refs.toggle.replaceChildren(icon('code'), editorOpen ? 'Hide code editor' : 'Open code editor');
  function setRight(name) {
    rightTab = name;
    refs.codeTab.classList.toggle('active', name === 'code');
    refs.problemTab.classList.toggle('active', name === 'problem');
    refs.codePane.hidden = name !== 'code';
    refs.problemPane.hidden = name !== 'problem';
  }
  async function run(submit) {
    if (running) return;
    if (submit) {
      const ok = await confirmDialog({title: 'Submit your solution?', body: 'Your code runs against every test case, including hidden ones, and your interviewer sees the result. You can keep improving it afterwards.', confirm: 'Submit'});
      if (!ok) return;
    }
    running = true;
    refs.run.disabled = refs.submit.disabled = true;
    const custom = !submit && refs.customToggle.checked;
    refs.results.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), el('span', {text: submit ? 'Running every test case…' : 'Running…'})));
    try {
      const job = await api(submit ? '/api/mock/submit' : '/api/mock/run', {id, language, code: refs.editor.getValue(), ...(custom ? {customInput: refs.custom.value} : {})});
      const {result, mock} = await waitJob(job, message => { refs.results.querySelector('.progress-line span:last-child').textContent = message; });
      state = mock;
      panel.load();
      renderResult(result);
      if (submit) panel.react();
    } catch (error) {
      refs.results.replaceChildren(el('div', {class: 'result-banner bad'}, el('strong', {text: 'Could not run your code'}), el('p', {text: error.message})));
    } finally {
      running = false;
      refs.run.disabled = refs.submit.disabled = false;
    }
  }
  function renderResult(r) {
    if (!r.compiled) { refs.results.replaceChildren(el('div', {class: 'result-banner bad'}, el('strong', {text: 'Compilation error'})), el('pre', {class: 'io-block error', text: r.compileMessage})); return; }
    const banner = r.mode === 'custom' ? el('div', {class: 'result-banner neutral'}, el('strong', {text: r.tests[0].verdict}))
      : el('div', {class: `result-banner ${r.passed === r.total ? 'ok' : 'bad'}`}, el('strong', {text: `${r.passed} of ${r.total} ${r.mode === 'submit' ? 'test cases' : 'sample tests'} passed`}), r.mode === 'submit' ? el('p', {text: `Score ${r.score} / ${r.maxScore}`}) : null);
    const shown = r.tests.find(t => t.status !== 'success' && !t.hidden) || (r.mode === 'custom' ? r.tests[0] : null);
    refs.results.replaceChildren(banner,
      el('div', {class: 'verdict-strip'}, r.tests.map(t => el('span', {class: `case-dot ${t.status === 'success' ? 'ok' : 'bad'}`, title: `${t.name}: ${t.verdict}`}))),
      !shown ? el('span') : el('div', {class: 'case-detail'},
        el('div', {class: 'io-label', text: `${shown.custom ? 'Custom input' : shown.name}: ${shown.verdict}`}),
        el('div', {class: 'io-label', text: 'Input'}), el('pre', {class: 'io-block', text: shown.input || ''}),
        el('div', {class: 'io-label', text: 'Your output'}), el('pre', {class: 'io-block', text: shown.stdout || '~ no output ~'}),
        shown.expected !== undefined ? [el('div', {class: 'io-label', text: 'Expected'}), el('pre', {class: 'io-block', text: shown.expected})] : null,
        shown.stderr ? [el('div', {class: 'io-label', text: 'Debug output'}), el('pre', {class: 'io-block error', text: shown.stderr})] : null));
  }
  function paintStage() {
    if (state.stage) refs.stage.textContent = state.stage;
  }
  function tick() {
    const ms = state.deadline - (Date.now() + skew);
    refs.timer.replaceChildren(icon('clock'), clock(ms));
    refs.timer.className = `timer${ms < 300000 ? ' danger' : ms < 600000 ? ' warn' : ''}`;
    if (ms <= 0 && !ended && state.status === 'active') { ended = true; panel.timeUp(); }
  }

  (async () => {
    refs.editor.setModel(await modelFor(language));
    applySettings(refs.editor);
    paintToggle();
    paintStage();
    tick();
    timer = setInterval(tick, 1000);
  })().catch(error => notify(error.message, 'error'));

  return {
    id,
    async dispose() {
      clearInterval(timer);
      saveCode();
      panel.dispose();
      window.removeEventListener('dg-editor-settings', onSettings);
      for (const model of Object.values(models)) model.dispose();
      refs.editor.dispose();
      root.replaceChildren();
    }
  };
}

function statementView(q) {
  const section = (title, md) => md ? el('section', {class: 'statement-section'}, el('h3', {text: title}), el('div', {class: 'md'}, renderMarkdown(md))) : null;
  return el('article', {class: 'statement'},
    el('h2', {text: q.title}),
    el('div', {class: 'md'}, renderMarkdown(q.statement)),
    section('Function Description', q.functionDescription), section('Input Format', q.inputFormat), section('Constraints', q.constraints), section('Output Format', q.outputFormat),
    q.samples.map((s, i) => el('section', {class: 'statement-section'}, el('h3', {text: `Sample Input ${i}`}), el('pre', {class: 'io-block', text: s.input}), el('h3', {text: `Sample Output ${i}`}), el('pre', {class: 'io-block', text: s.output}),
      s.explanation ? el('div', {class: 'md'}, renderMarkdown(s.explanation)) : null)));
}

// ---------- the report ----------
export async function renderReport(root, id) {
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading your feedback…'));
  const state = await api(`/api/mock?id=${id}`);
  if (state.status !== 'ended' || !state.report) {
    root.replaceChildren(el('div', {class: 'empty-state'}, el('p', {text: state.status === 'reviewing' ? 'Your interviewer is still writing the feedback. Refresh in a moment.' : 'This interview is still in progress.'}),
      el('a', {class: 'button primary', href: state.type === 'fluency' ? `#/ade/practice/${state.practiceId}/mock/${id}` : `#/mock/${id}`}, 'Return to the interview')));
    return;
  }
  const report = state.report;
  const e = report.evidence || {};
  const minutes = Math.max(1, Math.round(((state.ended || Date.now()) - state.started) / 60000));
  const card = area => el('article', {class: 'area-card'},
    el('header', {}, el('h3', {text: area.label}),
      el('span', {class: 'score5'}, el('span', {class: `score-bar five s${area.score}`, role: 'img', 'aria-label': `${area.score} out of 5`}, el('i'), el('i'), el('i'), el('i'), el('i')), el('span', {class: 'score-label', text: `${area.score}/5 · ${SCORE_LABEL[area.score]}`}))),
    el('p', {class: 'desc', text: area.description}),
    el('p', {text: area.summary}),
    el('ul', {}, area.strengths.map(s => el('li', {class: 'good'}, icon('check'), el('span', {text: s}))), area.improvements.map(s => el('li', {class: 'todo'}, icon('chevron'), el('span', {text: s})))),
    el('div', {class: 'evidence'}, el('strong', {text: 'Recorded evidence'}), area.evidence.map(x => el('p', {text: x}))));
  const followupOpen = state.followup && state.followup.remainingMs > 0;
  const followup = followupOpen ? createInterviewerPanel(id, {mode: 'followup', compact: true}) : null;
  const facts = state.type === 'coding'
    ? [['Final tests', e.finalTests ? `${e.finalTests.passed}/${e.finalTests.total}` : '—'], ['Runs', e.runs], ['Submissions', e.submissions], ['Hints', e.hints], ['Words to the interviewer', e.candidateWords], ['Minutes', minutes]]
    : [['Phases passed', `${e.phasesPassed}/3`], ['Prompts to the AI', e.prompts], ['Test runs', e.testRuns], ['AI changes verified', e.aiPastes ? `${e.aiPastesVerified}/${e.aiPastes}` : '—'], ['AI actions declined', e.denials], ['Minutes', minutes]];
  root.replaceChildren(
    el('a', {href: '#/mock', class: 'button link'}, '← Mock interviews'),
    el('div', {class: 'feedback-head'}, el('h1', {text: state.title}), el('span', {class: 'chip', text: state.type === 'coding' ? `Coding interview · ${LANGUAGE_LABEL[state.language] || ''}` : 'AI-fluency interview'}), el('span', {class: 'chip', text: new Date(state.started).toLocaleString()})),
    el('section', {class: 'verdict-hero'},
      el('div', {class: `verdict-badge ${VERDICT_CLASS[report.recommendation]}`}, el('div', {}, el('small', {text: 'Overall recommendation'}), report.recommendation)),
      el('div', {}, el('p', {class: 'headline', text: report.summary}), el('p', {text: `Average ${report.average.toFixed(2)} / 5 · ${report.generatedBy === 'rules' ? 'rule-based scoring (no AI reviewer available)' : `reviewed by ${report.generatedBy}`}`}),
        el('p', {class: 'disclaimer', text: 'Practice feedback from a local model, bounded by recorded evidence. It is not a hiring decision.'}))),
    el('div', {class: 'stats-grid'}, facts.map(([label, value]) => el('div', {class: 'stat'}, el('strong', {text: String(value ?? '—')}), el('span', {text: label})))),
    el('div', {class: 'area-grid'}, report.areas.map(card)),
    followupOpen ? el('section', {class: 'panel followup'}, el('div', {class: 'panel-title-row'}, el('h2', {text: 'Talk it over with your interviewer'}), el('span', {class: 'muted small', text: `Open for ${Math.ceil(state.followup.remainingMs / 60000)} more minutes`})), followup.root)
      : el('p', {class: 'muted', text: state.followup ? 'The 15-minute follow-up window has closed.' : ''}),
    state.type === 'coding' ? el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: 'Your final code'})), el('pre', {class: 'code-view', text: state.code})) : el('div', {class: 'feedback-actions'}, el('a', {class: 'button', href: `#/ade/practice/${state.practiceId}/mock/${id}`}, 'Open the codebase')),
    el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: 'Interview transcript'})),
      el('div', {class: 'transcript'}, state.transcript.map(m => el('div', {class: 'item'}, el('small', {text: `${m.role === 'interviewer' ? 'Interviewer' : m.role === 'candidate' ? 'You' : 'Event'} · minute ${Math.round((m.at - state.started) / 60000)}`}), m.hint ? 'Asked for a hint' : m.text)))),
    el('div', {class: 'feedback-actions'}, el('a', {class: 'button primary', href: '#/mock'}, 'Start another interview')));
}
