// Real-world repo practice: the lobby (random SWE-bench tasks, short incidents,
// GitHub import and search) and a full-screen workspace for any codebase.
import {$, el, api, waitJob, notify, busy, clock, store, icon, splitter} from './ui.js';
import {CodeEditor} from './editor.js';
import {renderMarkdown, languageOf} from './markdown.js';

const root = $('repo-ide');
const FOLDER_LIMIT = 400;
const refs = {};
let runtimes = {}, current = null, editor = null, tabs = [], active = null, index = new Map(), expanded = new Set(['']);
let filterText = '', chatHistory = [], lastOutput = '', lastResult = null, running = false, locked = false;
let sideTab = 'brief', panelTab = 'output', clockTimer = null, smallModel = 'qwen2.5-coder:0.5b';

const dirty = tab => !!tab && tab.content !== tab.saved;
// interview-ui.js still uses the original (tag, text, className) helper.
const legacyEl = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };

// ---------- lobby ----------
async function status() {
  const state = await api('/api/status');
  smallModel = state.model || smallModel;
  $('setupStatus').textContent = `Docker: ${state.docker ? 'ready' : 'not running'} · Ollama: ${state.ollama ? 'connected' : 'not running'} · 0.5B copilot: ${state.modelReady ? 'ready' : 'not downloaded'} · 3B interviewer: ${state.interviewerReady ? 'ready' : 'not downloaded'}`;
}

function initLobby() {
  $('setupButton').addEventListener('click', () => { $('setup').showModal(); status().catch(error => notify(error.message, 'error')); });
  $('closeSetup').onclick = () => $('setup').close();
  $('refreshStatus').onclick = event => busy(event.currentTarget, status);
  $('pull').onclick = event => busy(event.currentTarget, async () => {
    $('setupStatus').textContent = 'Downloading the model. This can take several minutes…';
    await waitJob(await api('/api/model/pull', {}), text => { $('setupStatus').textContent = text; });
    await status();
  });
  $('randomTask').onclick = event => busy(event.currentTarget, async () => {
    const task = await waitJob(await api('/api/task/random', {language: $('taskLanguage').value, scope: $('taskScope').value}), text => { $('taskProgress').textContent = text; });
    $('taskProgress').textContent = task.recycled ? 'You have seen every matching task. Starting a new rotation.' : `${task.total} tasks in this rotation`;
    const open = el('button', {class: 'primary'}, 'Open this codebase');
    open.onclick = e => busy(e.currentTarget, async () => {
      await enter(await waitJob(await api('/api/task/start', {taskId: task.id}), text => { $('taskProgress').textContent = text; }));
      $('taskProgress').textContent = '';
    });
    const preview = $('taskPreview');
    preview.hidden = false;
    preview.replaceChildren(
      el('h3', {text: task.repo}),
      el('p', {text: task.brief.slice(0, 1800)}),
      el('small', {text: `${task.id} · ${task.created.slice(0, 10)} · ${task.commit.slice(0, 12)}${task.difficulty ? ' · estimated fix: ' + task.difficulty : ''}`}),
      open);
  });
  $('importForm').onsubmit = event => { event.preventDefault(); busy(event.submitter, async () => enter(await api('/api/session', {url: $('repoUrl').value.trim()})), 'Cloning…'); };
  $('searchForm').onsubmit = event => {
    event.preventDefault();
    busy(event.submitter, async () => {
      const repos = await api('/api/search?q=' + encodeURIComponent($('query').value));
      $('results').replaceChildren(...(repos.length ? repos.map(repo => {
        const button = el('button', {}, 'Practice with this repo');
        button.onclick = e => busy(e.currentTarget, async () => enter(await api('/api/session', {url: repo.url})), 'Cloning…');
        return el('article', {class: 'repo'}, el('a', {href: repo.url, target: '_blank', rel: 'noreferrer', text: repo.name}), el('p', {text: `${repo.language ? repo.language + ' · ' : ''}${repo.description || 'No description provided.'}`}), button);
      }) : [el('p', {text: 'No repositories found. Try another search.'})]));
    });
  };
}

