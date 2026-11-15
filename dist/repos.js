// Code repos: guided multi-phase problems, real-world issues from public
// datasets, short incidents, GitHub imports and take-home tasks. Also the
// feedback page and answer key for guided problems.
import {el, api, waitJob, notify, busy, confirmDialog, store, icon, DIFFICULTY_CLASS, KIND_LABEL, VERDICT_CLASS} from './ui.js';
import {renderMarkdown, codeView, languageOf} from './markdown.js';
import {verdictHero, areaGrid, fixesPanel, stat} from './report.js';
import {loadStatus, getStatus} from './app.js';

const LANGUAGE_LABEL = {python: 'Python', javascript: 'JavaScript'};
const TABS = [
  {key: 'guided', label: 'Guided', blurb: 'Three timed phases in a multi-file codebase'},
  {key: 'real-world', label: 'Real-world issues', blurb: 'Historical bugs from open-source projects'},
  {key: 'import', label: 'Your own repo', blurb: 'Any public GitHub repository'},
  {key: 'incidents', label: 'Quick incidents', blurb: 'Small failing codebases'},
  {key: 'open-ended', label: 'Take-home', blurb: 'Your own editor and AI tools'}
];

export async function renderRepos(root, tab = 'guided') {
  if (!TABS.some(t => t.key === tab)) tab = 'guided';
  const body = el('div', {class: 'repos-body'}, el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading…'));
  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Code repos'}), el('span', {class: 'title-badge', text: 'AI-assisted'})),
    el('p', {class: 'page-lead', text: 'Work in a real, multi-file codebase with an AI agent beside you: explore the file tree, ask questions, plan, and let the agent edit and run tests, with your approval for every change.'}),
    el('nav', {class: 'tab-strip', 'aria-label': 'Code repo types'}, TABS.map(t => el('a', {class: `tab-link${t.key === tab ? ' active' : ''}`, href: `#/repos/${t.key}`, title: t.blurb}, t.label))),
    body);
  const views = {guided: guidedView, 'real-world': realWorldView, import: importView, incidents: incidentsView, 'open-ended': takeHomeView};
  body.replaceChildren(await views[tab]());
  const resume = await resumeBanner();
  if (resume) body.prepend(resume);
}

async function resumeBanner() {
  const [practice, repos] = await Promise.all([api('/api/practice/history').catch(() => []), api('/api/repos/history').catch(() => [])]);
  const active = practice.find(p => !p.mock && p.status === 'active');
  if (!active) return null;
  return el('div', {class: 'notice-banner info resume-banner'}, icon('clock'),
    el('p', {}, el('strong', {text: 'In progress: '}), `${active.title} (${LANGUAGE_LABEL[active.language]}). The timer keeps running.`),
    el('a', {class: 'button primary small', href: `#/ade/practice/${active.id}`}, 'Resume'));
}

