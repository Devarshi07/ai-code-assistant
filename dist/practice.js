// AI-coding practice: routing, the problem library, feedback reports and
// the answer key. The timed workspace lives in workspace.js.
import {$, el, api, waitJob, notify, busy, confirmDialog, store, icon, icons, DIFFICULTY_CLASS, KIND_LABEL, VERDICT_CLASS} from './ui.js';
import {renderMarkdown, codeView, languageOf} from './markdown.js';
import {createWorkspace} from './workspace.js';
import {verdictHero, areaGrid, fixesPanel, stat} from './report.js';

const LANGUAGE_LABEL = {python: 'Python', javascript: 'JavaScript'};
const views = ['library', 'history', 'guide', 'feedback', 'repos', 'open'];
let status = null;

const workspace = createWorkspace($('view-workspace'), {
  onLeave: () => { location.hash = '#/ai-coding'; },
  onFinished: id => { location.hash = `#/feedback/${id}`; }
});

// ---------- shell ----------
function show(name) {
  for (const view of views) $(`view-${view}`).hidden = view !== name;
  document.body.dataset.view = name;
  $('sidebar').classList.remove('open');
  $('sidebarToggle').setAttribute('aria-expanded', 'false');
}

function setNav(key) {
  for (const link of document.querySelectorAll('.nav-link')) link.classList.toggle('active', link.dataset.nav === key);
}

async function route() {
  const hash = location.hash || '#/ai-coding';
  const [, section, part] = hash.split('/');
  document.querySelector('.menu')?.remove();
  try {
    if (section === 'practice' && part) {
      document.title = 'Workspace · Debug Gym';
      await workspace.open(part);
      return;
    }
    if (workspace.id && !$('view-workspace').hidden) workspace.close();
    if (section === 'open' && part) {
      show('open'); setNav('open-ended');
      const module = await import('./open-ended.js');
      await module.renderOpenSession($('view-open'), part, {loadStatus});
      document.title = 'Open-ended session · Debug Gym';
    }
    else if (section === 'feedback' && part) { show('feedback'); setNav('history'); await renderFeedback(part); document.title = 'Feedback · Debug Gym'; }
    else if (section === 'history') { show('history'); setNav('history'); await renderHistory(); document.title = 'Your sessions · Debug Gym'; }
    else if (section === 'guide') { show('guide'); setNav('guide'); renderGuide(); document.title = 'How sessions are graded · Debug Gym'; }
    else if (section === 'repos') { show('repos'); setNav('repos'); document.title = 'Real-world repos · Debug Gym'; }
    else { show('library'); const format = part === 'open-ended' ? 'open-ended' : 'structured'; setNav(format); await renderLibrary(format); document.title = 'AI Coding practice · Debug Gym'; }
  } catch (error) {
    notify(error.message, 'error');
    if (section === 'practice') location.hash = '#/ai-coding';
  }
}

function initShell() {
  $('sidebarToggle').onclick = () => {
    const open = !$('sidebar').classList.contains('open');
    $('sidebar').classList.toggle('open', open);
    $('sidebarToggle').setAttribute('aria-expanded', String(open));
  };
  const theme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const paint = () => { $('themeToggle').innerHTML = theme() === 'dark' ? icons.sun : icons.moon; };
  $('themeToggle').onclick = () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('dg-theme', next);
    paint();
  };
  paint();
  $('setupButton').addEventListener('click', () => renderSetup());
  window.addEventListener('hashchange', route);
}

async function loadStatus() {
  const [base, models] = await Promise.allSettled([api('/api/status'), api('/api/models')]);
  status = {
    docker: base.status === 'fulfilled' && base.value.docker,
    ollama: base.status === 'fulfilled' && base.value.ollama,
    models: models.status === 'fulfilled' ? models.value : {models: [], assistant: null, reviewer: null}
  };
  const health = $('health');
  const ready = status.ollama && status.models.models.length;
  health.textContent = ready ? '●' : '○';
  health.className = `health ${ready && status.docker ? 'ok' : ready ? 'partial' : ''}`;
  health.title = ready ? (status.docker ? 'Assistant and Docker ready' : 'Assistant ready · Docker not running') : 'Ollama not running or no models';
  return status;
}