async function renderChallenges() {
  const challenges = await api('/api/challenges');
  $('challenges').replaceChildren(...challenges.map((challenge, i) => {
    const start = el('button', {class: 'primary'}, 'Start debugging →');
    start.onclick = event => busy(event.currentTarget, async () => enter(await api('/api/session', {challenge: challenge.id})));
    return el('article', {class: 'card'}, el('span', {class: 'card-number', text: `0${i + 1}`}), el('h3', {text: challenge.title}), el('p', {text: challenge.brief}),
      el('footer', {}, el('span', {text: `${challenge.category} · ${challenge.minutes} min`}), start));
  }));
}

async function renderResume() {
  $('repoResume')?.remove();
  let id = store.get('debug-gym-session', null);
  // The original workspace stored the id as a raw string rather than JSON.
  if (!id) try { id = localStorage.getItem('debug-gym-session'); } catch {}
  if (!id || !/^[a-f0-9-]{36}$/.test(String(id))) return;
  try {
    const session = await api('/api/session?id=' + id);
    $('repoResume')?.remove();
    $('lobby').prepend(el('div', {class: 'notice-banner info resume-banner', id: 'repoResume'},
      el('p', {}, el('strong', {text: 'Continue where you left off: '}), session.title),
      el('button', {class: 'primary', onclick: () => enter(session)}, 'Open workspace')));
  } catch { store.remove('debug-gym-session'); }
}

