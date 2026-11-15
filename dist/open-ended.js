// Open-ended practice: work locally in your own editor with your own AI tools,
// then submit your code and AI transcript for tests, a debrief and a review.
import {el, api, waitJob, notify, busy, clock, confirmDialog, store, icon, VERDICT_CLASS} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {verdictHero, areaGrid, fixesPanel, stat} from './report.js';

const LANGUAGE_LABEL = {python: 'Python', javascript: 'JavaScript'};
let ticker = null;

export function renderOpenEnded(tasks) {
  if (!tasks.length) return el('div', {class: 'empty-state', text: 'No open-ended tasks found in open-tasks/.'});
  const rows = tasks.map(task => {
    const result = task.active ? el('span', {class: 'status-pill active', text: 'In progress'})
      : task.best ? el('a', {class: `result-chip ${VERDICT_CLASS[task.best.verdict]}`, href: `#/open/${task.best.id}`, text: task.best.verdict})
      : el('span', {class: 'problem-meta', style: 'margin:0', text: task.attempts ? 'Attempted' : '—'});
    const action = task.active ? el('a', {class: 'button primary small', href: `#/open/${task.active.id}`}, 'Resume') : el('button', {class: 'button primary small', onclick: () => startDialog(task)}, 'Start');
    return el('tr', {},
      el('td', {}, el('span', {class: 'problem-name', text: task.title}), el('span', {class: 'problem-meta', text: task.languages.map(l => LANGUAGE_LABEL[l]).join(' · ')})),
      el('td', {text: task.tagline}),
      el('td', {}, el('span', {class: 'chip'}, icon('clock'), `${task.minutes} min`)),
      el('td', {}, result),
      el('td', {class: 'actions'}, action));
  });
  return el('div', {},
    el('table', {class: 'problem-table'},
      el('thead', {}, el('tr', {}, el('th', {text: 'Task'}), el('th', {text: 'Description'}), el('th', {text: 'Time'}), el('th', {text: 'Your result'}), el('th', {}))),
      el('tbody', {}, rows)),
    el('div', {class: 'section-heading'}, el('h2', {text: 'How open-ended practice works'})),
    el('div', {class: 'how-it-works'},
      step('1', 'Start locally', 'We create a starter project on your machine. Open it in your own editor with whatever AI tools you normally use.'),
      step('2', 'Build against the clock', 'Implement the service described in the brief within the time limit. Write your own tests as you go.'),
      step('3', 'Submit & debrief', 'Paste your AI conversation and submit. Hidden acceptance tests run, you answer three questions about your code, then get a verdict and detailed feedback.')));
}

const step = (n, title, text) => el('div', {class: 'how-step'}, el('span', {class: 'step', text: n}), el('strong', {text: title}), el('p', {text}));

