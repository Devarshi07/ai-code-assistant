// Practice tests: an assessment simulator. The lobby, the landing page and
// onboarding, the timed test room (Test home, question navigator, coding,
// multiple-choice and written-answer questions, integrity checks, Submit Test)
// and the report.
import {el, api, waitJob, notify, confirmDialog, store, icon, clock, DIFFICULTY_CLASS} from './ui.js';
import {renderMarkdown, highlight} from './markdown.js';
import {loadMonaco} from './monaco.js';
import {enterFullscreen, loadStatus, getStatus, themeButton} from './app.js';
import {createRecorder, createPlayer} from './telemetry.js';

const TYPE_LABEL = {coding: 'Coding', mcq: 'Multiple choice', subjective: 'Written answer'};
const TYPE_FULL = {coding: 'Coding Question', mcq: 'Multiple Choice Question', subjective: 'Subjective Question'};
const TYPE_ICON = {coding: 'code', mcq: 'list', subjective: 'chat'};
const AI_LABEL = {none: 'No AI assistant', guarded: 'Guarded AI assistant', unguarded: 'Unguarded AI assistant'};
const AI_TEXT = {
  none: 'No AI assistant is available in this test.',
  guarded: 'A guarded AI assistant is available in coding questions. It explains concepts, syntax and errors and gives hints, but it won\'t write full solutions. Your conversation appears in the report.',
  unguarded: 'An AI assistant with full help, plus AI inline suggestions in the editor, is available in coding questions. Your conversation appears in the report.'
};
const INTEGRITY_LABEL = {standard: 'Standard', secure: 'Secure mode', proctored: 'Proctored'};
const LANGS = ['python', 'javascript', 'java', 'cpp', 'go'];
// The languages allowed in a run of coding questions: ML, SQL and API questions allow fewer.
const codingLanguages = (test, group) => {
  const lists = [...new Set(test.questions.slice(group.from - 1, group.to).map(q => (q.languages || LANGS).join(', ')))];
  if (lists.length > 1) return 'the allowed languages depend on the question';
  const count = lists[0].split(', ').length;
  return `${count} language${count === 1 ? '' : 's'} allowed: ${lists[0]}`;
};
const ago = at => new Date(at).toLocaleString();
const mins = ms => `${Math.round(ms / 60000)} min`;

// ---------- lobby ----------
export async function renderTestsLobby(root) {
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading…'));
  const [{templates, counts, topics}, history] = await Promise.all([api('/api/tests/templates'), api('/api/tests/list')]);
  const mix = t => t.sections.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + s.count; return acc; }, {});
  const mixText = t => Object.entries(mix(t)).map(([type, n]) => `${n} ${TYPE_LABEL[type].toLowerCase()}`).join(' · ');
  const create = async (button, body) => {
    button.disabled = true;
    try { const test = await api('/api/tests/create', body); location.hash = `#/test/${test.id}`; }
    catch (error) { notify(error.message, 'error'); button.disabled = false; }
  };
  const sample = templates.find(t => t.sample);
  const cards = templates.filter(t => !t.sample).map(t => el('article', {class: 'test-card'},
    el('div', {class: 'test-card-head'}, el('h3', {text: t.title}), el('span', {class: 'chip'}, icon('clock'), `${t.minutes} min`)),
    el('p', {class: 'muted', text: t.blurb}),
    el('div', {class: 'test-card-meta'}, el('span', {class: 'chip', text: mixText(t)}), el('span', {class: `chip ai-${t.ai}`}, icon('spark'), AI_LABEL[t.ai]), el('span', {class: 'chip'}, icon('shield'), INTEGRITY_LABEL[t.integrity])),
    el('button', {class: 'button primary small', onclick: e => create(e.currentTarget, {template: t.id})}, 'Start')));

  // Custom test builder.
  const number = (value, max) => el('input', {type: 'number', min: 0, max, value, class: 'num-input'});
  const easy = number(1, 3), medium = number(1, 3), hard = number(0, 3), mcq = number(5, 20), written = number(0, 2), minutes = number(60, 240);
  minutes.min = 10;
  const ai = el('select', {}, Object.entries(AI_LABEL).map(([v, t]) => el('option', {value: v, text: t})));
  const integrity = el('select', {}, Object.entries(INTEGRITY_LABEL).map(([v, t]) => el('option', {value: v, text: t})));
  integrity.value = 'secure';
  const chosenTopics = new Set();
  const topicChips = el('div', {class: 'topic-chips'}, topics.map(topic => el('button', {class: 'topic-chip', type: 'button', onclick: e => { chosenTopics.has(topic) ? chosenTopics.delete(topic) : chosenTopics.add(topic); e.currentTarget.classList.toggle('on'); }}, topic)));
  const field = (label, input, hint) => el('label', {class: 'field'}, el('span', {text: label}), input, hint ? el('small', {class: 'muted', text: hint}) : null);
  const builder = el('section', {class: 'panel builder'},
    el('h2', {text: 'Build a custom test'}),
    el('div', {class: 'builder-grid'},
      field('Coding · Easy', easy), field('Coding · Medium', medium), field('Coding · Hard', hard),
      field('Multiple choice', mcq), field('Written answers', written), field('Duration (minutes)', minutes),
      field('AI assistant', ai), field('Integrity', integrity, 'Secure mode enforces full screen and blocks outside pastes.')),
    el('div', {class: 'field'}, el('span', {text: 'Multiple-choice topics (all if none are chosen)'}), topicChips),
    el('button', {class: 'button primary', onclick: e => create(e.currentTarget, {custom: {coding: {Easy: +easy.value, Medium: +medium.value, Hard: +hard.value}, mcq: +mcq.value, subjective: +written.value, minutes: +minutes.value, ai: ai.value, integrity: integrity.value, topics: [...chosenTopics]}})}, 'Create test'));

  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Practice tests'}), el('span', {class: 'title-badge', text: 'Assessment simulator'})),
    el('p', {class: 'page-lead', text: 'Full timed tests that work like real online assessments: a landing page and onboarding, Test home, Run Code, Run Tests and Save & Proceed, a countdown that never pauses, integrity checks, and Submit Test. A report shows what would have been scored.'}),
    ...(sample ? [el('section', {class: 'sample-banner'}, el('div', {}, el('strong', {text: 'New to assessments? Try the sample test.'}), el('p', {class: 'muted', text: sample.blurb})),
      el('button', {class: 'button', onclick: e => create(e.currentTarget, {template: sample.id})}, 'Try Sample Test'))] : []),
    el('div', {class: 'test-grid'}, cards),
    builder,
    el('p', {class: 'muted small', text: `Question bank: ${counts.coding} coding, ${counts.mcq} multiple-choice and ${counts.subjective} written-answer questions.`}),
    el('section', {class: 'panel'}, el('h2', {text: 'Your tests'}),
      history.length ? el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'Test'}), el('th', {text: 'Created'}), el('th', {text: 'Questions'}), el('th', {text: 'Status'}), el('th', {text: 'Score'}), el('th', {}))),
        el('tbody', {}, history.map(h => el('tr', {}, el('td', {text: h.title}), el('td', {text: ago(h.created)}), el('td', {text: String(h.questions)}),
          el('td', {}, el('span', {class: `status-pill ${h.status === 'ended' ? 'passed' : 'active'}`, text: {ready: 'Not started', active: 'In progress', grading: 'Evaluating', ended: 'Submitted'}[h.status]})),
          el('td', {text: h.score !== null ? `${h.score} / ${h.max} (${h.percent}%)` : '—'}),
          el('td', {class: 'actions'}, el('a', {class: 'button small', href: `#/test/${h.id}`}, h.status === 'ended' ? 'Report' : h.status === 'ready' ? 'Open' : 'Resume')))))) : el('p', {class: 'muted', text: 'No tests yet.'})));
}