async function renderSetup() {
  const box = $('setupModels');
  box.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Checking local services…'));
  const s = await loadStatus();
  const row = (label, ok, detail) => el('div', {class: 'row'}, el('span', {text: label}), el('span', {class: ok ? 'ok' : 'bad', text: detail}));
  box.replaceChildren(
    row('Ollama', s.ollama, s.ollama ? 'Running' : 'Not running'),
    row('Assistant model', !!s.models.assistant, s.models.assistant || 'None installed'),
    row('Feedback model', !!s.models.reviewer, s.models.reviewer || 'None installed. Feedback uses rule-based scoring only'),
    row('Docker (Python sessions)', s.docker, s.docker ? 'Running' : 'Not running'));
}

// ---------- library ----------
async function renderLibrary(format) {
  const root = $('view-library');
  const [problems] = await Promise.all([api('/api/problems'), status ? Promise.resolve() : loadStatus().catch(() => {})]);
  const tasks = await api('/api/open/tasks').catch(() => []);
  const head = el('div', {},
    el('div', {class: 'page-title'}, el('h1', {text: 'AI Coding'}), el('span', {class: 'title-badge', text: 'Guided Practice'})),
    el('p', {class: 'page-lead', text: 'Practice AI-enabled coding interviews: read an unfamiliar codebase, fix a bug, build a feature and make it scale, with an AI assistant at your side and instant feedback at the end.'}));
  const card = (key, title, count, text) => el('button', {class: `format-card${format === key ? ' active' : ''}`, onclick: () => { location.hash = key === 'structured' ? '#/ai-coding' : '#/ai-coding/open-ended'; }},
    el('header', {}, el('h2', {text: title}), el('span', {class: 'count', text: count})), el('p', {text}));
  const cards = el('div', {class: 'format-cards'},
    card('structured', 'Structured', `${problems.length} problem${problems.length === 1 ? '' : 's'}`, 'Guided, in-browser problems. Read a codebase, fix bugs, build features and tighten performance against test suites, without leaving the page.'),
    card('open-ended', 'Open-Ended', `${tasks.length} task${tasks.length === 1 ? '' : 's'}`, 'Work locally in your own editor with your own AI tools. Submit when you\'re done, answer debrief questions, then get comprehensive feedback.'));
  const banners = [];
  if (status && !status.ollama) banners.push(el('div', {class: 'notice-banner'}, icon('bulb'), el('p', {}, 'Ollama isn\'t running, so the AI assistant and AI feedback are unavailable. Start Ollama and download a chat model (', el('code', {text: 'ollama pull qwen3:8b'}), ').')));
  else if (status && !status.models.models.length) banners.push(el('div', {class: 'notice-banner'}, icon('bulb'), el('p', {}, 'No chat models are installed. Run ', el('code', {text: 'ollama pull qwen3:8b'}), ' to enable the assistant.')));
  const body = format === 'open-ended' ? await openEndedTable(tasks) : structuredTable(problems);
  root.replaceChildren(head, cards, ...banners, body, format === 'structured' ? howItWorks() : el('span'));
}

function structuredTable(problems) {
  if (!problems.length) return el('div', {class: 'empty-state', text: 'No problems found in problems/. Run node scripts/validate-problems.mjs to check them.'});
  const rows = problems.map(problem => {
    const result = problem.active
      ? el('span', {class: 'status-pill active', text: problem.active.status === 'active' ? 'In progress' : 'Awaiting debrief'})
      : problem.best ? el('a', {class: `result-chip verdict-text ${VERDICT_CLASS[problem.best.verdict]}`, href: `#/feedback/${problem.best.id}`, text: problem.best.verdict})
      : el('span', {class: 'problem-meta', style: 'margin:0', text: problem.attempts ? 'Attempted' : '—'});
    const action = problem.active
      ? el('a', {class: 'button primary small', href: `#/practice/${problem.active.id}`}, 'Resume')
      : el('button', {class: 'button primary small', onclick: () => startDialog(problem)}, 'Start');
    return el('tr', {},
      el('td', {}, el('span', {class: 'problem-name', text: problem.title}), el('span', {class: 'problem-meta', text: problem.pattern})),
      el('td', {}, el('span', {class: `difficulty ${DIFFICULTY_CLASS[problem.difficulty]}`, text: problem.difficulty})),
      el('td', {}, result),
      el('td', {}, el('button', {class: 'icon-button answer-key', title: 'Answer key', 'aria-label': `Answer key for ${problem.title}`, onclick: () => answerKey(problem)}, icon('key'))),
      el('td', {class: 'actions'}, action));
  });
  return el('table', {class: 'problem-table'},
    el('thead', {}, el('tr', {}, el('th', {text: 'Problem'}), el('th', {text: 'Difficulty'}), el('th', {text: 'Your result'}), el('th', {text: 'Answer key'}), el('th', {}))),
    el('tbody', {}, rows));
}