function startDialog(task) {
  let language = store.get('dg-language', task.languages[0]);
  if (!task.languages.includes(language)) language = task.languages[0];
  const segmented = el('div', {class: 'segmented', role: 'radiogroup', 'aria-label': 'Language'});
  const paint = () => segmented.replaceChildren(...task.languages.map(lang => el('button', {class: lang === language ? 'active' : '', role: 'radio', 'aria-checked': String(lang === language), onclick: () => { language = lang; store.set('dg-language', lang); paint(); }}, LANGUAGE_LABEL[lang])));
  const start = el('button', {class: 'button primary'}, 'Create my workspace');
  const dialog = el('dialog', {class: 'dialog'},
    el('div', {class: 'dialog-heading'}, el('h2', {text: task.title}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
    el('p', {text: task.tagline}),
    el('label', {text: 'Language'}), el('div', {}, segmented),
    el('ul', {class: 'expect-list'},
      el('li', {}, el('span', {class: 'num', text: '1'}), el('span', {text: 'A starter project is written to a folder on your machine (shown next). Open it in your editor.'})),
      el('li', {}, el('span', {class: 'num', text: '2'}), el('span', {text: `Use any AI tools you like. You have ${task.minutes} minutes, and the timer starts now.`})),
      el('li', {}, el('span', {class: 'num', text: '3'}), el('span', {text: 'Keep your AI conversation. When you submit you\'ll paste it so we can review how you directed the AI.'}))),
    el('p', {class: 'env-check', text: language === 'python' ? 'Python submissions are tested in Docker, so make sure Docker Desktop is running when you submit.' : 'JavaScript submissions are tested in your browser.'}),
    el('div', {class: 'dialog-actions'}, el('button', {class: 'button ghost', onclick: () => dialog.close()}, 'Cancel'), start));
  start.onclick = () => busy(start, async () => {
    const session = await api('/api/open/start', {task: task.id, language});
    dialog.close();
    location.hash = `#/open/${session.id}`;
  }, 'Creating…');
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  paint();
  dialog.showModal();
}

function copyRow(label, value) {
  const button = el('button', {class: 'button small', onclick: async () => { try { await navigator.clipboard.writeText(value); button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1500); } catch { notify('Copy failed: select the text instead.', 'error'); } }}, 'Copy');
  return el('div', {class: 'copy-row'}, el('span', {class: 'copy-label', text: label}), el('code', {text: value}), button);
}

export async function renderOpenSession(root, id) {
  clearInterval(ticker);
  const state = await api('/api/open?id=' + id);
  const header = el('div', {},
    el('a', {href: '#/ai-coding/open-ended', class: 'button link', style: 'margin-bottom:10px'}, '← Open-ended tasks'),
    el('div', {class: 'feedback-head'}, el('h1', {text: state.title}), el('span', {class: 'chip', text: LANGUAGE_LABEL[state.language]}), el('span', {class: 'chip', text: state.task.tagline})));
  if (state.status === 'active') return renderActive(root, state, header);
  if (state.status === 'abandoned') { root.replaceChildren(header, el('div', {class: 'empty-state', text: 'You abandoned this session. Start the task again from the open-ended list.'})); return; }
  if (state.status === 'ended') return renderReport(root, state, header);
  return renderPipeline(root, state, header);
}

function renderActive(root, state, header) {
  const skew = state.serverNow - Date.now();
  const timer = el('div', {class: 'timer'});
  const tick = () => {
    const ms = state.deadline - (Date.now() + skew);
    timer.replaceChildren(icon('clock'), ms > 0 ? clock(ms) : `+${clock(-ms)} over`);
    timer.className = `timer${ms < 300000 ? ' danger' : ms < 600000 ? ' warn' : ''}`;
  };
  tick();
  ticker = setInterval(() => { if (!timer.isConnected) clearInterval(ticker); else tick(); }, 1000);
  const transcript = el('textarea', {rows: 10, placeholder: 'Paste your whole AI conversation here: Claude Code, Cursor, Copilot Chat, ChatGPT… Plain text is fine.', 'aria-label': 'AI transcript', style: 'width:100%'}, store.get('dg-open-transcript-' + state.id, ''));
  const notes = el('textarea', {rows: 3, placeholder: 'Optional: anything the reviewer should know (assumptions, what you would do next).', 'aria-label': 'Notes', style: 'width:100%'}, store.get('dg-open-notes-' + state.id, ''));
  transcript.addEventListener('input', () => store.set('dg-open-transcript-' + state.id, transcript.value));
  notes.addEventListener('input', () => store.set('dg-open-notes-' + state.id, notes.value));
  const submit = el('button', {class: 'button primary'}, 'Submit for review');
  submit.onclick = () => busy(submit, async () => {
    if (!transcript.value.trim()) {
      const ok = await confirmDialog({title: 'Submit without an AI transcript?', body: 'Without the transcript, control over the AI can only be partly assessed.', confirm: 'Submit anyway', cancel: 'Go back'});
      if (!ok) return;
    } else if (!await confirmDialog({title: 'Submit your work?', body: 'We snapshot the files in your workspace folder now. Later changes won\'t count.', confirm: 'Submit'})) return;
    const next = await api('/api/open/submit', {id: state.id, transcript: transcript.value, notes: notes.value});
    store.remove('dg-open-transcript-' + state.id);
    store.remove('dg-open-notes-' + state.id);
    renderPipeline(root, next, header);
  }, 'Submitting…');
  const abandon = el('button', {class: 'button link', onclick: async () => {
    if (!await confirmDialog({title: 'Abandon this session?', body: 'It will be marked abandoned. Your workspace folder stays on disk.', confirm: 'Abandon', danger: true})) return;
    await api('/api/open/abandon', {id: state.id});
    location.hash = '#/ai-coding/open-ended';
  }}, 'Abandon session');
  root.replaceChildren(header,
    el('div', {class: 'open-grid'},
      el('div', {},
        el('section', {class: 'panel'}, el('div', {class: 'panel-title-row'}, el('h2', {text: 'Your workspace'}), timer),
          el('p', {text: 'Your starter project is in this folder. Work in your own editor with any AI tools. Run the provided tests as you go.'}),
          copyRow('Folder', state.workspace), copyRow('Open in VS Code', state.commands.open), copyRow('Run tests', state.commands.test)),
        el('section', {class: 'panel'}, el('h2', {text: 'The task'}), el('div', {class: 'md'}, renderMarkdown(state.task.brief, {language: state.language})))),
      el('section', {class: 'panel submit-panel'},
        el('h2', {text: 'Submit'}),
        el('p', {text: 'When you\'re done, or out of time, paste your AI conversation and submit. Hidden acceptance tests run against your code, then you answer three debrief questions.'}),
        el('label', {text: 'AI transcript'}), transcript,
        el('label', {text: 'Notes for the reviewer', style: 'margin-top:10px;display:block'}), notes,
        el('div', {class: 'dialog-actions', style: 'justify-content:space-between'}, abandon, submit))));
}

async function runInBrowser(bundle) {
  return new Promise(resolve => {
    const worker = new Worker('/runner-worker.js', {type: 'module'});
    const results = [];
    let done = false;
    const finish = timedOut => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      if (timedOut) results.push({file: results.at(-1)?.file || bundle.tests[0], name: 'Run stopped after 60 seconds', status: 'error', ms: 60000, message: 'A test took too long or looped forever.'});
      resolve({results, timedOut});
    };
    const timer = setTimeout(() => finish(true), 60000);
    worker.onmessage = ({data}) => { if (data.type === 'test') results.push(data); else if (data.type === 'done') finish(false); };
    worker.onerror = event => { event.preventDefault?.(); results.push({file: bundle.tests[0], name: 'Runner error', status: 'error', ms: 0, message: event.message || 'The test runner failed to start.'}); finish(false); };
    worker.postMessage({files: bundle.files, mode: 'tests', testFiles: bundle.tests});
  });
}