// ---------- landing page, onboarding, report ----------
export async function renderTestPage(root, id) {
  const test = await api(`/api/tests?id=${id}`);
  if (test.status === 'active') { location.hash = `#/test/${id}/room`; return; }
  if (test.status === 'ended' || test.status === 'grading') return renderReport(root, test);
  renderLanding(root, test);
}

function questionGroups(test) {
  const groups = [];
  test.questions.forEach((q, i) => {
    const last = groups.at(-1);
    if (last && last.type === q.type) last.to = i + 1; else groups.push({type: q.type, from: i + 1, to: i + 1});
  });
  return groups;
}

function renderLanding(root, test) {
  // Landing and onboarding hide the app's navigation, like an assessment's start page.
  document.body.dataset.focus = 'test';
  const instructions = [
    'The timer starts when you click Start Test and never pauses. The test ends automatically when time runs out.',
    'Answers are saved as you go, and you can change them until you submit the test.',
    'In coding questions, Run Code runs the sample cases or your custom input, Run Tests runs every test case, and Save & Proceed records your answer. If time runs out, your last Save & Proceed counts; failing that, your last Run Tests, then your last Run Code. Code that was never run or saved is not evaluated.',
    test.settings.integrity === 'standard' ? 'Switching tabs and pasting are recorded, as on real assessments.'
      : test.settings.integrity === 'secure' ? 'Secure mode: the test runs in full screen. Leaving full screen or switching tabs shows a warning and is recorded. Pasting from outside the test is blocked in coding questions.'
      : 'Proctored: everything in secure mode, plus a webcam preview (nothing is recorded or sent anywhere) and a single-monitor check.',
    AI_TEXT[test.settings.ai]
  ];
  const groups = questionGroups(test);
  const step1 = el('div', {class: 'landing-card'},
    el('h1', {text: `Welcome to ${test.title}`}),
    el('div', {class: 'landing-facts'},
      el('div', {}, el('small', {text: 'Test duration'}), el('strong', {text: `${test.minutes} mins`})),
      el('div', {}, el('small', {text: 'No. of questions'}), el('strong', {text: String(test.questions.length)}))),
    el('h3', {text: 'Instructions'}),
    el('ol', {class: 'instructions-list'}, instructions.map(text => el('li', {text}))),
    el('h3', {text: 'Questions'}),
    el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'Question Indexes'}), el('th', {text: 'Question Types'}))),
      el('tbody', {}, groups.map(g => el('tr', {}, el('td', {text: g.from === g.to ? String(g.from) : `${g.from} - ${g.to}`}), el('td', {text: g.type === 'coding' ? `${TYPE_FULL.coding} - ${codingLanguages(test, g)}` : TYPE_FULL[g.type]}))))),
    el('div', {class: 'landing-actions'},
      el('a', {class: 'button ghost', href: '#/tests'}, 'Back'),
      test.sample ? null : el('button', {class: 'button', onclick: async e => { e.currentTarget.disabled = true; try { const s = await api('/api/tests/create', {template: 'sample'}); location.hash = `#/test/${s.id}`; } catch (error) { notify(error.message, 'error'); } }}, 'Try Sample Test'),
      el('button', {class: 'button primary', onclick: () => onboarding()}, 'Continue')));
  root.replaceChildren(el('div', {class: 'landing'}, step1));

  async function onboarding() {
    const s = getStatus() || await loadStatus().catch(() => null);
    const checks = [];
    const row = (title, detail, action) => {
      const mark = el('span', {class: 'check-mark'});
      const node = el('div', {class: 'check-row'}, mark, el('div', {}, el('strong', {text: title}), el('small', {class: 'muted', text: detail})), action || el('span'));
      const item = {node, ok: false, set(ok, text) { item.ok = ok; mark.replaceChildren(ok ? icon('check') : ''); mark.className = `check-mark ${ok ? 'ok' : ''}`; if (text) node.querySelector('small').textContent = text; paint(); }};
      checks.push(item);
      return item;
    };
    const honor = el('input', {type: 'checkbox', onchange: () => paint()});
    const notice = el('input', {type: 'checkbox', onchange: () => paint()});
    const start = el('button', {class: 'button primary', disabled: true}, 'Start Test');
    const docker = row('Code execution', 'Docker Desktop runs your code in coding questions.');
    docker.set(!!s?.docker || !test.questions.some(q => q.type === 'coding'), s?.docker ? 'Docker is running.' : test.questions.some(q => q.type === 'coding') ? 'Docker is not running. Start Docker Desktop, then check again.' : 'Not needed for this test.');
    const items = [docker];
    if (test.settings.ai !== 'none') {
      const ai = row('AI assistant', 'A local model powers the assistant.');
      ai.set(true, s?.models?.assistant ? `${s.models.assistant} is ready.` : 'No local model found: the assistant panel will be empty. You can still take the test.');
      items.push(ai);
    }
    let camera = null;
    if (test.settings.integrity === 'proctored') {
      const grant = el('button', {class: 'button small', onclick: async () => {
        try { const stream = await navigator.mediaDevices.getUserMedia({video: true}); stream.getTracks().forEach(t => t.stop()); cam.set(true, 'Webcam access granted. A small preview appears during the test; nothing is recorded.'); }
        catch { cam.set(false, 'Webcam access was denied. Allow it in your browser settings, then try again.'); }
      }}, 'Grant Access');
      const cam = row('Allow Webcam Access', 'Needed for a proctored test.', grant);
      camera = cam;
      const monitorButton = el('button', {class: 'button small', onclick: () => {
        const extended = window.screen.isExtended;
        if (extended) monitors.set(false, 'More than one monitor is connected. Disconnect the extra monitor, then check again.');
        else monitors.set(true, extended === undefined ? 'Single monitor assumed (your browser can\'t report this).' : 'One monitor detected.');
      }}, 'Check Now');
      const monitors = row('Check for Multiple Monitors', 'Proctored tests need a single monitor.', monitorButton);
      items.push(cam, monitors);
    }
    function paint() { start.disabled = !(honor.checked && notice.checked && checks.every(c => c.ok)); }
    start.onclick = async () => {
      // Full screen must be requested inside the click.
      if (test.settings.integrity !== 'standard') document.documentElement.requestFullscreen?.().catch(() => {});
      start.disabled = true;
      try { await api('/api/tests/start', {id: test.id}); location.hash = `#/test/${test.id}/room`; }
      catch (error) { notify(error.message, 'error'); start.disabled = false; }
    };
    root.replaceChildren(el('div', {class: 'landing'}, el('div', {class: 'landing-card'},
      el('h1', {text: test.title}),
      el('div', {class: 'stepper-line'}, el('span', {class: 'done', text: '1  Instructions'}), el('span', {class: 'current', text: '2  Integrity & permissions'})),
      el('h3', {text: 'Before you begin'}),
      el('label', {class: 'agree'}, honor, el('span', {}, el('strong', {text: 'Honor Code. '}), 'I will take this practice test on my own, using only the help it allows.')),
      el('label', {class: 'agree'}, notice, el('span', {}, el('strong', {text: 'AI Notice. '}), AI_TEXT[test.settings.ai])),
      el('h3', {text: 'Checks'}),
      el('div', {class: 'check-list-box'}, items.map(i => i.node)),
      el('div', {class: 'landing-actions'}, el('button', {class: 'button ghost', onclick: () => renderLanding(root, test)}, 'Back'), start))));
    paint();
  }
}