function howItWorks() {
  const step = (n, title, text) => el('div', {class: 'how-step'}, el('span', {class: 'step', text: n}), el('strong', {text: title}), el('p', {text}));
  return el('div', {},
    el('div', {class: 'section-heading'}, el('h2', {text: 'How a session works'}), el('a', {href: '#/guide', text: 'How sessions are graded →'})),
    el('div', {class: 'how-it-works'},
      step('1', 'Debug', 'A multi-file codebase arrives with a bug. Read it, reproduce the failure, fix it and make the phase 1 tests pass.'),
      step('2', 'Build', 'Implement the core feature with your AI assistant. Direct it, review its output and verify it against the phase 2 tests.'),
      step('3', 'Optimize', 'Bigger inputs or stricter limits break the straightforward approach. Find a better algorithm or data structure to pass phase 3.')));
}

async function startDialog(problem) {
  let language = store.get('dg-language', 'python');
  if (!problem.languages.includes(language)) language = problem.languages[0];
  const check = el('div', {class: 'env-check'});
  const startButton = el('button', {class: 'button primary'}, 'Start session');
  const segmented = el('div', {class: 'segmented', role: 'radiogroup', 'aria-label': 'Language'});
  const paintLanguages = () => segmented.replaceChildren(...problem.languages.map(lang => el('button', {class: language === lang ? 'active' : '', role: 'radio', 'aria-checked': String(language === lang), onclick: () => { language = lang; store.set('dg-language', lang); paintLanguages(); checkEnvironment(); }}, LANGUAGE_LABEL[lang])));
  const checkEnvironment = async () => {
    const s = status || await loadStatus().catch(() => null);
    const notes = [];
    let ok = true;
    if (language === 'python') {
      if (!s?.docker) { ok = false; notes.push('Docker Desktop is not running. Python code runs in an isolated container: start Docker, or choose JavaScript, which runs in your browser.'); }
      else notes.push('Python runs in an isolated Docker container (python:3.12-slim, no network access).');
    } else notes.push('JavaScript runs in your browser in an isolated worker. No setup is needed.');
    if (!s?.ollama || !s?.models?.models.length) notes.push('Ollama or a chat model is missing, so the AI assistant will be unavailable. You can still practise.');
    else notes.push(`AI assistant: ${s.models.assistant} (you can switch models during the session).`);
    check.className = `env-check ${ok ? 'good' : 'bad'}`;
    check.replaceChildren(...notes.map(note => el('div', {text: note})));
    startButton.disabled = !ok;
  };
  const dialog = el('dialog', {class: 'dialog'},
    el('div', {class: 'dialog-heading'}, el('h2', {text: problem.title}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
    el('div', {class: 'start-meta'}, el('span', {class: `chip difficulty ${DIFFICULTY_CLASS[problem.difficulty]}`, text: problem.difficulty}), el('span', {class: 'chip', text: problem.pattern}), el('span', {class: 'chip'}, icon('clock'), `${problem.minutes} min`)),
    el('p', {text: problem.summary}),
    el('label', {text: 'Language'}), el('div', {}, segmented),
    el('ul', {class: 'expect-list'},
      el('li', {}, el('span', {class: 'num', text: '1'}), el('span', {text: 'Fix a bug in an unfamiliar, multi-file codebase.'})),
      el('li', {}, el('span', {class: 'num', text: '2'}), el('span', {text: 'Build the core feature with the AI assistant.'})),
      el('li', {}, el('span', {class: 'num', text: '3'}), el('span', {text: 'Optimize: tougher tests break the straightforward approach.'})),
      el('li', {}, el('span', {class: 'num', text: '✓'}), el('span', {text: 'Answer three debrief questions, then get feedback on problem solving, control over the AI, verification and communication.'}))),
    check,
    el('p', {style: 'font-size:.82rem;margin-top:12px', text: `The ${problem.minutes}-minute timer starts as soon as you press Start.`}),
    el('div', {class: 'dialog-actions'}, el('button', {class: 'button ghost', onclick: () => dialog.close()}, 'Cancel'), startButton));
  startButton.onclick = () => busy(startButton, async () => {
    if (language === 'python') {
      const job = await api('/api/practice/preflight', {language});
      await waitJob(job, message => { check.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), message)); });
    }
    const session = await api('/api/practice/start', {problem: problem.id, language});
    dialog.close();
    location.hash = `#/practice/${session.id}`;
  }, 'Preparing…');
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  paintLanguages();
  dialog.showModal();
  checkEnvironment();
}