// ---------- guided ----------
async function guidedView() {
  const problems = await api('/api/problems');
  if (!getStatus()) await loadStatus().catch(() => {});
  if (!problems.length) return el('div', {class: 'empty-state', text: 'No guided problems found in problems/. Run node scripts/validate-problems.mjs to check them.'});
  const rows = problems.map(problem => {
    const result = problem.active
      ? el('span', {class: 'status-pill active', text: problem.active.status === 'active' ? 'In progress' : 'Awaiting debrief'})
      : problem.best ? el('a', {class: `result-chip verdict-text ${VERDICT_CLASS[problem.best.verdict]}`, href: `#/feedback/${problem.best.id}`, text: problem.best.verdict})
      : el('span', {class: 'muted small', text: problem.attempts ? 'Attempted' : '—'});
    const action = problem.active
      ? el('a', {class: 'button primary small', href: `#/ade/practice/${problem.active.id}`}, 'Resume')
      : el('button', {class: 'button primary small', onclick: () => startDialog(problem)}, 'Start');
    return el('tr', {},
      el('td', {}, el('span', {class: 'problem-name', text: problem.title}), el('span', {class: 'problem-meta', text: `${problem.pattern} · ${problem.minutes} min · ${problem.languages.map(l => LANGUAGE_LABEL[l]).join(', ')}`})),
      el('td', {}, el('span', {class: `difficulty ${DIFFICULTY_CLASS[problem.difficulty]}`, text: problem.difficulty})),
      el('td', {}, result),
      el('td', {}, el('button', {class: 'icon-button answer-key', title: 'Answer key', 'aria-label': `Answer key for ${problem.title}`, onclick: () => answerKey(problem)}, icon('key'))),
      el('td', {class: 'actions'}, action));
  });
  const step = (n, title, text) => el('div', {class: 'how-step'}, el('span', {class: 'step', text: n}), el('strong', {text: title}), el('p', {text}));
  return el('div', {},
    el('table', {class: 'problem-table'},
      el('thead', {}, el('tr', {}, el('th', {text: 'Problem'}), el('th', {text: 'Difficulty'}), el('th', {text: 'Your result'}), el('th', {text: 'Answer key'}), el('th', {}))),
      el('tbody', {}, rows)),
    el('div', {class: 'section-heading'}, el('h2', {text: 'How a guided repo works'}), el('a', {href: '#/guide', text: 'How it\'s scored →'})),
    el('div', {class: 'how-it-works'},
      step('1', 'Debug', 'A codebase arrives with a bug. Reproduce it with the phase 1 tests and fix it.'),
      step('2', 'Build', 'Implement the core feature. Direct the agent, review its diffs and verify with the phase 2 tests.'),
      step('3', 'Optimize', 'Bigger inputs break the simple approach. Find a better algorithm or data structure.')));
}

export async function startDialog(problem) {
  let language = store.get('dg-language', 'python');
  if (!problem.languages.includes(language)) language = problem.languages[0];
  const check = el('div', {class: 'env-check'});
  const startButton = el('button', {class: 'button primary'}, 'Start session');
  const segmented = el('div', {class: 'segmented', role: 'radiogroup', 'aria-label': 'Language'});
  const paintLanguages = () => segmented.replaceChildren(...problem.languages.map(lang => el('button', {class: language === lang ? 'active' : '', role: 'radio', 'aria-checked': String(language === lang), onclick: () => { language = lang; store.set('dg-language', lang); paintLanguages(); checkEnvironment(); }}, LANGUAGE_LABEL[lang])));
  const checkEnvironment = async () => {
    const s = getStatus() || await loadStatus().catch(() => null);
    const notes = [];
    let ok = true;
    if (language === 'python') {
      if (!s?.docker) { ok = false; notes.push('Docker Desktop is not running. Python code runs in an isolated container: start Docker, or choose JavaScript, which runs in your browser.'); }
      else notes.push('Python runs in an isolated Docker container (python:3.12-slim, no network access).');
    } else notes.push('JavaScript tests run in your browser in an isolated worker. Agent commands use Docker when it is running.');
    if (!s?.ollama || !s?.models?.models.length) notes.push('Ollama or a chat model is missing, so the AI assistant will be unavailable. You can still practise.');
    else notes.push(`AI assistant and agent: ${s.models.assistant} (you can switch models in the chat).`);
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
      el('li', {}, el('span', {class: 'num', text: '2'}), el('span', {text: 'Build the core feature with the AI agent.'})),
      el('li', {}, el('span', {class: 'num', text: '3'}), el('span', {text: 'Optimize: tougher tests break the straightforward approach.'})),
      el('li', {}, el('span', {class: 'num', text: '✓'}), el('span', {text: 'Answer three debrief questions, then get feedback on problem solving, control over the AI, verification and communication.'}))),
    check,
    el('p', {class: 'small', text: `The ${problem.minutes}-minute timer starts as soon as you press Start.`}),
    el('div', {class: 'dialog-actions'}, el('button', {class: 'button ghost', onclick: () => dialog.close()}, 'Cancel'), startButton));
  startButton.onclick = () => busy(startButton, async () => {
    if (language === 'python') {
      const job = await api('/api/practice/preflight', {language});
      await waitJob(job, message => { check.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), message)); });
    }
    const session = await api('/api/practice/start', {problem: problem.id, language});
    dialog.close();
    location.hash = `#/ade/practice/${session.id}`;
  }, 'Preparing…');
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  paintLanguages();
  dialog.showModal();
  checkEnvironment();
}