async function renderPipeline(root, state, header) {
  const progress = el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), el('span', {text: 'Working…'}));
  const say = text => { progress.lastChild.textContent = text; };
  root.replaceChildren(header, el('section', {class: 'panel'}, progress));
  try {
    if (state.status === 'testing') {
      if (state.language === 'javascript') {
        say('Running provided, hidden and your own tests in your browser…');
        const bundle = await api('/api/open/bundle?id=' + state.id);
        const run = await runInBrowser(bundle);
        state = await api('/api/open/result', {id: state.id, results: run.results, timedOut: run.timedOut});
      } else state = await waitJob(await api('/api/open/run', {id: state.id}), say);
    }
    if (state.status === 'questions') state = await waitJob(await api('/api/open/questions', {id: state.id}), say);
    if (state.status === 'debrief' || state.status === 'reviewing') return renderDebrief(root, state, header);
    if (state.status === 'ended') return renderReport(root, state, header);
  } catch (error) {
    root.replaceChildren(header, el('section', {class: 'panel'}, el('p', {class: 'msg error', text: error.message}), el('button', {class: 'button primary', onclick: () => renderOpenSession(root, state.id)}, 'Try again')));
  }
}

function testsPanel(state) {
  const t = state.tests.summary;
  const pill = (label, info) => el('div', {class: 'stat'}, el('strong', {text: info.total ? `${info.passed}/${info.total}` : '—'}), el('span', {text: label}));
  return el('section', {class: 'panel'}, el('h2', {text: 'Test results'}),
    el('div', {class: 'stats-grid'}, pill('hidden acceptance tests', t.hidden), pill('provided tests', t.public), pill('your own tests', t.custom)),
    state.tests.failures?.length ? el('details', {style: 'margin-top:12px'}, el('summary', {text: `Failing acceptance checks (${state.tests.failures.length})`}), el('ul', {}, state.tests.failures.map(name => el('li', {text: name})))) : null);
}