// ---------- answer key ----------
async function answerKey(problem, {language: chosen, confirmed = false} = {}) {
  if (!confirmed) {
    const ok = await confirmDialog({title: `Answer key: ${problem.title}`, body: 'The answer key explains every phase and includes full reference solutions. If you plan to practise this problem, try it first.', confirm: 'Show answers', cancel: 'Not now'});
    if (!ok) return;
  }
  let language = chosen || store.get('dg-language', problem.languages[0]);
  if (!problem.languages.includes(language)) language = problem.languages[0];
  const data = await api(`/api/problems/answers?problem=${encodeURIComponent(problem.id)}&language=${language}`);
  let phase = 1;
  const content = el('div');
  const tabs = el('div', {class: 'answer-tabs'});
  const languageSwitch = el('div', {class: 'segmented'}, problem.languages.map(lang => el('button', {class: lang === language ? 'active' : '', onclick: () => { dialog.close(); answerKey(problem, {language: lang, confirmed: true}); }}, LANGUAGE_LABEL[lang])));
  const paint = () => {
    tabs.replaceChildren(...data.phases.map(p => el('button', {class: `button small${p.number === phase ? ' primary' : ''}`, onclick: () => { phase = p.number; paint(); }}, `Phase ${p.number} · ${KIND_LABEL[p.kind]}`)));
    const current = data.phases[phase - 1];
    const files = data.solutions[phase] || {};
    content.replaceChildren(
      el('h3', {text: current.title}),
      el('div', {class: 'md'}, renderMarkdown(current.answer, {language})),
      el('h3', {text: 'Reference solution files'}),
      el('div', {class: 'answer-files'}, Object.entries(files).map(([name, text]) => el('div', {}, el('h4', {text: name}), codeView(text, languageOf(name))))));
  };
  const dialog = el('dialog', {class: 'dialog wide'},
    el('div', {class: 'dialog-heading'}, el('h2', {text: `Answer key: ${problem.title}`}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
    languageSwitch, tabs, content);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  paint();
  dialog.showModal();
}

// ---------- feedback ----------
async function renderFeedback(id) {
  const root = $('view-feedback');
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading feedback…'));
  const data = await api('/api/practice?id=' + id);
  if (data.status === 'active') { location.hash = `#/practice/${id}`; return; }
  if (!data.report) {
    root.replaceChildren(el('div', {class: 'empty-state'}, el('p', {text: 'This session has not been reviewed yet.'}), el('a', {class: 'button primary', href: `#/practice/${id}`}, 'Answer the debrief')));
    return;
  }
  const report = data.report;
  const started = new Date(data.started);
  const problemRef = {id: data.problemId, title: data.title, languages: data.problem.languages};
  const stats = report.stats;
  const prompts = data.chat.filter(m => m.role === 'user');
  root.replaceChildren(
    el('a', {href: '#/history', class: 'button link', style: 'margin-bottom:10px'}, '← Your sessions'),
    el('div', {class: 'feedback-head'}, el('h1', {text: data.title}), el('span', {class: `chip difficulty ${DIFFICULTY_CLASS[data.difficulty]}`, text: data.difficulty}), el('span', {class: 'chip', text: LANGUAGE_LABEL[data.language]}), el('span', {class: 'chip', text: started.toLocaleString()})),
    verdictHero(report),
    areaGrid(report),
    fixesPanel(report),
    el('section', {class: 'panel'}, el('h2', {text: 'Phases'}),
      el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'Phase'}), el('th', {text: 'Task'}), el('th', {text: 'Result'}), el('th', {text: 'Time'}), el('th', {text: 'Hints'}))),
        el('tbody', {}, report.phases.map(p => el('tr', {}, el('td', {text: `${p.number} · ${KIND_LABEL[p.kind]}`}), el('td', {text: p.title}), el('td', {}, el('span', {class: `status-pill ${p.status}`, text: p.status})), el('td', {text: p.minutes === null ? '—' : `${p.minutes} min`}), el('td', {text: String(p.hints)}))))),
      el('div', {class: 'stats-grid', style: 'margin-top:14px'},
        stat(`${stats.minutesUsed} min`, 'time used'), stat(stats.testRuns, 'test runs'), stat(stats.prompts, 'AI prompts'),
        stat(stats.aiPastes ? `${stats.aiPastesVerified}/${stats.aiPastes}` : '—', 'AI pastes verified by a run'), stat(stats.hints, 'hints'), stat(`+${stats.linesAdded} / −${stats.linesRemoved}`, 'lines changed'))),
    el('div', {class: 'feedback-actions'},
      el('button', {class: 'button', onclick: () => answerKey(problemRef, {language: data.language, confirmed: true})}, icon('key'), 'Answer key'),
      el('button', {class: 'button primary', onclick: () => startDialog({...problemRef, ...data.problem})}, 'Try again'),
      el('a', {class: 'button ghost', href: '#/ai-coding'}, 'Back to problems')),
    el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: `Your AI conversation (${prompts.length} prompts)`})),
      el('div', {class: 'transcript', style: 'margin-top:12px'}, prompts.length ? prompts.map(m => el('div', {class: 'item'}, el('small', {text: `Phase ${m.phase} · minute ${Math.round((m.at - data.started) / 60000)}`}), m.content)) : el('p', {text: 'You did not use the assistant.'}))),
    el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: 'Debrief answers'})),
      el('div', {class: 'transcript', style: 'margin-top:12px'}, (data.debrief?.questions || []).map((q, i) => el('div', {class: 'item'}, el('small', {text: q}), data.debrief.answers?.[i] || '(no answer)')))));
}