// ---------- the test room ----------
let room = null;
export async function closeFullscreen() {
  if (!room) return;
  const r = room;
  room = null;
  await r.dispose();
}

export async function openTestRoom(root, id) {
  if (room?.id === id && !root.hidden) return;
  await closeFullscreen();
  const test = await api(`/api/tests?id=${id}`);
  if (test.status !== 'active') { location.replace(`#/test/${id}`); return; }
  enterFullscreen('test-room');
  room = createRoom(root, test);
  document.title = `${test.title} · Debug Gym`;
}

function createRoom(root, initial) {
  let test = initial, skew = initial.serverNow - Date.now(), current = null, workspace = null, recorder = null, monaco = null, ended = false, warned = false, awayAt = null;
  const id = test.id;
  const strict = test.settings.integrity !== 'standard';
  const copies = [];
  const refs = {};
  const norm = text => String(text).replace(/\s+/g, ' ').trim();
  const event = (type, extra = {}) => api('/api/tests/event', {id, type, key: current, ...extra}).catch(() => ({}));

  // Pastes: allowed when the text was copied inside the test.
  function pasteGuard(text, {coding = false} = {}) {
    const n = norm(text);
    if (!n || copies.some(c => c.includes(n) || n.includes(c))) return 'allow';
    if (strict && coding) { event('blocked-paste', {chars: text.length}); notify('Pasting from outside the test is blocked in coding questions.', 'error'); return 'block'; }
    event('paste', {chars: text.length});
    return 'allow';
  }
  const onCopy = () => { const text = norm(window.getSelection()?.toString() || ''); if (text) copies.push(text); if (copies.length > 60) copies.shift(); };
  document.addEventListener('copy', onCopy, true);
  document.addEventListener('cut', onCopy, true);

  // ---------- layout ----------
  // A navy header with the clock and progress, a slim numbered question strip
  // on the left, and the question itself filling the rest.
  refs.timer = el('div', {class: 'timer', role: 'timer'});
  refs.answered = el('span', {class: 'answered-count'});
  refs.nudge = el('div', {class: 'time-nudge', hidden: true}, icon('clock'), el('span', {text: 'Less than 5 minutes left. Wrap up and submit your test.'}));
  refs.navToggle = el('button', {class: 'icon-button nav-toggle', title: 'Show question names', 'aria-label': 'Show or hide question names', onclick: () => { refs.main.classList.toggle('nav-wide'); store.set('dg-test-nav-wide', refs.main.classList.contains('nav-wide')); }}, icon('panel'));
  const top = el('header', {class: 'fs-top test-top'},
    el('span', {class: 'brand-mark small', 'aria-hidden': 'true', text: 'dg'}),
    el('div', {class: 'fs-title'}, el('strong', {text: test.title}), el('span', {class: 'chip'}, icon('shield'), INTEGRITY_LABEL[test.settings.integrity]), test.settings.ai !== 'none' ? el('span', {class: 'chip'}, icon('spark'), AI_LABEL[test.settings.ai]) : null),
    el('span', {class: 'grow'}), refs.nudge, refs.answered, refs.timer,
    themeButton(),
    el('button', {class: 'icon-button', title: 'Instructions and help', 'aria-label': 'Help', onclick: () => helpDialog()}, '?'),
    el('button', {class: 'button primary small submit-test', onclick: () => submitTest()}, 'Submit test'));
  refs.nav = el('nav', {class: 'test-nav', 'aria-label': 'Questions'});
  refs.body = el('section', {class: 'test-body'});
  refs.main = el('div', {class: `test-main${store.get('dg-test-nav-wide', false) ? ' nav-wide' : ''}`}, refs.nav, refs.body);
  refs.camera = el('video', {class: 'cam-preview', autoplay: true, muted: true, playsinline: true});
  refs.faceStatus = el('span', {class: 'face-status', text: 'Starting the face check…'});
  refs.camBox = el('div', {class: 'cam-box', hidden: true, 'aria-live': 'polite'}, refs.camera, refs.faceStatus);
  refs.block = el('div', {class: 'fs-overlay', hidden: true});
  root.replaceChildren(top, refs.main, refs.camBox, refs.block);

  // ---------- navigation ----------
  const statusLabel = q => q.type === 'coding' ? (q.saved ? 'Saved' : q.ran ? 'Ran' : q.answered ? 'Attempted' : 'Not attempted') : (q.status === 'saved' ? 'Saved' : q.answered ? 'Answered' : 'Not attempted');
  const statusClass = q => q.saved || q.status === 'saved' ? 'saved' : q.answered || q.ran ? 'attempted' : 'none';
  const isAnswered = q => q.type === 'coding' ? !!(q.saved || q.ran) : !!q.answered;
  function renderNav() {
    refs.nav.replaceChildren(
      el('button', {class: `nav-item home${current === null ? ' active' : ''}`, title: 'Test home', 'aria-label': 'Test home', onclick: () => open(null)}, el('span', {class: 'nav-dot home-dot'}, icon('home')), el('span', {class: 'nav-name', text: 'Test home'})),
      ...test.questions.map((q, i) => el('button', {class: `nav-item${current === q.key ? ' active' : ''}`, title: `${i + 1}. ${q.title}\n${TYPE_LABEL[q.type]} · ${statusLabel(q)}${q.flagged ? ' · flagged for review' : ''}`, 'aria-label': `Question ${i + 1}: ${q.title}, ${statusLabel(q)}`, 'aria-current': current === q.key ? 'step' : null, onclick: () => open(q.key)},
        el('span', {class: `nav-dot ${statusClass(q)}`, text: String(i + 1)}, q.flagged ? el('span', {class: 'nav-flag', 'aria-hidden': 'true'}) : null),
        el('span', {class: 'nav-name', text: q.title}), el('span', {class: 'nav-type'}, icon(TYPE_ICON[q.type])))),
      el('span', {class: 'grow'}), refs.navToggle);
    refs.answered.textContent = `${test.questions.filter(isAnswered).length}/${test.questions.length} answered`;
  }
  // "Question 2 of 5", the type and points, and a flag for coming back later.
  function questionHeader(key, extra = {}) {
    const index = test.questions.findIndex(q => q.key === key);
    const q = test.questions[index];
    const flag = el('button', {class: `flag-button${q.flagged ? ' on' : ''}`, title: 'Flag this question to come back to it', 'aria-pressed': String(!!q.flagged), onclick: async () => {
      q.flagged = !q.flagged;
      flag.classList.toggle('on', q.flagged);
      flag.setAttribute('aria-pressed', String(q.flagged));
      flag.replaceChildren(icon(q.flagged ? 'flagFill' : 'flag'), q.flagged ? 'Flagged' : 'Flag');
      renderNav();
      api('/api/tests/visit', {id, key, flagged: q.flagged}).catch(() => {});
    }}, icon(q.flagged ? 'flagFill' : 'flag'), q.flagged ? 'Flagged' : 'Flag');
    return {index, total: test.questions.length, title: q.title, type: TYPE_LABEL[q.type], points: extra.points ?? q.maxScore, difficulty: q.difficulty, flag};
  }
  const headerNode = h => el('div', {class: 'question-head'},
    el('span', {class: 'question-count', text: `Question ${h.index + 1} of ${h.total}`}),
    el('h2', {text: h.title}),
    el('div', {class: 'question-meta'}, h.difficulty ? el('span', {class: `difficulty ${DIFFICULTY_CLASS[h.difficulty] || ''}`, text: h.difficulty}) : null, el('span', {class: 'chip', text: h.type}), h.points ? el('span', {class: 'chip', text: `${h.points} points`}) : null, el('span', {class: 'grow'}), h.flag));
  async function refresh() {
    try { test = await api(`/api/tests?id=${id}`); skew = test.serverNow - Date.now(); renderNav(); if (current === null) renderHome(); }
    catch {}
  }
  async function leaveCurrent() {
    if (workspace) { await workspace.save().catch(() => {}); await workspace.dispose(); workspace = null; }
    await recorder?.flush();
    recorder = null;
    refs.flushAnswer?.();
    refs.flushAnswer = null;
  }
  async function open(key) {
    if (ended) return;
    await leaveCurrent();
    current = key;
    renderNav();
    if (key === null) { renderHome(); return; }
    refs.body.replaceChildren(el('div', {class: 'fs-loading'}, el('span', {class: 'spinner'}), 'Loading the question…'));
    api('/api/tests/visit', {id, key}).catch(() => {});
    const data = await api(`/api/tests/question?id=${id}&key=${key}`);
    if (current !== key) return;
    if (data.type === 'coding') await openCoding(data);
    else if (data.type === 'mcq') openMcq(data);
    else openSubjective(data);
  }
  const nextKey = () => { const i = test.questions.findIndex(q => q.key === current); return test.questions[i + 1]?.key ?? null; };
  async function proceed() { await refresh(); open(nextKey()); }

  function renderHome() {
    const answered = test.questions.filter(q => q.saved || q.status === 'saved').length;
    refs.body.replaceChildren(el('div', {class: 'test-home'},
      el('h2', {text: 'Test home'}),
      el('p', {class: 'muted', text: `${test.questions.length} questions · ${answered} saved · ${mins(test.minutes * 60000)} in total. Open a question with Solve; reopen one you answered with Modify.`}),
      el('table', {class: 'problem-table home-table'},
        el('thead', {}, el('tr', {}, el('th', {text: '#'}), el('th', {text: 'Question'}), el('th', {text: 'Type'}), el('th', {text: 'Status'}), el('th', {}))),
        el('tbody', {}, test.questions.map((q, i) => el('tr', {},
          el('td', {text: String(i + 1)}),
          el('td', {}, el('span', {class: 'problem-name', text: q.title}), q.difficulty ? el('span', {class: `problem-meta difficulty ${DIFFICULTY_CLASS[q.difficulty] || ''}`, text: q.difficulty}) : null),
          el('td', {text: TYPE_LABEL[q.type]}),
          el('td', {}, el('span', {class: `status-pill ${statusClass(q) === 'saved' ? 'passed' : statusClass(q) === 'attempted' ? 'active' : 'incomplete'}`, text: statusLabel(q)})),
          el('td', {class: 'actions'}, el('button', {class: `button small ${q.answered || q.saved ? '' : 'primary'}`, onclick: () => open(q.key)}, q.answered || q.saved || q.ran ? 'Modify' : 'Solve'))))))));
  }

  async function openCoding(data) {
    monaco ||= await loadMonaco();
    const {mountTestQuestion} = await import('./coding.js');
    const host = el('div', {class: 'test-coding'});
    refs.body.replaceChildren(host);
    const q = {...data.question, state: {drafts: data.drafts || {}, language: data.language, submissions: []}};
    // Code playback and the code-reset and typing checks, on the server's clock.
    recorder = createRecorder({send: events => api('/api/tests/playback', {id, key: data.key, events}), flag: (type, extra) => event(type, extra), clock: () => Date.now() + skew, started: test.started});
    workspace = mountTestQuestion(host, q, monaco, {
      recorder,
      test: {id, key: data.key}, ai: test.settings.ai !== 'none', inline: test.settings.ai === 'unguarded',
      header: headerNode(questionHeader(data.key)), aiLevel: test.settings.ai,
      pasteGuard: text => pasteGuard(text, {coding: true}),
      onCopy: text => { const n = norm(text); if (n) { copies.push(n); if (copies.length > 60) copies.shift(); } },
      onAiInsert: text => { const n = norm(text); if (n) copies.push(n); event('ai-insert', {chars: text.length}); },
      onProceed: () => { notify('Answer saved.', 'success'); proceed(); },
      onChange: () => refresh()
    });
  }

  function answerLayout(key, question, right, points) {
    return el('div', {class: 'answer-layout'},
      el('article', {class: 'answer-question pane-scroll'}, headerNode(questionHeader(key, {points})), el('div', {class: 'md'}, renderMarkdown(question))),
      el('section', {class: 'answer-panel'}, right));
  }

  function openMcq(data) {
    const q = data.question;
    let selected = new Set(data.selected || []);
    const save = proceedAfter => api('/api/tests/save', {id, key: data.key, selected: [...selected], proceed: proceedAfter}).then(() => { if (!proceedAfter) refresh(); });
    const options = el('div', {class: 'mcq-options', role: q.multiple ? 'group' : 'radiogroup'});
    const paint = () => options.replaceChildren(...q.options.map((text, i) => el('label', {class: `mcq-option${selected.has(i) ? ' chosen' : ''}`},
      el('input', {type: q.multiple ? 'checkbox' : 'radio', name: `mcq-${data.key}`, checked: selected.has(i), onchange: e => {
        if (q.multiple) { e.target.checked ? selected.add(i) : selected.delete(i); } else selected = new Set([i]);
        paint(); save(false).catch(error => notify(error.message, 'error'));
      }}),
      el('span', {class: 'md'}, renderMarkdown(text)))));
    paint();
    refs.body.replaceChildren(answerLayout(data.key, q.question, el('div', {class: 'answer-inner'},
      el('div', {class: 'answer-head'}, el('strong', {text: q.multiple ? 'Multiple Correct Answers' : 'Single Correct Answer'}), el('span', {class: 'muted small', text: q.multiple ? 'Select all that apply' : 'Select one'})),
      q.multiple ? el('p', {class: 'muted small', text: 'Select all that apply. Each correct option earns part of the points, but selecting more options than there are correct answers scores zero.'}) : null,
      options,
      el('div', {class: 'answer-actions'},
        el('button', {class: 'button ghost small', onclick: () => { selected.clear(); paint(); save(false); }}, 'Clear Selection'),
        el('span', {class: 'grow'}),
        el('button', {class: 'button primary small', onclick: async () => { await save(true).catch(error => notify(error.message, 'error')); proceed(); }}, 'Save & Proceed'))), q.points));
  }

  function openSubjective(data) {
    const q = data.question;
    const area = el('textarea', {class: 'subjective-input', spellcheck: 'true', placeholder: 'Write your answer. Markdown formatting is supported.', 'aria-label': 'Your answer'}, data.text || '');
    const count = el('span', {class: 'muted small'});
    let timer = null;
    const save = proceedAfter => { clearTimeout(timer); return api('/api/tests/save', {id, key: data.key, text: area.value, proceed: proceedAfter}).then(() => { if (!proceedAfter) refresh(); }); };
    const paintCount = () => { count.textContent = `${area.value.trim().split(/\s+/).filter(Boolean).length} words`; };
    area.addEventListener('input', () => { paintCount(); clearTimeout(timer); timer = setTimeout(() => save(false).catch(() => {}), 1200); });
    area.addEventListener('paste', e => { const text = e.clipboardData?.getData('text/plain') || ''; pasteGuard(text); });
    const wrap = (before, after = before) => () => {
      const {selectionStart: s, selectionEnd: e, value} = area;
      area.value = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
      area.focus(); area.selectionStart = s + before.length; area.selectionEnd = e + before.length;
      area.dispatchEvent(new Event('input'));
    };
    const tool = (label, title, action) => el('button', {class: 'tool-button', type: 'button', title, onclick: action}, label);
    refs.flushAnswer = () => { if (timer) save(false).catch(() => {}); };
    paintCount();
    refs.body.replaceChildren(answerLayout(data.key, q.question, el('div', {class: 'answer-inner'},
      el('div', {class: 'answer-head'}, el('strong', {text: 'Your answer'}), el('span', {class: 'muted small', text: 'Markdown supported'})),
      el('div', {class: 'rich-toolbar'}, tool('B', 'Bold', wrap('**')), tool('I', 'Italic', wrap('_')), tool('</>', 'Code', wrap('`')), tool('•', 'Bullet list', wrap('\n- ', '')), tool('1.', 'Numbered list', wrap('\n1. ', ''))),
      area,
      el('div', {class: 'answer-actions'}, count, el('span', {class: 'grow'}),
        el('button', {class: 'button primary small', onclick: async () => { await save(true).catch(error => notify(error.message, 'error')); proceed(); }}, 'Save & Proceed'))), q.points));
  }

  // ---------- timer, integrity and submission ----------
  // The clock turns amber with ten minutes left and red with five.
  function tick() {
    const ms = test.deadline - (Date.now() + skew);
    refs.timer.replaceChildren(icon('clock'), el('span', {class: 'timer-value', text: ms >= 3600000 ? `${Math.floor(ms / 3600000)}:${clock(ms % 3600000)}` : clock(ms)}), el('span', {class: 'timer-label', text: 'left'}));
    refs.timer.className = `timer${ms < 300000 ? ' danger' : ms < 600000 ? ' warn' : ''}`;
    if (ms < 300000 && !warned) { warned = true; refs.nudge.hidden = false; notify('Less than 5 minutes left. Wrap up and submit your test.'); }
    if (ms <= 0 && !ended) finish('time_up');
  }
  const timer = setInterval(tick, 1000);

  function away() { if (awayAt === null && !ended) awayAt = Date.now(); }
  async function back() {
    if (awayAt === null || ended) return;
    const ms = Date.now() - awayAt;
    awayAt = null;
    if (ms < 400) return;
    const result = await event('tab', {ms});
    if (strict) warnDialog('You left the test window', `Switching tabs or windows is recorded (${result.count || 1} so far, ${Math.round(ms / 1000)} s this time). On a real assessment, the employer sees this.`);
  }
  const onVisibility = () => document.hidden ? away() : back();
  window.addEventListener('blur', away);
  window.addEventListener('focus', back);
  document.addEventListener('visibilitychange', onVisibility);
  const onFullscreen = () => {
    if (!strict || ended || document.fullscreenElement) { refs.block.hidden = true; return; }
    event('fullscreen');
    refs.block.hidden = false;
    refs.block.replaceChildren(el('div', {class: 'overlay-card'}, icon('expand'), el('h2', {text: 'You exited full-screen mode'}),
      el('p', {text: 'This test must be taken in full screen. Leaving it is recorded. Return to full screen to continue.'}),
      el('button', {class: 'button primary', onclick: () => document.documentElement.requestFullscreen?.().catch(() => notify('Your browser blocked full screen. Press F11 or allow it, then continue.', 'error'))}, 'Return to full screen')));
  };
  document.addEventListener('fullscreenchange', onFullscreen);
  if (strict && !document.fullscreenElement) setTimeout(onFullscreen, 300);
  let stream = null, faceCheck = null;
  if (test.settings.integrity === 'proctored') navigator.mediaDevices?.getUserMedia({video: true}).then(s => { stream = s; refs.camera.srcObject = s; refs.camBox.hidden = false; startFaceCheck(); }).catch(() => notify('The webcam is not available. A proctored test would stop here.', 'error'));

  // Proctored tests look for exactly one face, in the browser: no image leaves the page.
  // An absence of six seconds or more, or a second face for two seconds, is recorded.
  async function startFaceCheck() {
    let faceapi;
    try {
      faceapi = await import('./vendor/face-api/face-api.esm.js');
      await faceapi.nets.tinyFaceDetector.loadFromUri('/vendor/face-api/model');
    } catch {
      refs.faceStatus.textContent = 'Face check unavailable';
      return;
    }
    const options = new faceapi.TinyFaceDetectorOptions({inputSize: 224, scoreThreshold: 0.5});
    let missingSince = null, extraSince = null, extraReported = false, warned = false, busy = false;
    const reportMissing = now => { if (missingSince && now - missingSince >= 6000) event('no-face', {ms: now - missingSince}); missingSince = null; warned = false; };
    const timer = setInterval(async () => {
      if (ended || busy || refs.camera.readyState < 2) return;
      busy = true;
      let count;
      try { count = (await faceapi.detectAllFaces(refs.camera, options)).length; } catch { busy = false; return; }
      busy = false;
      const now = Date.now();
      refs.faceStatus.textContent = count === 1 ? 'Face visible' : count === 0 ? 'No face detected' : `${count} faces detected`;
      refs.faceStatus.className = `face-status ${count === 1 ? 'ok' : 'bad'}`;
      if (count === 0) {
        missingSince ??= now;
        if (!warned && now - missingSince >= 10000) { warned = true; notify('We can\'t see your face in the webcam. Stay in view during a proctored test.', 'error'); }
      } else reportMissing(now);
      if (count > 1) {
        extraSince ??= now;
        if (!extraReported && now - extraSince >= 2000) { extraReported = true; event('multi-face'); warnDialog('More than one person in view', 'Proctored tests expect you to work alone. More than one face in the webcam is recorded.'); }
      } else { extraSince = null; extraReported = false; }
    }, 1500);
    faceCheck = {stop() { clearInterval(timer); reportMissing(Date.now()); }};
  }

  function warnDialog(title, body) {
    document.querySelector('dialog.warn-dialog')?.remove();
    const dialog = el('dialog', {class: 'dialog small warn-dialog'}, el('h2', {text: title}), el('p', {text: body}), el('div', {class: 'dialog-actions'}, el('button', {class: 'button primary', onclick: () => dialog.close()}, 'Continue the test')));
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }
  function helpDialog() {
    const dialog = el('dialog', {class: 'dialog'},
      el('div', {class: 'dialog-heading'}, el('h2', {text: 'Instructions'}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
      el('ul', {class: 'instructions-list'},
        el('li', {text: 'Run Code runs the sample cases, or your input in the Custom tab. Run Tests runs every test case. Save & Proceed records your answer and opens the next question.'}),
        el('li', {text: 'When time runs out: your last Save & Proceed counts, then your last Run Tests, then your last Run Code. Code that was never run or saved is not evaluated.'}),
        el('li', {text: 'Multiple-choice and written answers save automatically.'}),
        el('li', {text: 'Ctrl+Enter runs your code. Ctrl+Space opens autocomplete. The gear icon changes the editor mode (Normal, Vim, Emacs), tab spaces and theme.'}),
        el('li', {text: AI_TEXT[test.settings.ai]})),
      el('div', {class: 'dialog-actions'}, el('button', {class: 'button primary', onclick: () => dialog.close()}, 'Back to the test')));
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  // Saves what is on screen without tearing it down, so "Go back" returns to the same state.
  async function submitTest() {
    await workspace?.save().catch(() => {});
    await recorder?.flush();
    refs.flushAnswer?.();
    await refresh();
    const missing = test.questions.filter(q => q.type === 'coding' ? !(q.saved || q.ran) : !q.answered);
    if (missing.length) {
      const ok = await confirmDialog({title: 'Incomplete submission', danger: true, confirm: 'Submit anyway', cancel: 'Go back',
        body: el('div', {}, el('p', {text: `${missing.length} question${missing.length === 1 ? ' has' : 's have'} no answer that will be evaluated:`}),
          el('ul', {}, missing.map(q => el('li', {text: `${test.questions.indexOf(q) + 1}. ${q.title}${q.type === 'coding' && q.answered ? ' (typed but never run or saved, so it won\'t be evaluated)' : ''}`}))))});
      if (!ok) return;
    }
    const sure = await confirmDialog({title: 'Submit your test?', body: 'This is your final submission. You won\'t be able to change any answer afterwards.', confirm: 'Submit Test', cancel: 'Keep working'});
    if (sure) finish('submitted');
  }

  async function finish(reason) {
    if (ended) return;
    faceCheck?.stop();
    ended = true;
    clearInterval(timer);
    await leaveCurrent().catch(() => {});
    refs.block.hidden = false;
    refs.block.replaceChildren(el('div', {class: 'overlay-card'}, el('span', {class: 'spinner'}), el('h2', {text: reason === 'time_up' ? "Time's up" : 'Test submitted'}), el('p', {class: 'status-text', text: 'Evaluating your answers…'})));
    try {
      await waitJob(await api('/api/tests/finish', {id, reason}), message => { const p = refs.block.querySelector('.status-text'); if (p) p.textContent = message; });
    } catch (error) { notify(error.message, 'error'); }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    location.hash = `#/test/${id}`;
  }

  renderNav();
  open(null);
  tick();

  return {
    id,
    async dispose() {
      clearInterval(timer);
      await leaveCurrent().catch(() => {});
      document.removeEventListener('copy', onCopy, true);
      document.removeEventListener('cut', onCopy, true);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      faceCheck?.stop();
      stream?.getTracks().forEach(t => t.stop());
      if (document.fullscreenElement && ended) document.exitFullscreen?.().catch(() => {});
      root.replaceChildren();
    }
  };
}

// ---------- the report ----------
function renderReport(root, test) {
  if (test.status === 'grading' || !test.report) {
    root.replaceChildren(el('div', {class: 'empty-state'}, el('span', {class: 'spinner'}), el('p', {text: 'Your answers are being evaluated. This page refreshes automatically.'})));
    setTimeout(() => { if (location.hash === `#/test/${test.id}`) renderTestPage(root, test.id); }, 3000);
    return;
  }
  const r = test.report;
  const result = row => {
    if (row.type === 'coding') return !row.attempted ? 'Not evaluated' : row.total === null || row.total === undefined ? (row.error || 'Not evaluated') : row.compiled === false ? 'Compilation error' : `${row.passed}/${row.total} test cases`;
    if (row.type === 'mcq') return !row.answered ? 'Not answered' : row.correct ? 'Correct' : row.partial ? 'Partially correct' : 'Incorrect';
    return row.score === null ? 'Not graded' : !String(row.answer || '').trim() ? 'Not answered' : `Graded ${row.score}/${row.maxScore}`;
  };
  const detail = (row, i) => {
    const body = el('div', {class: 'report-detail'});
    if (row.type === 'coding') {
      body.append(
        el('p', {}, row.source ? el('span', {}, 'Evaluated: your last ', el('strong', {text: row.source}), ` (${row.language}).`) : el('span', {text: 'Not evaluated: this code was never run or saved. On a real assessment it would score zero.'})),
        row.unsavedChanges ? el('p', {class: 'muted small', text: 'You changed the code after that point without running or saving it, so those changes were not evaluated.'}) : el('span'),
        row.verdicts ? el('div', {class: 'verdict-strip'}, row.verdicts.map((v, k) => el('span', {class: `case-dot ${v === 'success' ? 'ok' : 'bad'}`, title: `Test case ${k}: ${v}`}))) : el('span'),
        row.code ? el('details', {}, el('summary', {text: 'Show the evaluated code'}), el('pre', {class: 'code-view', text: row.code})) : el('span'),
        el('div', {class: 'row-actions'}, el('button', {class: 'button small', onclick: () => playbackDialog(test, row)}, icon('play'), 'Replay your coding'), el('a', {class: 'button small', href: `#/question/${row.ref}`}, 'Practise this question')));
    } else if (row.type === 'mcq') {
      body.append(el('div', {class: 'md'}, renderMarkdown(row.question)),
        el('ul', {class: 'mcq-review'}, row.options.map((text, k) => el('li', {class: `${row.answer.includes(k) ? 'right' : ''}${row.selected.includes(k) ? ' picked' : ''}`},
          icon(row.answer.includes(k) ? 'check' : row.selected.includes(k) ? 'cross' : 'chevron'), el('span', {class: 'md'}, renderMarkdown(text)), row.selected.includes(k) ? el('small', {class: 'muted', text: 'your choice'}) : null))),
        el('div', {class: 'md explanation'}, renderMarkdown(`**Explanation.** ${row.explanation}`)));
    } else {
      body.append(el('div', {class: 'md'}, renderMarkdown(row.question)),
        el('h4', {text: 'Your answer'}), el('div', {class: 'md answer-box'}, renderMarkdown(row.answer || '_No answer._')),
        el('h4', {text: 'Feedback'}), el('p', {text: row.feedback}),
        row.covered?.length ? el('ul', {class: 'rubric'}, row.covered.map(c => el('li', {class: 'good'}, icon('check'), c)), row.missed.map(c => el('li', {class: 'todo'}, icon('chevron'), c))) : el('span'),
        el('details', {}, el('summary', {text: 'Model answer'}), el('div', {class: 'md'}, renderMarkdown(row.sampleAnswer))),
        el('p', {class: 'muted small', text: row.gradedBy === 'none' ? 'Not graded: no local model was available.' : `Graded against the rubric by ${row.gradedBy}. On real assessments, written answers are graded by people.`}));
    }
    return el('details', {class: 'report-row'}, el('summary', {},
      el('span', {class: 'num', text: String(i + 1)}), el('span', {class: 'report-title', text: row.title}), el('span', {class: 'muted small', text: TYPE_LABEL[row.type]}),
      el('span', {class: 'grow'}), el('span', {class: 'report-result', text: result(row)}), el('strong', {class: 'report-score', text: `${row.score ?? '—'} / ${row.maxScore}`})), body);
  };
  const i = r.integrity;
  const template = test.templateId;
  root.replaceChildren(
    el('a', {href: '#/tests', class: 'button link'}, '← Practice tests'),
    el('div', {class: 'feedback-head'}, el('h1', {text: test.title}), el('span', {class: 'chip', text: new Date(test.started).toLocaleString()}), el('span', {class: 'chip', text: test.endReason === 'time_up' ? 'Ended: time ran out' : 'Submitted'})),
    el('section', {class: 'score-hero'},
      el('div', {class: 'score-big'}, el('strong', {text: `${r.score}`}), el('span', {text: `/ ${r.max}`})),
      el('div', {}, el('p', {class: 'headline', text: `You scored ${r.percent}%.`}),
        el('p', {class: 'muted', text: `Time used: ${mins(r.timeUsedMs)} of ${test.minutes} min · ${AI_LABEL[test.settings.ai]} · ${INTEGRITY_LABEL[test.settings.integrity]}`}),
        el('p', {class: 'muted small', text: 'Coding questions are scored by the share of weighted test cases passed. Multiple-answer questions give partial credit.'}))),
    el('section', {class: 'panel'}, el('h2', {text: 'Questions'}), el('div', {class: 'report-rows'}, r.rows.map(detail))),
    el('section', {class: 'panel'},
      el('div', {class: 'panel-title-row'}, el('h2', {text: 'Integrity review'}), r.review ? el('span', {class: `risk-badge ${r.review.risk.toLowerCase()}`, title: `Weighted score ${r.review.score}`}, `${r.review.risk} risk`) : null),
      el('p', {class: 'muted small', text: 'Assessment platforms combine signals like these into one risk rating for the reviewer. Each flag adds to the score: Low up to 4, Medium up to 11, High above that.'}),
      r.review?.flags.length ? el('ul', {class: 'flag-list'}, r.review.flags.slice(0, 10).map(f => el('li', {class: `flag-item w${Math.min(4, f.weight)}`}, el('span', {class: 'flag-weight', text: `+${f.weight}`}), el('span', {text: f.text}))))
        : el('p', {class: 'muted', text: 'Nothing was flagged: no time away, no outside pastes and no unusual editing.'}),
      timelineView(test, i.events || []),
      el('div', {class: 'stats-grid'},
        el('div', {class: 'stat'}, el('strong', {text: String(i.tabSwitches)}), el('span', {text: `times you left the test${i.tabAwayMs ? ` (${Math.round(i.tabAwayMs / 1000)} s in total)` : ''}`})),
        el('div', {class: 'stat'}, el('strong', {text: String(i.fullscreenExits)}), el('span', {text: 'full-screen exits'})),
        el('div', {class: 'stat'}, el('strong', {text: String(i.pastes)}), el('span', {text: 'pastes from outside the test'})),
        el('div', {class: 'stat'}, el('strong', {text: String(i.blockedPastes || 0)}), el('span', {text: 'blocked pastes'})),
        i.aiInserts ? el('div', {class: 'stat'}, el('strong', {text: String(i.aiInserts)}), el('span', {text: 'AI code inserts'})) : null,
        r.assistantPrompts !== null ? el('div', {class: 'stat'}, el('strong', {text: String(r.assistantPrompts)}), el('span', {text: 'messages to the AI assistant'})) : null),
      el('p', {class: 'muted small', text: 'On real assessments, employers see this kind of activity: tab switches with their duration, pasted text, full-screen exits, a replay of your typing and the AI conversation.'})),
    r.aiUsage ? aiUsageView(r.aiUsage) : null,
    el('div', {class: 'feedback-actions'},
      template !== 'custom' ? el('button', {class: 'button primary', onclick: async e => { e.currentTarget.disabled = true; try { const t = await api('/api/tests/create', {template}); location.hash = `#/test/${t.id}`; } catch (error) { notify(error.message, 'error'); } }}, 'Take a similar test') : null,
      el('a', {class: 'button', href: '#/tests'}, 'Back to practice tests')));
}

const mmss = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

// The test on one line: time away, pastes, AI inserts, runs and saves, as a reviewer scans it.
function timelineView(test, events) {
  const start = test.started, span = Math.max(60000, (test.ended || start + test.minutes * 60000) - start);
  const KIND = {tab: 'away', fullscreen: 'away', paste: 'paste', 'blocked-paste': 'paste', 'code-reset': 'reset', 'typing-anomaly': 'reset', 'ai-insert': 'ai', run: 'run', tests: 'run', save: 'save', 'no-face': 'face', 'multi-face': 'face'};
  const WHAT = {tab: e => `Away for ${Math.round((e.ms || 0) / 1000)} s`, fullscreen: () => 'Left full screen', paste: e => `Pasted ${e.chars || ''} characters from outside`, 'blocked-paste': () => 'Outside paste blocked',
    'code-reset': e => `Code deleted, then ${e.chars || ''} characters appeared at once`, 'typing-anomaly': e => `Typing at ${e.rate || '?'} characters a second`, 'ai-insert': e => `Inserted ${e.chars || ''} characters of AI code`,
    run: e => `Run Code: ${e.passed}/${e.total}`, tests: e => `Run Tests: ${e.passed}/${e.total}`, save: () => 'Save & Proceed', 'no-face': e => `No face for ${Math.round((e.ms || 0) / 1000)} s`, 'multi-face': () => 'More than one face'};
  const shown = events.filter(e => KIND[e.type] && e.at);
  if (!shown.length || !start) return null;
  const question = key => { const n = test.questions.findIndex(q => q.key === key); return n >= 0 ? ` · question ${n + 1}` : ''; };
  const marks = shown.map(e => {
    const from = e.type === 'tab' && e.ms ? e.at - e.ms : e.at;
    const mark = el('span', {class: `tl-mark ${KIND[e.type]}`, title: `${mmss(from - start)}${question(e.question)} · ${WHAT[e.type](e)}`});
    mark.style.left = `${Math.max(0, Math.min(100, (from - start) / span * 100))}%`;
    if (e.type === 'tab' && e.ms) mark.style.width = `${Math.max(0.5, e.ms / span * 100)}%`;
    return mark;
  });
  const legend = [['away', 'Away'], ['paste', 'Outside paste'], ['reset', 'Unusual editing'], ['ai', 'AI insert'], ['run', 'Run'], ['save', 'Save'], ['face', 'Webcam']]
    .filter(([kind]) => shown.some(e => KIND[e.type] === kind)).map(([kind, label]) => el('span', {class: `tl-key ${kind}`, text: label}));
  return el('div', {class: 'timeline'}, el('div', {class: 'tl-track', role: 'img', 'aria-label': `Timeline of ${shown.length} recorded events`}, marks),
    el('div', {class: 'tl-axis'}, el('span', {text: '0:00'}), el('span', {text: mmss(span)})), el('div', {class: 'tl-legend'}, legend));
}

// AI-usage grades, the kinds of help asked for, and the prompts behind them.
function aiUsageView(ai) {
  if (!ai.used) return el('section', {class: 'panel'}, el('h2', {text: 'AI usage'}), el('p', {class: 'muted', text: 'You didn\'t use the AI assistant in this test.'}));
  const AREAS = {
    context: ['Context quality', 'Prompts that name your code, an error or a constraint, rather than "solve this".'],
    critical: ['Critical thinking', 'Running your code after using an AI suggestion, and pushing back when it was wrong.'],
    collaboration: ['Collaboration', 'Working step by step on your own approach instead of asking for the answer.']
  };
  const TYPES = {solution: 'Full solution', debugging: 'Debugging', syntax: 'Syntax', approach: 'Approach', concept: 'Concepts', other: 'Other'};
  const entries = Object.entries(ai.helpTypes).sort((a, b) => b[1] - a[1]);
  const facts = [
    `${ai.prompts} prompt${ai.prompts === 1 ? '' : 's'}; ${ai.specificShare}% named your code, an error or a constraint.`,
    ai.inserts ? `${ai.verified} of ${ai.inserts} AI code inserts were followed by a run.` : 'You didn\'t insert AI code.',
    ai.pushback ? `You questioned or corrected the AI ${ai.pushback} time${ai.pushback === 1 ? '' : 's'}.` : null,
    ai.solutionRequests ? `${ai.solutionRequests} prompt${ai.solutionRequests === 1 ? '' : 's'} asked for a full solution.` : null,
    ai.ruleChanges ? `${ai.ruleChanges} prompt${ai.ruleChanges === 1 ? '' : 's'} tried to change the AI's rules.` : null,
    ai.redactions ? `The guardrail hid ${ai.redactions} code block${ai.redactions === 1 ? '' : 's'}.` : null
  ].filter(Boolean);
  return el('section', {class: 'panel'},
    el('h2', {text: 'AI usage'}),
    el('p', {class: 'muted small', text: 'Graded A, B or C from what you asked the assistant and what you did with its answers, like the AI-usage summaries reviewers get.'}),
    el('div', {class: 'grade-grid'}, Object.entries(AREAS).map(([key, [label, hint]]) => el('div', {class: 'grade-card'}, el('span', {class: `grade grade-${ai.grades[key]}`, text: ai.grades[key]}), el('div', {}, el('strong', {text: label}), el('p', {class: 'muted small', text: hint}))))),
    el('h3', {class: 'small-heading', text: 'What you asked for'}),
    el('div', {class: 'help-bar', role: 'img', 'aria-label': entries.map(([t, n]) => `${TYPES[t] || t}: ${n}`).join(', ')}, entries.map(([type, n]) => { const seg = el('span', {class: `help-seg ${type}`, title: `${TYPES[type] || type}: ${n}`}); seg.style.flexGrow = String(n); return seg; })),
    el('div', {class: 'help-legend'}, entries.map(([type, n]) => el('span', {class: `help-key ${type}`, text: `${TYPES[type] || type} · ${n}`}))),
    el('ul', {class: 'fact-list'}, facts.map(f => el('li', {text: f}))),
    ai.examples.length ? el('details', {}, el('summary', {text: 'Your prompts'}), el('ul', {class: 'prompt-examples'}, ai.examples.map(e => el('li', {}, el('span', {class: 'chip', text: TYPES[e.type] || e.type}), ' ', e.text)))) : null);
}

// Replays every edit made in one coding question, with pastes and AI inserts marked.
async function playbackDialog(test, row) {
  let data;
  try { data = await api(`/api/tests/playback?id=${test.id}&key=${row.key}`); } catch (error) { notify(error.message, 'error'); return; }
  const events = data.events || [];
  if (!events.length) { notify('Nothing was recorded for this question.'); return; }
  const player = createPlayer(events);
  const code = el('pre', {class: 'code-view playback-code'});
  const time = el('span', {class: 'playback-time'});
  const slider = el('input', {type: 'range', min: 0, max: events.length - 1, value: events.length - 1, 'aria-label': 'Position in the recording'});
  const marks = el('div', {class: 'playback-marks', 'aria-hidden': 'true'}, events.map((e, i) => {
    if (!e.s) return null;
    const mark = el('span', {class: `pb-mark ${e.s}`, title: `${e.s === 'paste' ? 'Paste' : e.s === 'ai' ? 'AI insert' : 'Upload'} at ${mmss(e.t)}`});
    mark.style.left = `${i / Math.max(1, events.length - 1) * 100}%`;
    return mark;
  }));
  let index = events.length - 1, timer = null, speed = 8;
  const show = i => {
    index = i;
    slider.value = String(i);
    const state = player.at(i);
    code.innerHTML = highlight(state.text, state.language || 'python');
    time.textContent = `${mmss(events[i].t)} · ${state.language || ''} · edit ${i + 1} of ${events.length}`;
  };
  const play = el('button', {class: 'button small'}, icon('play'), 'Play');
  const stop = () => { clearInterval(timer); timer = null; play.replaceChildren(icon('play'), 'Play'); };
  play.onclick = () => {
    if (timer) { stop(); return; }
    if (index >= events.length - 1) show(0);
    play.replaceChildren(icon('stop'), 'Pause');
    let clockAt = events[index].t;
    timer = setInterval(() => {
      clockAt += 100 * speed;
      let next = index;
      while (next < events.length - 1 && events[next + 1].t <= clockAt) next++;
      if (next !== index) show(next);
      // Long pauses are skipped.
      if (next < events.length - 1 && events[next + 1].t - clockAt > 4000) clockAt = events[next + 1].t - 300;
      if (next >= events.length - 1) stop();
    }, 100);
  };
  const speedSelect = el('select', {'aria-label': 'Playback speed', onchange: e => { speed = Number(e.target.value); }}, [1, 2, 4, 8, 16, 32].map(n => el('option', {value: n, text: `${n}×`, selected: n === speed})));
  slider.oninput = () => { stop(); show(Number(slider.value)); };
  const dialog = el('dialog', {class: 'dialog wide playback-dialog'},
    el('div', {class: 'dialog-heading'}, el('h2', {text: `Code playback · ${row.title}`}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
    el('p', {class: 'muted small', text: 'Every edit you made, replayed. Marks on the bar show pastes (orange), AI inserts (purple) and uploads (grey). Reviewers watch this to see how a solution was built.'}),
    el('div', {class: 'playback-bar'}, play, speedSelect, time),
    el('div', {class: 'playback-scrub'}, marks, slider),
    code);
  dialog.addEventListener('close', () => { stop(); dialog.remove(); });
  document.body.append(dialog);
  show(index);
  dialog.showModal();
}