export async function answerKey(problem, {language: chosen, confirmed = false} = {}) {
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

// ---------- real-world issues ----------
async function realWorldView() {
  const library = await api('/api/tasks').catch(() => null);
  const language = el('select', {id: 'taskLanguage', 'aria-label': 'Task language'},
    el('option', {value: 'all', text: 'Surprise me · all languages'}),
    [['python', 'Python'], ['c', 'C'], ['cpp', 'C++'], ['go', 'Go'], ['java', 'Java'], ['node', 'JavaScript'], ['typescript', 'TypeScript'], ['php', 'PHP'], ['ruby', 'Ruby'], ['rust', 'Rust']].map(([value, text]) => el('option', {value, text})));
  language.value = store.get('dg-task-language', 'all');
  language.onchange = () => store.set('dg-task-language', language.value);
  const scope = el('select', {'aria-label': 'Codebase era'}, el('option', {value: 'all', text: 'All historical tasks'}), el('option', {value: 'legacy', text: 'Legacy · 2020 and earlier'}));
  const progress = el('p', {class: 'muted small', role: 'status'});
  const preview = el('div', {class: 'task-preview', hidden: true});
  const find = el('button', {class: 'button primary'}, icon('refresh'), 'Find a task');
  find.onclick = () => busy(find, async () => {
    const task = await waitJob(await api('/api/task/random', {language: language.value, scope: scope.value}), text => { progress.textContent = text; });
    progress.textContent = task.recycled ? 'You have seen every matching task, so a new rotation started.' : `${task.total} tasks in this rotation.`;
    const open = el('button', {class: 'button primary'}, 'Open this codebase');
    open.onclick = () => busy(open, async () => {
      const meta = await waitJob(await api('/api/task/start', {taskId: task.id}), text => { progress.textContent = text; });
      progress.textContent = '';
      location.hash = `#/ade/repo/${meta.id}`;
    }, 'Preparing…');
    preview.hidden = false;
    preview.replaceChildren(
      el('div', {class: 'task-head'}, el('h3', {text: task.repo}), task.difficulty ? el('span', {class: 'chip', text: `Estimated fix: ${task.difficulty}`}) : null),
      el('div', {class: 'md task-brief'}, renderMarkdown(task.brief.slice(0, 2400) + (task.brief.length > 2400 ? '…' : ''))),
      el('p', {class: 'muted small', text: `${task.id} · ${task.created.slice(0, 10)} · commit ${task.commit.slice(0, 12)}`}),
      el('div', {class: 'row-actions'}, open, el('button', {class: 'button ghost', onclick: () => find.click()}, 'Show another')));
  }, 'Finding…');
  return el('div', {class: 'repos-grid'},
    el('section', {class: 'panel'},
      el('h2', {text: 'A new codebase. A real issue.'}),
      el('p', {text: 'Random tasks from SWE-bench Verified (Python projects such as Django, SymPy and scikit-learn) and SWE-bench Multilingual (nine more languages). You get the project at the historical commit, the issue text, and the regression tests that decide whether your fix works.'}),
      library ? el('p', {class: 'muted small', text: `${library.count} tasks from ${library.repositories} repositories in ${library.languages.length} languages.`}) : el('p', {class: 'muted small', text: 'The task library downloads on first use.'}),
      el('div', {class: 'form-row'}, el('label', {}, 'Language', language), el('label', {}, 'Codebase era', scope)),
      el('div', {class: 'row-actions'}, find),
      progress,
      el('p', {class: 'muted small', text: 'Large projects can need several GB of disk and some minutes to prepare. Test runs use the project\'s own environment image.'})),
    preview);
}

// ---------- GitHub import ----------
async function importView() {
  const url = el('input', {type: 'url', placeholder: 'https://github.com/owner/repo', required: true, 'aria-label': 'Public repository URL'});
  const importForm = el('form', {class: 'inline-form', onsubmit: event => { event.preventDefault(); busy(event.submitter, async () => { const meta = await api('/api/session', {url: url.value.trim()}); location.hash = `#/ade/repo/${meta.id}`; }, 'Cloning…'); }},
    url, el('button', {class: 'button primary', type: 'submit'}, 'Import'));
  const queryInput = el('input', {type: 'search', value: 'language:python stars:>2000 topic:cli', 'aria-label': 'Search GitHub repositories'});
  const results = el('div', {class: 'repo-results'});
  const search = el('form', {class: 'inline-form', onsubmit: event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      const repos = await api('/api/search?q=' + encodeURIComponent(queryInput.value));
      results.replaceChildren(...(repos.length ? repos.map(repo => el('article', {class: 'repo-card'},
        el('div', {}, el('a', {href: repo.url, target: '_blank', rel: 'noreferrer', text: repo.name}), el('p', {class: 'muted small', text: `${repo.language ? repo.language + ' · ' : ''}${repo.description || 'No description.'}`})),
        el('button', {class: 'button small', onclick: event2 => busy(event2.currentTarget, async () => { const meta = await api('/api/session', {url: repo.url}); location.hash = `#/ade/repo/${meta.id}`; }, 'Cloning…')}, 'Open'))) : [el('p', {class: 'muted', text: 'No repositories found. Try another search.'})]));
    });
  }}, queryInput, el('button', {class: 'button', type: 'submit'}, 'Search GitHub'));
  const history = (await api('/api/repos/history').catch(() => [])).filter(r => !r.challenge && !r.benchmark);
  return el('div', {class: 'repos-grid'},
    el('section', {class: 'panel'},
      el('h2', {text: 'Bring any codebase'}),
      el('p', {text: 'Import a public GitHub repository, including large or archived ones. Pick your own issue, set its test command in the Tests tab, and work with the agent.'}),
      el('label', {text: 'Public repository URL'}), importForm,
      el('label', {text: 'Or search GitHub'}), search, results),
    el('section', {class: 'panel'}, el('h2', {text: 'Your imported repos'}),
      history.length ? el('div', {class: 'recent-list'}, history.slice(0, 12).map(r => el('a', {class: 'recent-row', href: `#/ade/repo/${r.id}`}, el('span', {class: 'recent-title', text: r.title}), el('span', {class: 'muted small', text: `${r.runtime || ''} · ${new Date(r.started).toLocaleDateString()}`}))))
        : el('p', {class: 'muted', text: 'Nothing imported yet.'})));
}