// ---------- history ----------
async function renderHistory() {
  const root = $('view-history');
  const [items, open] = await Promise.all([api('/api/practice/history'), api('/api/open/history').catch(() => [])]);
  const all = [...items.map(i => ({...i, kind: 'structured'})), ...open.map(i => ({...i, kind: 'open'}))].sort((a, b) => b.started - a.started);
  const label = {active: 'In progress', debrief: 'Awaiting debrief', reviewing: 'Reviewing', ended: 'Reviewed'};
  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Your sessions'})),
    el('p', {class: 'page-lead', text: 'Every practice session is stored locally in .sessions/. Reopen feedback or resume a session in progress.'}),
    all.length ? el('table', {class: 'problem-table'},
      el('thead', {}, el('tr', {}, el('th', {text: 'Problem'}), el('th', {text: 'Started'}), el('th', {text: 'Status'}), el('th', {text: 'Result'}), el('th', {}))),
      el('tbody', {}, all.map(item => {
        const href = item.kind === 'open' ? `#/open/${item.id}` : item.status === 'ended' ? `#/feedback/${item.id}` : `#/practice/${item.id}`;
        return el('tr', {},
          el('td', {}, el('span', {class: 'problem-name', text: item.title}), el('span', {class: 'problem-meta', text: `${item.kind === 'open' ? 'Open-ended' : 'Structured'} · ${LANGUAGE_LABEL[item.language] || item.language || ''}`})),
          el('td', {text: new Date(item.started).toLocaleString()}),
          el('td', {}, el('span', {class: `status-pill ${item.status === 'ended' ? 'passed' : 'active'}`, text: label[item.status] || item.status})),
          el('td', {}, item.verdict ? el('span', {class: 'result-chip', text: item.verdict}) : item.phasesPassed !== undefined ? `${item.phasesPassed}/3 phases` : '—'),
          el('td', {class: 'actions'}, el('a', {class: 'button small', href}, item.status === 'ended' ? 'Feedback' : 'Resume')));
      }))) : el('div', {class: 'empty-state', text: 'No sessions yet. Start a problem from AI Coding.'}));
}