// ---------- workspace layout ----------
function buildIde() {
  refs.back = el('button', {class: 'icon-button', id: 'back', 'aria-label': 'Back to repositories', title: 'Back to repositories', onclick: () => { location.hash = '#/repos'; }}, icon('back'));
  refs.title = el('strong');
  refs.chips = el('span', {class: 'ide-chips'});
  refs.heading = el('div', {class: 'work-heading'});
  refs.timer = el('div', {class: 'timer', title: 'Time since this session started'});
  const top = el('header', {class: 'ide-top'}, refs.back, el('div', {class: 'ide-title'}, refs.title, refs.chips), el('span', {class: 'topbar-spacer'}), refs.heading, refs.timer);

  refs.filter = el('input', {class: 'tree-filter', type: 'search', placeholder: 'Find a file…', 'aria-label': 'Filter files by path'});
  refs.filter.addEventListener('input', () => { filterText = refs.filter.value.trim().toLowerCase(); renderTree(); });
  refs.count = el('div', {class: 'tree-count'});
  refs.tree = el('div', {class: 'file-tree', role: 'tree'});
  refs.newFile = el('button', {class: 'icon-button', id: 'newFile', title: 'New file', 'aria-label': 'New file', onclick: newFile}, icon('plus'));
  const explorer = el('aside', {class: 'explorer', 'aria-label': 'Files'},
    el('div', {class: 'pane-header'}, el('span', {text: 'Explorer'}), refs.newFile),
    el('div', {class: 'tree-tools'}, refs.filter, refs.count), refs.tree);

  refs.tabs = el('div', {class: 'tabs-bar', role: 'tablist'});
  refs.cursor = el('span');
  refs.saveState = el('span');
  refs.save = el('button', {class: 'button small', id: 'save', onclick: () => saveAll().catch(error => notify(error.message, 'error'))}, 'Save');
  const tabsRow = el('div', {class: 'tabs-bar'}, refs.tabs, el('span', {class: 'tabs-spacer'}),
    el('div', {class: 'editor-status'}, refs.cursor, refs.saveState, el('span', {}, el('kbd', {text: 'Ctrl'}), '+', el('kbd', {text: 'S'}), ' save · ', el('kbd', {text: 'Ctrl'}), '+', el('kbd', {text: 'Enter'}), ' run'), refs.save));
  const editorHost = el('div');
  editor = new CodeEditor(editorHost, {
    onChange: value => { if (!active) return; active.content = value; renderTabs(); },
    onSave: () => saveAll().catch(error => notify(error.message, 'error')),
    onRun: () => runTests(),
    onCursor: ({line, column}) => { refs.cursor.textContent = `Ln ${line}, Col ${column}`; }
  });
  editor.input.id = 'editor';

  refs.testState = el('span', {class: 'count', text: 'Not run'});
  refs.outputTab = el('button', {class: 'panel-tab', onclick: () => setPanel('output')}, 'Output', refs.testState);
  refs.envTab = el('button', {class: 'panel-tab', onclick: () => setPanel('env')}, 'Environment');
  refs.envSummary = el('button', {class: 'run-status env-summary', title: 'Change the test command or image', onclick: () => setPanel('env')});
  refs.run = el('button', {class: 'button primary small', id: 'run', onclick: () => runTests()});
  refs.panelBody = el('div', {class: 'panel-body'});
  const bottom = el('section', {class: 'bottom'},
    el('div', {class: 'bottom-bar'}, refs.outputTab, refs.envTab, el('div', {class: 'run-group'}, refs.envSummary, refs.run)),
    refs.panelBody);
  const bottomSplit = el('div', {class: 'splitter horizontal', role: 'separator', 'aria-orientation': 'horizontal'});
  const center = el('section', {class: 'center'}, tabsRow, editorHost, bottomSplit, bottom);

  refs.briefTab = el('button', {class: 'side-tab', onclick: () => setSide('brief')}, icon('file'), 'Brief');
  refs.copilotTab = el('button', {class: 'side-tab', onclick: () => setSide('copilot')}, icon('spark'), 'Copilot');
  refs.brief = el('div', {class: 'instructions'});
  refs.copilot = buildCopilot();
  refs.sidePanel = el('div', {class: 'side-panel'});
  const side = el('aside', {class: 'side', 'aria-label': 'Brief and copilot'}, el('div', {class: 'side-tabs', role: 'tablist'}, refs.briefTab, refs.copilotTab), refs.sidePanel);

  const explorerSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  const panelSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  root.append(top, el('div', {class: 'ide-main'}, explorer, explorerSplit, center, panelSplit, side));
  for (const [name, value] of Object.entries(store.get('dg-repo-sizes', {}))) root.style.setProperty(name, value + 'px');
  splitter(root, explorerSplit, '--explorer-w', x => x - explorer.getBoundingClientRect().left, 160, 520, 'dg-repo-sizes');
  splitter(root, panelSplit, '--panel-w', x => window.innerWidth - x, 300, 760, 'dg-repo-sizes');
  splitter(root, bottomSplit, '--bottom-h', (x, y) => center.getBoundingClientRect().bottom - y, 90, 700, 'dg-repo-sizes');
  root.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.target.closest('.code-editor')) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); saveAll().catch(error => notify(error.message, 'error')); }
    if (event.key === 'Enter') { event.preventDefault(); runTests(); }
  });
  renderRun();
}

// Called by the mock interviewer: lock editing when the interview has ended.
function setLocked(lock, lockBack) {
  locked = !!lock;
  editor.setReadOnly(locked || !active);
  refs.save.disabled = locked;
  refs.newFile.disabled = locked;
  refs.back.disabled = !!lockBack;
  renderRun();
}