// ---------- incidents ----------
async function incidentsView() {
  const challenges = await api('/api/challenges');
  return el('div', {class: 'incident-grid'}, challenges.map((challenge, i) => {
    const start = el('button', {class: 'button primary small'}, 'Start');
    start.onclick = () => busy(start, async () => { const meta = await api('/api/session', {challenge: challenge.id}); location.hash = `#/ade/repo/${meta.id}`; });
    return el('article', {class: 'incident-card'}, el('span', {class: 'card-number', text: String(i + 1).padStart(2, '0')}), el('h3', {text: challenge.title}), el('p', {text: challenge.brief}),
      el('footer', {}, el('span', {class: 'muted small', text: `${challenge.category} · ${challenge.minutes} min`}), start));
  }));
}

// ---------- take-home ----------
async function takeHomeView() {
  const [tasks, module] = await Promise.all([api('/api/open/tasks').catch(() => []), import('./open-ended.js').catch(() => null)]);
  if (!module) return el('div', {class: 'empty-state', text: 'Take-home tasks are not available.'});
  return el('div', {}, el('p', {class: 'muted', text: 'Work locally in your own editor with your own AI tools, submit when you\'re done, answer the debrief questions, then get feedback.'}), module.renderOpenEnded(tasks, {status: getStatus, loadStatus}));
}