// ---------- guide ----------
function renderGuide() {
  const area = (title, text, signals) => el('article', {class: 'area-card'}, el('header', {}, el('h3', {text: title})), el('p', {text}), el('div', {class: 'evidence'}, el('strong', {text: 'Signals recorded'}), signals.map(s => el('p', {text: s}))));
  $('view-guide').replaceChildren(el('div', {class: 'guide'},
    el('div', {class: 'page-title'}, el('h1', {text: 'How sessions are graded'})),
    el('p', {class: 'page-lead', text: 'AI-enabled coding rounds give you a real codebase and an AI assistant. Interviewers care less about whether the AI can solve the problem and more about whether you stay in control: you make the decisions, verify the output and explain your reasoning.'}),
    el('h2', {text: 'The four areas'}),
    el('div', {class: 'area-grid'},
      area('Problem solving', 'Did you understand the codebase, break the work into steps, choose sound approaches and finish the phases?', ['Phases passed and time per phase', 'Hints used', 'Final code changes, compared with the reference approach']),
      area('Control over the AI', 'Did you direct the AI with specific, scoped prompts after forming your own plan, or hand it the problem and accept whatever came back?', ['Number and specificity of prompts (whether they name files, functions or classes)', 'Time and files read before the first prompt', 'Problem statements pasted straight into the AI']),
      area('Verification', 'Did you review and test what the AI produced, run tests after each meaningful change and catch mistakes?', ['Test and program runs', 'Whether each paste of AI code was followed by a run', 'Custom tests you added']),
      area('Communication', 'Can you explain the root cause, your design and complexity, and what the AI got right or wrong?', ['Your answers to the three debrief questions'])),
    el('h2', {text: 'Scores and the practice verdict'}),
    el('div', {class: 'md'}, renderMarkdown('Each area is scored from **1** (needs work) to **4** (strong). Scores are bounded by recorded evidence before any AI review. For example, a session with no test runs can\'t score above 1 for verification, and pasting the problem statement into the AI caps control at 2. If a local model is installed, it writes the narrative and picks scores *within* those bounds.\n\nThe verdict comes from the average: **Strong Hire** ≥ 3.5 · **Hire** ≥ 2.85 · **Lean Hire** ≥ 2.35 · **Lean No Hire** ≥ 1.85 · otherwise **No Hire**. It is practice feedback from a local model, not a hiring decision.')),
    el('h2', {text: 'A good rhythm'}),
    el('div', {class: 'md'}, renderMarkdown('1. **Orient** for a few minutes: README, entry points, data models, existing tests.\n2. **Reproduce** the bug with the phase 1 tests before asking the AI anything.\n3. **Plan** each phase in a sentence or two, then give the AI one scoped task at a time.\n4. **Review, paste, run.** Never stack unverified AI changes.\n5. **Explain** the root cause, the algorithm and its complexity. You\'ll do this again in the debrief.'))));
}

// ---------- open-ended (rendered by open-ended.js when present) ----------
async function openEndedTable(tasks) {
  const module = await import('./open-ended.js').catch(() => null);
  if (!module) return el('div', {class: 'empty-state', text: 'Open-ended tasks are not available.'});
  return module.renderOpenEnded(tasks, {status: () => status, loadStatus});
}

initShell();
loadStatus().catch(() => {});
route();