// ---------- session ----------
async function openSession(input) {
  const id = typeof input === 'string' ? input : input.id;
  if (current?.id === id && !root.hidden) return;
  const session = typeof input === 'string' ? await api('/api/session?id=' + id) : input;
  if (current && current.id !== session.id && tabs.some(dirty)) await saveAll().catch(() => {});
  current = session;
  tabs = []; active = null; chatHistory = []; lastOutput = ''; lastResult = null; filterText = ''; refs.filter.value = '';
  buildIndex();
  expanded = new Set(['']);
  refs.title.textContent = current.title;
  const runtime = runtimes[current.runtime || 'node'];
  refs.chips.replaceChildren(
    el('span', {class: 'chip', text: runtime?.label || current.runtime || 'Code'}),
    el('span', {class: 'chip', text: current.benchmark ? 'SWE-bench task' : current.source?.startsWith('https://github.com') ? 'GitHub import' : 'Practice incident'}));
  configureEnvironment();
  setTestState('Not run');
  renderBrief();
  renderMessages();
  setSide(sideTab, false);
  setPanel('output');
  editor.setDocument('', {placeholder: 'Open a file from the explorer.'});
  renderTabs();
  renderTree();
  root.hidden = false;
  document.body.classList.add('ide-open');
  store.set('debug-gym-session', session.id);
  clearInterval(clockTimer);
  clockTimer = setInterval(tick, 1000);
  tick();
  const first = current.files.find(name => /^readme(\.\w+)?$/i.test(name))
    || current.files.find(name => /\.(mjs|js|py|go|rs|java|rb|php|ts|c|cpp)$/.test(name) && !/(test|spec)/i.test(name))
    || current.files[0];
  if (first) await openFile(first).catch(error => notify(error.message, 'error'));
  window.dispatchEvent(new CustomEvent('gym-session', {detail: session}));
}

function enter(session) {
  if (location.hash !== `#/repo/${session.id}`) history.pushState(null, '', `#/repo/${session.id}`);
  document.body.dataset.view = 'repos';
  return openSession(session);
}

async function closeIde() {
  if (root.hidden) return;
  if (tabs.some(dirty) && !locked) await saveAll().catch(() => {});
  root.hidden = true;
  document.body.classList.remove('ide-open');
  clearInterval(clockTimer);
  renderResume();
}

function tick() {
  if (current) refs.timer.replaceChildren(icon('clock'), clock(Date.now() - current.started));
}

// ---------- explorer ----------
function buildIndex() {
  index = new Map([['', {dirs: [], files: []}]]);
  for (const name of current.files) {
    const parts = name.split('/');
    let path = '';
    for (let i = 0; i < parts.length - 1; i++) {
      const next = path ? `${path}/${parts[i]}` : parts[i];
      if (!index.has(next)) { index.set(next, {dirs: [], files: []}); index.get(path).dirs.push(next); }
      path = next;
    }
    index.get(path).files.push(name);
  }
  for (const entry of index.values()) { entry.dirs.sort((a, b) => a.localeCompare(b)); entry.files.sort((a, b) => a.localeCompare(b)); }
}

function fileRow(name, depth, label = name.split('/').pop(), hint = '') {
  return el('button', {class: `tree-row${active?.path === name ? ' active' : ''}`, style: `padding-left:${24 + depth * 14}px`, role: 'treeitem', title: name, onclick: () => openFile(name).catch(error => notify(error.message, 'error'))},
    icon('file'), el('span', {class: 'tree-label', text: label}), hint ? el('span', {class: 'tree-hint', text: hint}) : null);
}

function renderTree() {
  if (!current) return;
  const rows = [];
  if (filterText) {
    const matches = current.files.filter(name => name.toLowerCase().includes(filterText));
    refs.count.textContent = `${matches.length.toLocaleString()} match${matches.length === 1 ? '' : 'es'}${matches.length > 300 ? ' · showing 300' : ''}`;
    for (const name of matches.slice(0, 300)) {
      const slash = name.lastIndexOf('/');
      rows.push(fileRow(name, 0, name.slice(slash + 1), slash > 0 ? name.slice(0, slash) : ''));
    }
    if (!matches.length) rows.push(el('p', {class: 'placeholder', text: 'No files match.'}));
  } else {
    refs.count.textContent = `${current.files.length.toLocaleString()} files`;
    const walk = (dir, depth) => {
      const entry = index.get(dir);
      for (const sub of entry.dirs) {
        const open = expanded.has(sub);
        rows.push(el('button', {class: `tree-row${open ? ' open' : ''}`, style: `padding-left:${10 + depth * 14}px`, role: 'treeitem', 'aria-expanded': String(open), title: sub,
          onclick: () => { open ? expanded.delete(sub) : expanded.add(sub); renderTree(); }},
          icon('chevron', 'icon chev'), icon('folder'), el('span', {class: 'tree-label', text: sub.split('/').pop()})));
        if (open) walk(sub, depth + 1);
      }
      for (const name of entry.files.slice(0, FOLDER_LIMIT)) rows.push(fileRow(name, depth));
      if (entry.files.length > FOLDER_LIMIT) rows.push(el('p', {class: 'placeholder', style: `padding-left:${24 + depth * 14}px`, text: `${entry.files.length - FOLDER_LIMIT} more files. Use Find a file.`}));
    };
    walk('', 0);
  }
  refs.tree.replaceChildren(...rows);
}