function renderDebrief(root, state, header) {
  const fields = state.debrief.questions.map((question, i) => el('textarea', {id: `open-debrief-${i}`, maxlength: 6000, placeholder: 'A few sentences…'}, state.debrief.answers?.[i] || store.get(`dg-open-debrief-${state.id}`, [])[i] || ''));
  fields.forEach(field => field.addEventListener('input', () => store.set(`dg-open-debrief-${state.id}`, fields.map(f => f.value))));
  const status = el('div', {class: 'progress-line', hidden: true}, el('span', {class: 'spinner'}), el('span', {text: 'Reviewing…'}));
  const submit = el('button', {class: 'button primary'}, 'Get my feedback');
  submit.onclick = async () => {
    submit.disabled = true;
    status.hidden = false;
    try {
      const next = await waitJob(await api('/api/open/debrief', {id: state.id, answers: fields.map(f => f.value)}), text => { status.lastChild.textContent = text; });
      store.remove(`dg-open-debrief-${state.id}`);
      renderReport(root, next, header);
    } catch (error) { notify(error.message, 'error'); submit.disabled = false; status.hidden = true; }
  };
  root.replaceChildren(header, testsPanel(state),
    el('section', {class: 'panel'}, el('h2', {text: 'Debrief'}),
      el('p', {text: 'Answer in a few sentences each. These questions are about your submission, and your answers are the evidence for the communication score.'}),
      state.debrief.questions.map((question, i) => el('div', {class: 'debrief-q'}, el('label', {for: `open-debrief-${i}`, text: `${i + 1}. ${question}`}), fields[i])),
      el('div', {class: 'dialog-actions'}, status, submit)));
}

function renderReport(root, state, header) {
  const report = state.report;
  root.replaceChildren(header,
    verdictHero(report),
    testsPanel(state),
    areaGrid(report),
    report.codeQuality?.length ? el('section', {class: 'panel'}, el('h2', {text: 'Code quality notes'}), el('ul', {class: 'fix-list'}, report.codeQuality.map(note => el('li', {text: note})))) : null,
    fixesPanel(report),
    el('section', {class: 'panel'}, el('h2', {text: 'Session'}), el('div', {class: 'stats-grid'}, stat(`${report.stats.minutesUsed} min`, 'time to submit'), stat(report.stats.filesSubmitted, 'files submitted'), stat(report.stats.transcriptWords.toLocaleString(), 'transcript words'))),
    el('details', {class: 'panel'}, el('summary', {}, el('strong', {text: 'Debrief answers'})),
      el('div', {class: 'transcript', style: 'margin-top:12px'}, state.debrief.questions.map((q, i) => el('div', {class: 'item'}, el('small', {text: q}), state.debrief.answers?.[i] || '(no answer)')))),
    el('div', {class: 'feedback-actions'}, el('a', {class: 'button ghost', href: '#/ai-coding/open-ended'}, 'Back to tasks')));
}