// ---------- guided feedback ----------
export async function renderFeedback(root, id) {
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading feedback…'));
  const data = await api('/api/practice?id=' + id);
  if (data.mock) { location.replace(`#/mockreport/${data.mock}`); return; }
  if (data.status === 'active') { location.hash = `#/ade/practice/${id}`; return; }
  if (!data.report) {
    root.replaceChildren(el('div', {class: 'empty-state'}, el('p', {text: 'This session has not been reviewed yet.'}), el('a', {class: 'button primary', href: `#/ade/practice/${id}`}, 'Answer the debrief')));
    return;
  }
  const report = data.report;
  const problemRef = {id: data.problemId, title: data.title, languages: data.problem.languages};
  const stats = report.stats;
  const prompts = data.chat.filter(m => m.role === 'user');
  root.replaceChildren(
    el('a', {href: '#/activity', class: 'button link'}, '← Your activity'),
    el('div', {class: 'feedback-head'}, el('h1', {text: data.title}), el('span', {class: `chip difficulty ${DIFFICULTY_CLASS[data.difficulty]}`, text: data.difficulty}), el('span', {class: 'chip', text: LANGUAGE_LABEL[data.language]}), el('span', {class: 'chip', text: new Date(data.started).toLocaleString()})),
    verdictHero(report),
    areaGrid(report),
    fixesPanel(report),
    el('section', {class: 'panel'}, el('h2', {text: 'Phases'}),
      el('table', {class: 'mini-table'}, el('thead', {}, el('tr', {}, el('th', {text: 'Phase'}), el('th', {text: 'Task'}), el('th', {text: 'Result'}), el('th', {text: 'Time'}), el('th', {text: 'Hints'}))),
        el('tbody', {}, report.phases.map(p => el('tr', {}, el('td', {text: `${p.number} · ${KIND_LABEL[p.kind]}`}), el('td', {text: p.title}), el('td', {}, el('span', {class: `status-pill ${p.status}`, text: p.status})), el('td', {text: p.minutes === null ? '—' : `${p.minutes} min`}), el('td', {text: String(p.hints)}))))),
      el('div', {class: 'stats-grid'},
        stat(`${stats.minutesUsed} min`, 'time used'), stat(stats.testRuns, 'test runs'), stat(stats.prompts, 'AI prompts'),
        stat(stats.aiPastes ? `${stats.aiPastesVerified}/${stats.aiPastes}` : '—', 'AI changes verified by a run'), stat(stats.hints, 'hints'), stat(`+${stats.linesAdded} / −${stats.linesRemoved}`, 'lines changed'))),
    el('div', {class: 'feedback-actions'},
      el('button', {class: 'button', onclick: () => answerKey(problemRef, {language: data.language, confirmed: true})}, icon('key'), 'Answer key'),
      el('button', {class: 'button primary', onclick: () => startDialog({...problemRef, ...data.problem})}, 'Try again'),
      el('a', {class: 'button ghost', href: '#/repos/guided'}, 'Back to code repos')),
    el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: `Your AI conversation (${prompts.length} prompts)`})),
      el('div', {class: 'transcript'}, prompts.length ? prompts.map(m => el('div', {class: 'item'}, el('small', {text: `Phase ${m.phase} · minute ${Math.round((m.at - data.started) / 60000)}${m.mode ? ` · ${m.mode}` : ''}`}), m.content)) : el('p', {text: 'You did not use the assistant.'}))),
    el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: 'Debrief answers'})),
      el('div', {class: 'transcript'}, (data.debrief?.questions || []).map((q, i) => el('div', {class: 'item'}, el('small', {text: q}), data.debrief.answers?.[i] || '(no answer)')))));
}