function reveal(name) {
  const parts = name.split('/');
  for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
}

// ---------- tabs & files ----------
function renderTabs() {
  refs.tabs.replaceChildren(...tabs.map(tab => el('button', {class: `file-tab${tab === active ? ' active' : ''}`, role: 'tab', 'aria-selected': String(tab === active), title: tab.path, onclick: event => { if (!event.target.closest('.close')) openFile(tab.path).catch(error => notify(error.message, 'error')); }},
    tab.path.split('/').pop(),
    dirty(tab) ? el('span', {class: 'dirty', title: 'Unsaved changes'}) : null,
    el('span', {class: 'close', role: 'button', 'aria-label': `Close ${tab.path}`, onclick: () => closeTab(tab)}, '×'))));
  refs.saveState.textContent = !active ? '' : dirty(active) ? 'Unsaved' : 'Saved';
}

async function openFile(name) {
  if (active) active.view = editor.viewState();
  let tab = tabs.find(t => t.path === name);
  if (!tab) {
    const file = await api(`/api/file?id=${current.id}&path=${encodeURIComponent(name)}`);
    tab = {path: name, content: file.content, saved: file.content};
    tabs.push(tab);
  }
  active = tab;
  editor.setDocument(tab.content, {language: languageOf(name)});
  editor.setReadOnly(locked);
  editor.restore(tab.view);
  reveal(name);
  renderTabs();
  if (!filterText) renderTree();
  else for (const row of refs.tree.querySelectorAll('.tree-row')) row.classList.toggle('active', row.title === name);
  refs.tree.querySelector('.tree-row.active')?.scrollIntoView({block: 'nearest'});
}

async function closeTab(tab) {
  if (dirty(tab) && !locked) await saveTab(tab).catch(error => notify(error.message, 'error'));
  const position = tabs.indexOf(tab);
  tabs.splice(position, 1);
  if (active !== tab) { renderTabs(); return; }
  active = null;
  const next = tabs[position] || tabs[position - 1];
  if (next) await openFile(next.path);
  else { editor.setDocument('', {placeholder: 'Open a file from the explorer.'}); renderTabs(); renderTree(); }
}

async function saveTab(tab) {
  if (!dirty(tab)) return;
  const content = tab.content;
  await api('/api/file', {id: current.id, path: tab.path, content});
  tab.saved = content;
}

async function saveAll() {
  if (!current) return;
  if (active) active.content = editor.value;
  for (const tab of tabs) if (dirty(tab)) await saveTab(tab);
  renderTabs();
}

function newFile() {
  if (!current || locked) return;
  const input = el('input', {value: active ? active.path.replace(/[^/]+$/, '') : '', maxlength: 500, placeholder: 'tests/test_regression.py', 'aria-label': 'File path', style: 'width:100%'});
  const dialog = el('dialog', {class: 'dialog small'});
  const close = () => { dialog.close(); dialog.remove(); };
  dialog.append(el('form', {onsubmit: async event => {
    event.preventDefault();
    const name = input.value.trim();
    close();
    if (!name) return;
    try {
      await saveAll();
      current.files = (await api('/api/file/create', {id: current.id, path: name})).files;
      buildIndex();
      await openFile(name);
    } catch (error) { notify(error.message, 'error'); }
  }},
    el('h2', {text: 'New file'}),
    el('p', {text: 'A relative path. Missing folders are created, for example tests/test_regression.py.'}),
    input,
    el('div', {class: 'dialog-actions'}, el('button', {class: 'button ghost', type: 'button', onclick: close}, 'Cancel'), el('button', {class: 'button primary', type: 'submit'}, 'Create'))));
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}

// ---------- running ----------
function configureEnvironment() {
  const runtime = runtimes[current.runtime || 'node'] || runtimes.node;
  refs.env = {
    runtime: el('select', {'aria-label': 'Language runtime'}, Object.entries(runtimes).map(([id, r]) => el('option', {value: id, text: r.label}))),
    command: el('input', {'aria-label': 'Test command', value: current.benchmark ? 'Task-specific regression suite' : runtime.command}),
    image: el('input', {'aria-label': 'Runtime image', value: current.benchmark ? current.image : runtime.image})
  };
  refs.env.runtime.value = current.runtime || 'node';
  for (const field of Object.values(refs.env)) field.disabled = !!current.benchmark;
  refs.env.runtime.onchange = () => {
    const chosen = runtimes[refs.env.runtime.value];
    refs.env.command.value = chosen.command;
    refs.env.image.value = chosen.image;
    renderEnvSummary();
  };
  refs.env.command.oninput = renderEnvSummary;
  renderEnvSummary();
}

function renderEnvSummary() {
  refs.envSummary.textContent = current.benchmark ? 'Task regression suite' : `${runtimes[refs.env.runtime.value]?.label || ''} · ${refs.env.command.value}`.slice(0, 60);
}

function renderRun() {
  refs.run.disabled = running || locked || !current;
  refs.run.replaceChildren(icon('play'), running ? 'Running…' : 'Run tests');
}

function setPanel(name) {
  panelTab = name;
  refs.outputTab.classList.toggle('active', name === 'output');
  refs.envTab.classList.toggle('active', name === 'env');
  if (name !== 'env') { renderOutput(); return; }
  refs.panelBody.replaceChildren(el('div', {class: 'env-panel'},
    el('label', {}, 'Runtime', refs.env.runtime),
    el('label', {}, 'Test command', refs.env.command),
    el('label', {}, 'Image (must contain the project\'s dependencies)', refs.env.image),
    el('p', {class: 'placeholder', text: current.benchmark
      ? 'This SWE-bench task uses its own prepared image and regression script. Read the output yourself: a finished run is not a correctness score.'
      : 'Commands run in a disposable copy of the code with no network access. Compilers are included, but third-party dependencies need a prepared image.'})));
}

function renderOutput(message) {
  if (panelTab !== 'output') return;
  const pre = el('pre', {class: 'output-view'});
  if (message) pre.append(el('span', {class: 'meta'}, el('span', {class: 'spinner', style: 'display:inline-block;vertical-align:middle;margin-right:8px'}), message));
  else if (!lastResult) pre.append(el('span', {class: 'meta', text: current?.benchmark ? 'Run the task\'s regression suite to see what fails before you change anything.' : 'Run the tests to establish your starting point.'}));
  else for (const line of lastResult.output.split('\n').slice(-3000)) {
    const kind = /\b(FAIL(ED|URE)?|ERROR|Error|panicked|failed|AssertionError|Traceback)\b/.test(line) ? 'stderr' : /\b(PASS(ED)?|ok|OK)\b/.test(line) ? 'ok' : '';
    pre.append(kind ? el('span', {class: kind, text: line + '\n'}) : line + '\n');
  }
  refs.panelBody.replaceChildren(pre);
  refs.panelBody.scrollTop = refs.panelBody.scrollHeight;
}

function setTestState(text, kind = '') {
  refs.testState.textContent = text;
  refs.testState.className = `count ${kind}`;
}

async function runTests() {
  if (running || locked || !current) return;
  running = true;
  renderRun();
  setPanel('output');
  setTestState('Running');
  renderOutput('Starting an isolated container…');
  try {
    await saveAll();
    const result = await waitJob(await api('/api/run', {id: current.id, runtime: refs.env.runtime.value, image: refs.env.image.value, command: refs.env.command.value}), message => renderOutput(message));
    lastResult = {...result, output: result.output || '(no output)'};
    lastOutput = result.output;
    if (result.timedOut) setTestState('Timed out', 'bad');
    else if (result.benchmark) setTestState('Suite finished');
    else setTestState(result.code === 0 ? 'Passed' : `Exit ${result.code}`, result.code === 0 ? 'good' : 'bad');
  } catch (error) {
    lastResult = {output: error.message};
    setTestState('Could not run', 'bad');
    notify(error.message, 'error');
  } finally {
    running = false;
    renderRun();
    renderOutput();
  }
}

// ---------- brief ----------
function renderBrief() {
  const meta = [];
  if (current.source?.startsWith('http')) meta.push(el('a', {href: current.source, target: '_blank', rel: 'noreferrer', text: current.source.replace(/^https:\/\/(github\.com|huggingface\.co\/datasets)\//, '').replace(/\.git$/, '')}));
  else if (current.source) meta.push(el('span', {text: current.source}));
  if (current.commit) meta.push(el('span', {class: 'chip', text: `commit ${current.commit.slice(0, 12)}`}));
  if (current.difficulty) meta.push(el('span', {class: 'chip', text: `estimated fix: ${current.difficulty}`}));
  let expected = [];
  try { expected = Array.isArray(current.expectedFailures) ? current.expectedFailures : JSON.parse(current.expectedFailures || '[]'); } catch {}
  refs.brief.replaceChildren(
    el('h2', {class: 'brief-title', text: current.title}),
    el('div', {class: 'brief-meta'}, meta),
    el('div', {class: 'md brief-text'}, renderMarkdown(current.brief || '')),
    expected.length ? el('details', {class: 'overview-card'}, el('summary', {text: `Tests the fix should make pass (${expected.length})`}), el('ul', {class: 'expected-tests'}, expected.slice(0, 50).map(name => el('li', {}, el('code', {text: name}))))) : null,
    el('div', {class: 'notice-banner info'}, el('p', {text: current.benchmark
      ? 'Workflow: run the regression suite, read the failure, find the code responsible, fix it, then run the suite again.'
      : 'Workflow: read the README and tests, run a baseline, reproduce a failure, make a small fix, and verify it.'})));
}

// ---------- copilot ----------
function buildCopilot() {
  refs.model = el('select', {'aria-label': 'Copilot model', onchange: () => store.set('dg-repo-model', refs.model.value)});
  refs.messages = el('div', {class: 'messages', role: 'log', 'aria-live': 'polite'});
  refs.prompt = el('textarea', {rows: 1, placeholder: 'Ask your copilot…', 'aria-label': 'Message the copilot', maxlength: 4000});
  refs.send = el('button', {class: 'icon-button', 'aria-label': 'Send', title: 'Send (Enter)', onclick: () => sendCopilot()}, icon('send'));
  refs.prompt.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendCopilot(); } });
  refs.prompt.addEventListener('input', () => { refs.prompt.style.height = 'auto'; refs.prompt.style.height = Math.min(160, refs.prompt.scrollHeight) + 'px'; });
  return el('div', {class: 'ai-panel'},
    el('div', {class: 'assistant-head'}, el('span', {text: 'Model'}), refs.model, el('span', {class: 'context-chip'}, icon('file'), 'Sees the open file and last run')),
    refs.messages,
    el('div', {class: 'composer'}, el('div', {class: 'composer-box'}, refs.prompt, refs.send), el('div', {class: 'hint', text: 'The default 0.5B copilot is deliberately small: check what it tells you. It can\'t edit files or run code.'})));
}

async function loadModels() {
  try {
    const models = await api('/api/models');
    const preferred = store.get('dg-repo-model', null);
    refs.model.replaceChildren(...models.models.map(m => el('option', {value: m.name, text: `${m.name}${m.parameterSize ? ' · ' + m.parameterSize : ''}${m.name === smallModel ? ' (default)' : ''}`})));
    refs.model.value = models.models.some(m => m.name === preferred) ? preferred : models.models.some(m => m.name === smallModel) ? smallModel : models.models[0]?.name || '';
    if (!models.models.length) refs.model.append(el('option', {value: '', text: 'No models installed'}));
  } catch { refs.model.replaceChildren(el('option', {value: '', text: 'Ollama not running'})); }
}

function copilotNode(message) {
  if (message.role === 'user') return el('div', {class: 'msg user', text: message.content});
  if (message.role === 'error') return el('div', {class: 'msg error', text: message.content});
  return el('div', {class: 'msg assistant'}, el('div', {class: 'who'}, icon('spark'), message.model || 'Copilot'), el('div', {class: 'md'}, renderMarkdown(message.content, {language: languageOf(active?.path || '') || ''})));
}

function renderMessages(pending) {
  const nodes = chatHistory.map(copilotNode);
  if (!nodes.length && !pending) nodes.push(el('div', {class: 'assistant-empty'}, el('h3', {text: 'Practice copilot'}),
    el('p', {text: 'Run the tests, inspect the failure, then ask what to investigate. It sees the file open in the editor, the brief and your latest test output.'})));
  if (pending) nodes.push(el('div', {class: 'msg user', text: pending}), el('div', {class: 'msg assistant'}, el('div', {class: 'who'}, icon('spark'), refs.model.value || 'Copilot'), el('p', {}, el('span', {class: 'spinner', style: 'display:inline-block;vertical-align:middle;margin-right:8px'}), 'Thinking…')));
  refs.messages.replaceChildren(...nodes);
  refs.messages.scrollTop = refs.messages.scrollHeight;
}

async function sendCopilot() {
  const prompt = refs.prompt.value.trim();
  if (!prompt || !current || refs.send.disabled) return;
  refs.send.disabled = true;
  refs.prompt.value = '';
  refs.prompt.style.height = 'auto';
  renderMessages(prompt);
  try {
    if (!locked) await saveAll();
    const past = chatHistory.filter(m => m.role !== 'error').map(({role, content}) => ({role, content}));
    const answer = await api('/api/chat', {id: current.id, path: active?.path || '', prompt, history: past, output: lastOutput, model: refs.model.value});
    chatHistory.push({role: 'user', content: prompt}, {role: 'assistant', content: answer.content, model: answer.model});
  } catch (error) {
    chatHistory.push({role: 'user', content: prompt}, {role: 'error', content: error.message});
  } finally {
    refs.send.disabled = false;
    renderMessages();
  }
}

function setSide(name, focus = true) {
  sideTab = name;
  refs.briefTab.classList.toggle('active', name === 'brief');
  refs.copilotTab.classList.toggle('active', name === 'copilot');
  refs.sidePanel.replaceChildren(name === 'copilot' ? refs.copilot : refs.brief);
  if (name === 'copilot' && focus) refs.prompt.focus();
}

// ---------- start ----------
window.addEventListener('beforeunload', event => { if (tabs.some(dirty)) { event.preventDefault(); event.returnValue = ''; } });

async function init() {
  runtimes = await api('/api/runtimes');
  buildIde();
  initLobby();
  window.gym = {
    api, waitJob, enter, notify, el: legacyEl,
    save: saveAll,
    current: () => current,
    file: () => active?.path || '',
    isDirty: () => tabs.some(dirty),
    setLocked, openSession, closeIde
  };
  window.dispatchEvent(new Event('gym-ready'));
  await import('./interview-ui.js').catch(error => notify(error.message, 'error'));
  await Promise.all([status().catch(() => {}), renderChallenges().catch(error => notify(error.message, 'error')), loadModels()]);
  renderResume();
}
init().catch(error => notify(error.message, 'error'));
