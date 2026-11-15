// The AI-assisted development environment for code repos: the question and
// agent sessions on the left, the AI assistant in the middle, and Editor,
// Diff, Terminal and Tests panes on the right. Used for guided problems
// (timed, three phases, debrief and review) and for any repository.
import {el, api, waitJob, notify, clock, confirmDialog, store, icon, splitter, DIFFICULTY_CLASS, KIND_LABEL} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {loadMonaco, editorOptions, applySettings, setInlineSource, settings, monacoLanguage, themeName} from './monaco.js';
import {createAssistant} from './assistant-ui.js';
import {enterFullscreen} from './app.js';

const RUN_TIMEOUT = 30000;
const LANGUAGE_LABEL = {python: 'Python', javascript: 'JavaScript'};
let current = null;

export async function closeFullscreen() {
  if (!current) return;
  const instance = current;
  current = null;
  await instance.dispose();
}

export async function openAde(root, kind, id, {mock = null} = {}) {
  const key = `${kind}:${id}:${mock || ''}`;
  if (current?.key === key && !root.hidden) return;
  await closeFullscreen();
  enterFullscreen('ade');
  root.replaceChildren(el('div', {class: 'fs-loading'}, el('span', {class: 'spinner'}), 'Opening the workspace…'));
  const [monaco, data] = await Promise.all([loadMonaco(), kind === 'practice' ? api(`/api/practice?id=${id}`) : api(`/api/session?id=${id}`)]);
  if (kind === 'practice' && data.status === 'ended' && !mock) { location.replace(data.mock ? `#/mockreport/${data.mock}` : `#/feedback/${id}`); return; }
  current = createAde(root, {kind, id, data, monaco, mock, key});
  await current.ready;
}

function createAde(root, {kind, id, data, monaco, mock, key}) {
  const practice = kind === 'practice';
  const refs = {};
  const disposables = [];
  let session = data, skew = practice ? data.serverNow - Date.now() : 0;
  let files = data.files || [];
  let tabs = [], active = null, expanded = new Set(store.get(`dg-ade-expanded-${id}`, [])), filter = '';
  let rightTab = 'editor', leftTab = store.get('dg-ade-left', 'question'), mobilePane = 'assistant';
  let changes = [], diffEditor = null, diffModels = null, diffPath = null, diffInline = store.get('dg-diff-inline', false);
  const terminal = {log: [], history: store.get(`dg-term-history-${id}`, []), cursor: -1, running: false};
  const tests = {running: false, last: null, output: '', text: ''};
  const newFiles = new Set();
  let timer = null, autosave = null, ending = false, debriefDialog = null, interviewer = null, disposed = false;
  const live = () => !practice || (session.status === 'active' && session.deadline - (Date.now() + skew) > 0);
  const scope = () => ({scope: 'ws', kind, id});
  const event = body => practice ? api('/api/practice/event', {id, ...body}).catch(() => {}) : api('/api/ws/event', {kind, id, ...body}).catch(() => {});

  // ---------- layout ----------
  const title = practice ? session.title : session.title;
  refs.stepper = el('div', {class: 'stepper', role: 'list', 'aria-label': 'Phases'});
  refs.timer = el('div', {class: 'timer', role: 'timer'});
  refs.runTests = el('button', {class: 'button small', onclick: () => runTests()}, icon('play'), 'Run tests');
  refs.submit = el('button', {class: 'button primary small', onclick: () => mock ? interviewer?.end() : submitSession()}, mock ? 'End interview' : 'Submit');
  const chips = practice
    ? [el('span', {class: `difficulty ${DIFFICULTY_CLASS[session.difficulty]}`, text: session.difficulty}), el('span', {class: 'chip', text: LANGUAGE_LABEL[session.language]})]
    : [el('span', {class: 'chip', text: session.benchmark ? 'Real-world issue' : session.challenge ? 'Incident' : 'GitHub repo'}), session.runtime ? el('span', {class: 'chip', text: session.runtime}) : null];
  const top = el('header', {class: 'fs-top ade-top'},
    el('button', {class: 'icon-button', title: 'Leave the workspace', 'aria-label': 'Leave the workspace', onclick: leave}, icon('back')),
    el('div', {class: 'fs-title'}, el('strong', {text: title}), ...chips),
    practice ? refs.stepper : null,
    el('span', {class: 'grow'}),
    refs.timer, refs.runTests, practice || mock ? refs.submit : null);

  // Left rail and drawer.
  const railButton = (name, iconName, label) => el('button', {class: 'rail-button', 'data-left': name, title: label, 'aria-label': label, onclick: () => setLeft(leftTab === name ? null : name)}, icon(iconName), el('span', {text: label}));
  refs.rail = el('nav', {class: 'ade-rail', 'aria-label': 'Panels'},
    railButton('question', 'book', practice ? 'Question' : 'Brief'),
    railButton('sessions', 'history', 'Sessions'),
    mock ? railButton('interviewer', 'user', 'Interviewer') : null);
  refs.drawerTitle = el('strong');
  refs.drawerBody = el('div', {class: 'drawer-body'});
  refs.drawer = el('aside', {class: 'ade-drawer'}, el('div', {class: 'pane-header'}, refs.drawerTitle, el('span', {class: 'grow'}), el('button', {class: 'icon-button', 'aria-label': 'Close panel', onclick: () => setLeft(null)}, '×')), refs.drawerBody);

  // Assistant in the middle.
  const assistant = createAssistant({
    variant: 'ade', modes: ['ask', 'plan', 'agent'], scope,
    context: () => ({openFile: active?.path || null, language: practice ? session.language : session.runtime}),
    files: async () => files,
    suggestions: practice
      ? ['Give me a tour of this codebase', 'What do the phase 1 tests check?', 'Plan the fix for phase 1', 'Why is this test failing? @']
      : ['Give me a tour of this codebase', 'Where is the code related to the brief?', 'Plan a fix for the issue in the brief', 'Which tests cover this area?'],
    hooks: {
      beforeSend: () => saveAll().catch(() => {}),
      onFilesChanged: () => refreshFiles(),
      openDiff: path => { setRight('diff'); openDiff(path); },
      runClientTool: tool => tool === 'run_tests' ? runTests({forAgent: true}) : 'Unsupported tool.',
      terminalText: () => terminal.log.length ? terminal.log.slice(-3).map(e => `$ ${e.command}\n${e.output}`).join('\n') : '',
      testsText: () => tests.text,
      selection: () => {
        if (!active || !refs.editor) return null;
        const selection = refs.editor.getSelection();
        const text = selection && !selection.isEmpty() ? refs.editor.getModel().getValueInRange(selection) : '';
        return text ? {path: active.path, text} : null;
      },
      openFile: () => active?.path || null,
      showSessions: () => setLeft('sessions'),
      onSessionsChanged: () => { if (leftTab === 'sessions') renderDrawer(); },
      onSessionChange: () => { if (leftTab === 'sessions') renderDrawer(); },
      onToolOutput: ev => { if (ev.name === 'run_tests') testsChanged = true; },
      onTurnEnd: () => afterAgentTurn(),
      onCopy: code => event({type: 'copy', chars: code.length})
    }
  });
  let testsChanged = false;
  refs.center = el('section', {class: 'ade-center', 'aria-label': 'AI assistant'}, assistant.root);

  // Right panes.
  const paneTab = (name, iconName, label) => el('button', {class: 'tab', 'data-pane': name, onclick: () => setRight(name)}, icon(iconName), label, el('span', {class: 'tab-badge', hidden: true}));
  refs.paneTabs = el('div', {class: 'tabs pane-tabs', role: 'tablist'}, paneTab('editor', 'code', 'Editor'), paneTab('diff', 'diff', 'Diff'), paneTab('terminal', 'terminal', 'Terminal'), paneTab('tests', 'check', 'Tests'));
  refs.editorPane = buildEditorPane();
  refs.diffPane = buildDiffPane();
  refs.terminalPane = buildTerminalPane();
  refs.testsPane = buildTestsPane();
  refs.right = el('section', {class: 'ade-right'}, refs.paneTabs, el('div', {class: 'pane-stack'}, refs.editorPane, refs.diffPane, refs.terminalPane, refs.testsPane));

  const drawerSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  const rightSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  refs.mobileBar = el('nav', {class: 'ade-mobile-bar', 'aria-label': 'Workspace views'},
    ['question', 'assistant', 'code'].map(name => el('button', {'data-mobile': name, onclick: () => setMobile(name)}, icon(name === 'question' ? 'book' : name === 'assistant' ? 'spark' : 'code'), name === 'question' ? (practice ? 'Question' : 'Brief') : name === 'assistant' ? 'Assistant' : 'Code')));
  refs.main = el('div', {class: 'ade-main'}, refs.rail, refs.drawer, drawerSplit, refs.center, rightSplit, refs.right);
  root.replaceChildren(top, refs.main, refs.mobileBar);
  const sizes = store.get('dg-ade-sizes', {});
  for (const [name, value] of Object.entries(sizes)) refs.main.style.setProperty(name, value + 'px');
  splitter(refs.main, drawerSplit, '--ade-drawer', x => x - refs.drawer.getBoundingClientRect().left, 240, 640, 'dg-ade-sizes');
  splitter(refs.main, rightSplit, '--ade-right', x => refs.main.getBoundingClientRect().right - x, 360, 1400, 'dg-ade-sizes');

  // ---------- editor pane ----------
  function buildEditorPane() {
    refs.treeFilter = el('input', {class: 'tree-filter', type: 'search', placeholder: 'Find a file', 'aria-label': 'Find a file'});
    refs.treeFilter.addEventListener('input', () => { filter = refs.treeFilter.value.trim().toLowerCase(); renderTree(); });
    refs.tree = el('div', {class: 'file-tree', role: 'tree'});
    refs.treeCount = el('div', {class: 'tree-count muted small'});
    refs.explorer = el('aside', {class: 'ade-explorer', 'aria-label': 'Files'},
      el('div', {class: 'pane-header'}, el('span', {text: 'Files'}), el('span', {class: 'grow'}),
        el('button', {class: 'icon-button', title: 'New file', 'aria-label': 'New file', onclick: newFile}, icon('plus')),
        el('button', {class: 'icon-button', title: 'Refresh', 'aria-label': 'Refresh files', onclick: () => refreshFiles()}, icon('refresh'))),
      el('div', {class: 'tree-tools'}, refs.treeFilter), refs.treeCount, refs.tree,
      practice ? el('div', {class: 'explorer-foot'}, icon('lock'), ' Provided tests are read-only') : null);
    refs.fileTabs = el('div', {class: 'file-tabs', role: 'tablist'});
    refs.cursor = el('span', {class: 'muted small'});
    refs.saveState = el('span', {class: 'muted small'});
    refs.editorHost = el('div', {class: 'monaco-host'});
    refs.editorEmpty = el('div', {class: 'editor-empty muted', text: 'Open a file from the tree.'});
    const explorerToggle = el('button', {class: 'icon-button', title: 'Toggle the file tree', 'aria-label': 'Toggle the file tree', onclick: () => { refs.editorPaneMain.classList.toggle('tree-hidden'); store.set('dg-ade-tree-hidden', refs.editorPaneMain.classList.contains('tree-hidden')); }}, icon('panel'));
    const bar = el('div', {class: 'editor-bar'}, explorerToggle, refs.fileTabs, el('span', {class: 'grow'}), refs.saveState, refs.cursor,
      el('button', {class: 'icon-button', title: 'Editor settings', 'aria-label': 'Editor settings', onclick: e => editorSettings(e.currentTarget)}, icon('gear')));
    const editorSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
    refs.editorPaneMain = el('div', {class: `editor-split${store.get('dg-ade-tree-hidden', false) ? ' tree-hidden' : ''}`}, refs.explorer, editorSplit, el('div', {class: 'editor-col'}, bar, refs.editorHost, refs.editorEmpty));
    const pane = el('div', {class: 'pane', 'data-pane': 'editor'}, refs.editorPaneMain);
    splitter(refs.editorPaneMain, editorSplit, '--tree-w', x => x - refs.explorer.getBoundingClientRect().left, 150, 480, 'dg-ade-sizes');
    return pane;
  }

  // ---------- diff pane ----------
  function buildDiffPane() {
    refs.changeList = el('div', {class: 'change-list'});
    refs.diffHost = el('div', {class: 'monaco-host'});
    refs.diffTitle = el('span', {class: 'muted small'});
    const inline = el('button', {class: 'button ghost small', onclick: () => { diffInline = !diffInline; store.set('dg-diff-inline', diffInline); diffEditor?.updateOptions({renderSideBySide: !diffInline}); inline.textContent = diffInline ? 'Side by side' : 'Inline'; }}, diffInline ? 'Side by side' : 'Inline');
    return el('div', {class: 'pane', 'data-pane': 'diff'},
      el('div', {class: 'diff-layout'},
        el('aside', {class: 'change-side'}, el('div', {class: 'pane-header'}, el('span', {text: 'Changed files'}), el('span', {class: 'grow'}), el('button', {class: 'icon-button', title: 'Refresh', 'aria-label': 'Refresh changes', onclick: () => loadChanges()}, icon('refresh'))), refs.changeList),
        el('div', {class: 'editor-col'}, el('div', {class: 'editor-bar'}, refs.diffTitle, el('span', {class: 'grow'}), inline), refs.diffHost)));
  }

  // ---------- terminal pane ----------
  function buildTerminalPane() {
    refs.termLog = el('div', {class: 'term-log', role: 'log', 'aria-live': 'polite'});
    refs.termInput = el('input', {class: 'term-input', placeholder: practice ? (session.language === 'python' ? 'python -m unittest discover -s tests' : 'node --test tests/') : session.benchmark ? 'git status' : 'ls -la', 'aria-label': 'Terminal command', spellcheck: 'false', autocomplete: 'off'});
    refs.termInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); runCommand(refs.termInput.value); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (terminal.history.length) { terminal.cursor = Math.min(terminal.history.length - 1, terminal.cursor + 1); refs.termInput.value = terminal.history[terminal.history.length - 1 - terminal.cursor]; } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); terminal.cursor = Math.max(-1, terminal.cursor - 1); refs.termInput.value = terminal.cursor < 0 ? '' : terminal.history[terminal.history.length - 1 - terminal.cursor]; }
    });
    refs.termStatus = el('span', {class: 'muted small'});
    return el('div', {class: 'pane', 'data-pane': 'terminal'},
      el('div', {class: 'terminal'},
        el('div', {class: 'editor-bar'}, el('span', {class: 'muted small', text: session.benchmark ? 'Runs in the project\'s environment at /testbed. Changes made by commands are not kept.' : 'Runs in a disposable sandbox copy with no network. Changes made by commands are not kept.'}), el('span', {class: 'grow'}), refs.termStatus,
          el('button', {class: 'button ghost small', onclick: () => { terminal.log = []; renderTerminal(); }}, 'Clear')),
        refs.termLog,
        el('div', {class: 'term-prompt'}, el('span', {class: 'prompt', text: '$'}), refs.termInput)));
  }

  // ---------- tests pane ----------
  function buildTestsPane() {
    refs.testsBody = el('div', {class: 'tests-body'});
    refs.testsRun = el('button', {class: 'button primary small', onclick: () => runTests()}, icon('play'), 'Run tests');
    refs.testsStatus = el('span', {class: 'muted small'});
    refs.envRow = practice ? null : buildEnvRow();
    return el('div', {class: 'pane', 'data-pane': 'tests'},
      el('div', {class: 'tests'},
        el('div', {class: 'editor-bar'}, refs.testsRun, refs.testsStatus, el('span', {class: 'grow'}), practice ? el('span', {class: 'muted small', text: session.language === 'python' ? 'Python 3.12 in Docker' : 'Node.js test runner in your browser'}) : null),
        refs.envRow, refs.testsBody));
  }
  function buildEnvRow() {
    const runtimeSelect = el('select', {'aria-label': 'Runtime'});
    const command = el('input', {placeholder: 'Test command', 'aria-label': 'Test command', value: session.testCommand || ''});
    const image = el('input', {placeholder: 'Docker image (optional)', 'aria-label': 'Docker image', value: session.testImage || ''});
    api('/api/runtimes').then(runtimes => {
      runtimeSelect.replaceChildren(...Object.entries(runtimes).map(([value, r]) => el('option', {value, text: r.label})));
      runtimeSelect.value = session.runtime || 'node';
      if (!command.value) command.placeholder = runtimes[runtimeSelect.value]?.command || 'Test command';
      if (!image.value) image.placeholder = runtimes[runtimeSelect.value]?.image || 'Docker image';
      runtimeSelect.onchange = () => { command.placeholder = runtimes[runtimeSelect.value]?.command; image.placeholder = runtimes[runtimeSelect.value]?.image; };
    }).catch(() => {});
    const save = el('button', {class: 'button small', onclick: async () => {
      try { session = {...session, ...await api('/api/repo/settings', {id, runtime: runtimeSelect.value, command: command.value, image: image.value})}; notify('Test settings saved. The agent uses them too.', 'success'); }
      catch (error) { notify(error.message, 'error'); }
    }}, 'Save');
    const prepare = el('button', {class: 'button ghost small', onclick: async () => {
      prepare.disabled = true;
      try { const r = await waitJob(await api('/api/prepare', {id}), text => { refs.testsStatus.textContent = text; }); refs.testsStatus.textContent = `${r.image} is ready.`; }
      catch (error) { notify(error.message, 'error'); refs.testsStatus.textContent = ''; }
      finally { prepare.disabled = false; }
    }}, 'Download environment');
    if (session.benchmark) return el('div', {class: 'env-row muted small'}, el('span', {text: `Runs the task's regression tests in ${session.image}.`}), el('span', {class: 'grow'}), prepare);
    return el('div', {class: 'env-row'}, runtimeSelect, command, image, save, prepare);
  }

  // ---------- Monaco ----------
  refs.editor = monaco.editor.create(refs.editorHost, editorOptions({model: null}));
  disposables.push(refs.editor);
  refs.editor.onDidChangeCursorPosition(e => { refs.cursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`; });
  refs.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveActive(true));
  refs.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runTests());
  refs.editor.onDidPaste(e => { if (!active || active.readonly) return; const text = active.model.getValueInRange(e.range); if (text) event({type: 'paste', path: active.path, text}); });
  const onSettings = () => { applySettings(refs.editor); diffEditor?.updateOptions({fontSize: settings.get().fontSize}); };
  window.addEventListener('dg-editor-settings', onSettings);

  const uriFor = path => monaco.Uri.from({scheme: 'dgws', path: `/${id}/${path}`});
  const isDirty = tab => tab && !tab.readonly && tab.model.getAlternativeVersionId() !== tab.savedVersion;
  const isReadonly = path => (practice && session.readonly.includes(path)) || !live();

  async function openFile(path, {line} = {}) {
    let tab = tabs.find(t => t.path === path);
    if (!tab) {
      const file = await api(`/api/ws/file?kind=${kind}&id=${id}&path=${encodeURIComponent(path)}`);
      let model = monaco.editor.getModel(uriFor(path));
      if (model) model.setValue(file.content); else model = monaco.editor.createModel(file.content, monacoLanguage(path), uriFor(path));
      model.updateOptions({tabSize: settings.get().tabSize});
      tab = {path, model, savedVersion: model.getAlternativeVersionId(), readonly: file.readonly || isReadonly(path), view: null};
      model.onDidChangeContent(() => { renderTabs(); });
      setInlineSource(model, ({prefix, suffix, signal}) => fetch('/api/assistant/complete', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prefix, suffix, path}), signal}).then(r => r.json()).then(r => r.completion || ''));
      tabs.push(tab);
      event({type: 'open', path});
    }
    if (active && active !== tab) active.view = refs.editor.saveViewState();
    active = tab;
    newFiles.delete(path);
    refs.editor.setModel(tab.model);
    refs.editor.updateOptions({readOnly: tab.readonly});
    if (tab.view) refs.editor.restoreViewState(tab.view);
    if (line) { refs.editor.revealLineInCenter(line); refs.editor.setPosition({lineNumber: line, column: 1}); }
    refs.editorEmpty.hidden = true;
    refs.editorHost.hidden = false;
    // Reveal the file in the tree.
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
    renderTabs(); renderTree();
    setRight('editor');
    if (!tab.readonly) refs.editor.focus();
  }
  async function closeTab(tab) {
    if (isDirty(tab)) await saveTab(tab).catch(error => notify(error.message, 'error'));
    const index = tabs.indexOf(tab);
    tabs.splice(index, 1);
    setInlineSource(tab.model, null);
    tab.model.dispose();
    if (active === tab) {
      active = null;
      const next = tabs[index] || tabs[index - 1];
      if (next) await openFile(next.path);
      else { refs.editor.setModel(null); refs.editorHost.hidden = true; refs.editorEmpty.hidden = false; renderTabs(); renderTree(); }
    } else renderTabs();
  }
  async function saveTab(tab) {
    if (!isDirty(tab) || !live()) return;
    const version = tab.model.getAlternativeVersionId();
    await api('/api/ws/file', {kind, id, path: tab.path, content: tab.model.getValue()});
    tab.savedVersion = version;
    renderTabs();
  }
  async function saveActive(explicit) {
    try { await saveTab(active); if (explicit) refs.saveState.textContent = 'Saved'; }
    catch (error) { notify(error.message, 'error'); }
  }
  async function saveAll() { for (const tab of tabs) if (isDirty(tab)) await saveTab(tab); }
  function renderTabs() {
    refs.fileTabs.replaceChildren(...tabs.map(tab => el('button', {class: `file-tab${tab === active ? ' active' : ''}`, role: 'tab', 'aria-selected': String(tab === active), title: tab.path, onclick: e => { if (!e.target.closest('.close')) openFile(tab.path); }, onauxclick: e => { if (e.button === 1) closeTab(tab); }},
      tab.readonly ? icon('lock', 'icon') : null, tab.path.split('/').pop(),
      isDirty(tab) ? el('span', {class: 'dirty', title: 'Unsaved changes'}) : null,
      el('span', {class: 'close', role: 'button', 'aria-label': `Close ${tab.path}`, onclick: () => closeTab(tab)}, '×'))));
    refs.saveState.textContent = !active ? '' : active.readonly ? 'Read-only' : isDirty(active) ? 'Unsaved' : 'Saved';
  }
  function editorSettings(anchor) {
    document.querySelector('.menu.floating')?.remove();
    const s = settings.get();
    const select = (label, k, options) => el('label', {class: 'setting-row'}, el('span', {text: label}), el('select', {onchange: e => settings.set({[k]: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)})}, options.map(([value, text]) => el('option', {value, text, selected: String(s[k]) === String(value)}))));
    const check = (label, k) => el('label', {class: 'setting-row'}, el('span', {text: label}), el('input', {type: 'checkbox', checked: !!s[k], onchange: e => settings.set({[k]: e.target.checked})}));
    const menu = el('div', {class: 'menu floating settings-menu', role: 'dialog', 'aria-label': 'Editor settings'}, el('div', {class: 'menu-label', text: 'Editor settings'}),
      select('Theme', 'theme', [['auto', 'Match the app'], ['light', 'Light'], ['dark', 'Dark'], ['high-contrast', 'High contrast']]),
      select('Font size', 'fontSize', [[12, '12 px'], [13, '13 px'], [14, '14 px'], [16, '16 px'], [18, '18 px']]),
      select('Tab spaces', 'tabSize', [[2, '2'], [4, '4'], [8, '8']]),
      select('Word wrap', 'wordWrap', [['off', 'Off'], ['on', 'On']]),
      check('Autocomplete', 'autocomplete'), check('AI inline suggestions', 'inlineSuggestions'), check('Minimap', 'minimap'));
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
    setTimeout(() => document.addEventListener('pointerdown', function away(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', away); } }), 0);
  }

  // ---------- file tree ----------
  function renderTree() {
    const rows = [];
    if (filter) {
      const matches = files.filter(f => f.toLowerCase().includes(filter)).slice(0, 300);
      for (const path of matches) rows.push(fileRow(path, path, 0));
      refs.treeCount.textContent = `${matches.length}${matches.length === 300 ? '+' : ''} matching files`;
    } else {
      const tree = {};
      for (const name of files) {
        let node = tree;
        const parts = name.split('/');
        parts.forEach((part, i) => { if (i === parts.length - 1) node[part] = name; else node = node[part + '/'] ||= {}; });
      }
      const walk = (node, depth, prefix) => {
        const entries = Object.keys(node).sort((a, b) => (b.endsWith('/') - a.endsWith('/')) || a.localeCompare(b));
        for (const key of entries) {
          if (rows.length > 3000) return;
          if (key.endsWith('/')) {
            const folder = prefix + key.slice(0, -1);
            const open = expanded.has(folder);
            rows.push(el('button', {class: `tree-row folder${open ? ' open' : ''}`, style: `padding-left:${8 + depth * 14}px`, role: 'treeitem', 'aria-expanded': String(open), onclick: () => { open ? expanded.delete(folder) : expanded.add(folder); store.set(`dg-ade-expanded-${id}`, [...expanded].slice(-200)); renderTree(); }},
              icon('chevron', 'icon chev'), icon('folder'), el('span', {class: 'tree-label', text: key.slice(0, -1)})));
            if (open) walk(node[key], depth + 1, folder + '/');
          } else rows.push(fileRow(node[key], key, depth));
        }
      };
      walk(tree, 0, '');
      refs.treeCount.textContent = `${files.length} file${files.length === 1 ? '' : 's'}`;
    }
    refs.tree.replaceChildren(...rows);
  }
  function fileRow(path, label, depth) {
    const readonly = practice && session.readonly.includes(path);
    const changed = changes.find(c => c.path === path);
    return el('div', {class: `tree-row file${active?.path === path ? ' active' : ''}`, style: `padding-left:${22 + depth * 14}px`, role: 'treeitem', title: path, tabindex: '0',
      onclick: () => openFile(path).catch(error => notify(error.message, 'error')), onkeydown: e => { if (e.key === 'Enter') openFile(path); }},
      icon('file'), el('span', {class: 'tree-label', text: label}),
      newFiles.has(path) ? el('span', {class: 'new-badge', text: 'NEW'}) : null,
      changed ? el('span', {class: `change-mark ${changed.status}`, text: changed.status === 'added' ? 'A' : changed.status === 'deleted' ? 'D' : 'M', title: changed.status}) : null,
      readonly ? icon('lock', 'icon lock') : live() ? el('button', {class: 'tree-action', title: `Delete ${path}`, 'aria-label': `Delete ${path}`, onclick: e => { e.stopPropagation(); deleteFile(path); }}, icon('trash')) : null);
  }
  async function refreshFiles() {
    try {
      const result = await api(`/api/ws/files?kind=${kind}&id=${id}`);
      const before = new Set(files);
      files = result.files;
      for (const f of files) if (!before.has(f) && before.size) newFiles.add(f);
      // Reload open tabs the assistant changed, unless they have unsaved edits.
      for (const tab of [...tabs]) {
        if (!files.includes(tab.path)) { await closeTab(tab); continue; }
        if (isDirty(tab)) continue;
        const file = await api(`/api/ws/file?kind=${kind}&id=${id}&path=${encodeURIComponent(tab.path)}`).catch(() => null);
        if (file && file.content !== tab.model.getValue()) {
          tab.model.pushEditOperations([], [{range: tab.model.getFullModelRange(), text: file.content}], () => null);
          tab.savedVersion = tab.model.getAlternativeVersionId();
        }
      }
      await loadChanges();
      renderTabs();
      renderTree();
    } catch (error) { notify(error.message, 'error'); }
  }
  async function newFile() {
    if (!live()) return;
    const suggestion = practice ? (session.language === 'python' ? 'tests/test_custom.py' : 'tests/custom.test.js') : '';
    const input = el('input', {value: suggestion, maxlength: 300, 'aria-label': 'File path', placeholder: 'src/new_file.py'});
    const finish = async create => {
      dialog.close(); dialog.remove();
      const name = input.value.trim();
      if (!create || !name) return;
      const template = practice && /test/.test(name) ? (session.language === 'python'
        ? 'import unittest\n\n\nclass CustomTests(unittest.TestCase):\n    def test_example(self):\n        self.assertTrue(True)\n'
        : "const { test } = require('node:test');\nconst assert = require('node:assert/strict');\n\ntest('example', () => {\n  assert.equal(1 + 1, 2);\n});\n") : '';
      try {
        const result = await api('/api/ws/file/create', {kind, id, path: name, content: template});
        files = result.files;
        renderTree();
        await openFile(name);
        loadChanges();
      } catch (error) { notify(error.message, 'error'); }
    };
    const dialog = el('dialog', {class: 'dialog small'}, el('form', {onsubmit: e => { e.preventDefault(); finish(true); }},
      el('h2', {text: 'New file'}), el('p', {text: 'Use a path relative to the repository root.'}), input,
      el('div', {class: 'dialog-actions'}, el('button', {class: 'button ghost', type: 'button', onclick: () => finish(false)}, 'Cancel'), el('button', {class: 'button primary', type: 'submit'}, 'Create'))));
    document.body.append(dialog);
    dialog.showModal();
    input.select();
  }
  async function deleteFile(path) {
    const ok = await confirmDialog({title: `Delete ${path}?`, body: 'The file is removed from the workspace. The Diff view shows it as deleted.', confirm: 'Delete', danger: true});
    if (!ok) return;
    try {
      const result = await api('/api/ws/file/delete', {kind, id, path});
      files = result.files;
      const tab = tabs.find(t => t.path === path);
      if (tab) { tab.savedVersion = tab.model.getAlternativeVersionId(); await closeTab(tab); }
      renderTree();
      loadChanges();
    } catch (error) { notify(error.message, 'error'); }
  }

  // ---------- diff ----------
  async function loadChanges() {
    try { changes = await api(`/api/ws/changes?kind=${kind}&id=${id}`); }
    catch { changes = []; }
    const badge = refs.paneTabs.querySelector('[data-pane="diff"] .tab-badge');
    badge.hidden = !changes.length;
    badge.textContent = String(changes.length);
    refs.changeList.replaceChildren(...(changes.length ? changes.map(c => el('button', {class: `change-row${c.path === diffPath ? ' active' : ''}`, title: c.path, onclick: () => openDiff(c.path)},
      el('span', {class: `change-mark ${c.status}`, text: c.status === 'added' ? 'A' : c.status === 'deleted' ? 'D' : 'M'}), el('span', {class: 'change-name', text: c.path.split('/').pop()}), el('span', {class: 'change-dir muted small', text: c.path.includes('/') ? c.path.slice(0, c.path.lastIndexOf('/')) : ''})))
      : [el('p', {class: 'muted small pad', text: 'No changes yet. Edits you or the agent make show up here.'})]));
    if (rightTab === 'diff' && !diffPath && changes[0]) openDiff(changes[0].path);
    if (!filter) renderTree();
  }
  async function openDiff(path) {
    diffPath = path;
    try {
      const diff = await api(`/api/ws/diff?kind=${kind}&id=${id}&path=${encodeURIComponent(path)}`);
      if (!diffEditor) {
        diffEditor = monaco.editor.createDiffEditor(refs.diffHost, {...editorOptions(), readOnly: true, originalEditable: false, renderSideBySide: !diffInline, automaticLayout: true, enableSplitViewResizing: true, renderOverviewRuler: false});
        disposables.push(diffEditor);
      }
      const language = monacoLanguage(path);
      const original = monaco.editor.createModel(diff.before ?? '', language);
      const modified = monaco.editor.createModel(diff.after ?? '', language);
      diffEditor.setModel({original, modified});
      if (diffModels) { diffModels.original.dispose(); diffModels.modified.dispose(); }
      diffModels = {original, modified};
      refs.diffTitle.textContent = `${path}${diff.before === null ? ' (new file)' : diff.after === null ? ' (deleted)' : ''}`;
      for (const row of refs.changeList.querySelectorAll('.change-row')) row.classList.toggle('active', row.title === path);
    } catch (error) { notify(error.message, 'error'); }
  }

  // ---------- terminal ----------
  async function runCommand(command) {
    command = command.trim();
    if (!command || terminal.running) return;
    if (!live()) { notify('This session has ended.', 'error'); return; }
    await saveAll().catch(() => {});
    terminal.history = [...terminal.history.filter(c => c !== command), command].slice(-50);
    store.set(`dg-term-history-${id}`, terminal.history);
    terminal.cursor = -1;
    refs.termInput.value = '';
    terminal.running = true;
    const entry = {command, output: '', code: null, running: true};
    terminal.log.push(entry);
    renderTerminal();
    try {
      const result = await waitJob(await api('/api/ws/terminal', {kind, id, command}), text => { refs.termStatus.textContent = text; });
      entry.output = result.output;
      entry.code = result.code;
      entry.ms = result.ms;
    } catch (error) { entry.output = error.message; entry.code = -1; }
    entry.running = false;
    terminal.running = false;
    refs.termStatus.textContent = '';
    renderTerminal();
    refs.termInput.focus();
  }
  function renderTerminal() {
    refs.termLog.replaceChildren(...(terminal.log.length ? terminal.log.map(e => el('div', {class: 'term-entry'},
      el('div', {class: 'term-command'}, el('span', {class: 'prompt', text: '$ '}), e.command),
      e.running ? el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Running…') : el('pre', {class: `term-output${e.code ? ' failed' : ''}`, text: e.output || '(no output)'}),
      !e.running ? el('div', {class: `term-exit ${e.code === 0 ? 'ok' : 'bad'}`, text: `exit ${e.code}${e.ms ? ` · ${(e.ms / 1000).toFixed(1)} s` : ''}`}) : null))
      : [el('p', {class: 'muted small pad', text: 'Run shell commands against a copy of the workspace: list files, run a script, run one test. Press ↑ for history.'})]));
    refs.termLog.scrollTop = refs.termLog.scrollHeight;
  }

  // ---------- tests ----------
  async function runTests({forAgent = false} = {}) {
    if (tests.running) return forAgent ? 'A test run is already in progress.' : undefined;
    if (!live()) { notify('This session has ended.', 'error'); return forAgent ? 'The session has ended.' : undefined; }
    tests.running = true;
    setRight('tests');
    refs.testsRun.disabled = refs.runTests.disabled = true;
    refs.testsStatus.textContent = 'Running…';
    renderTestResults();
    let text = '';
    try {
      await saveAll();
      if (practice) {
        let result;
        if (session.language === 'javascript') {
          const run = await runInBrowser();
          const recorded = await api('/api/practice/result', {id, target: 'tests', results: run.results, output: run.output.slice(-3000), exitCode: run.exitCode, ms: run.ms, timedOut: run.timedOut});
          result = {...run, ...recorded};
        } else {
          result = await waitJob(await api('/api/practice/run', {id, target: 'tests'}), message => { refs.testsStatus.textContent = message; });
        }
        tests.last = result;
        tests.output = result.output || '';
        text = practiceText(result);
        applyPractice(result.practice);
        for (const phase of result.newlyPassed || []) phasePassed(phase);
      } else {
        const result = await waitJob(await api('/api/run', {id}), message => { refs.testsStatus.textContent = message; });
        tests.last = result;
        tests.output = result.output || '';
        text = `Exit code: ${result.code}${result.timedOut ? ' (timed out)' : ''}\n${tests.output.slice(-8000)}`;
      }
      tests.text = text;
    } catch (error) {
      tests.last = {error: error.message};
      text = tests.text = `The tests could not run: ${error.message}`;
      if (!forAgent) notify(error.message, 'error');
    } finally {
      tests.running = false;
      refs.testsRun.disabled = refs.runTests.disabled = false;
      refs.testsStatus.textContent = '';
      renderTestResults();
    }
    return text;
  }
  function practiceText(result) {
    const rows = result.results || [];
    const lines = rows.map(r => `${r.status === 'pass' ? 'PASS' : r.status === 'skip' ? 'SKIP' : 'FAIL'}  ${r.file} › ${r.name}${r.message ? `\n      ${String(r.message).split('\n')[0]}` : ''}`);
    const counted = rows.filter(r => r.status !== 'skip');
    return `${lines.join('\n')}\n\n${counted.filter(r => r.status === 'pass').length}/${counted.length} tests passed${result.timedOut ? ' (the run timed out)' : ''}${result.output ? `\n\nOutput:\n${result.output.slice(-2000)}` : ''}`;
  }
  function runInBrowser() {
    return new Promise(async (resolve, reject) => {
      let bundle;
      try { bundle = await api('/api/practice/bundle?id=' + id); } catch (error) { reject(error); return; }
      const worker = new Worker('/runner-worker.js', {type: 'module'});
      const results = [];
      let output = '';
      const started = performance.now();
      let finished = false;
      const finish = done => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        worker.terminate();
        if (done.timedOut) {
          results.push({file: results.at(-1)?.file || bundle.tests[0], name: 'Run stopped after 30 seconds', status: 'error', ms: RUN_TIMEOUT, message: 'A test is taking too long or looping forever. Tests after this point did not run.'});
          output += '\n[Stopped: the run exceeded 30 seconds]\n';
        }
        resolve({target: 'tests', tests: bundle.tests, results, output, exitCode: done.exitCode ?? (results.some(r => r.status === 'fail' || r.status === 'error') ? 1 : 0), ms: Math.round(performance.now() - started), timedOut: !!done.timedOut});
      };
      const timeout = setTimeout(() => finish({timedOut: true}), RUN_TIMEOUT);
      worker.onmessage = ({data: message}) => {
        if (message.type === 'log') output += message.text;
        else if (message.type === 'test') results.push(message);
        else if (message.type === 'done') finish(message);
      };
      worker.onerror = error => { error.preventDefault?.(); output += `Runner error: ${error.message || 'the worker failed to start'}\n`; finish({exitCode: 1}); };
      worker.postMessage({files: bundle.files, mode: 'tests', testFiles: bundle.tests, main: bundle.main});
    });
  }
  function phaseOfFile(file) {
    for (let n = 1; n <= 3; n++) if (file === (session.language === 'python' ? `tests/test_phase${n}.py` : `tests/phase${n}.test.js`)) return n;
    return null;
  }
  function renderTestResults() {
    const badge = refs.paneTabs.querySelector('[data-pane="tests"] .tab-badge');
    if (tests.running) { refs.testsBody.replaceChildren(el('div', {class: 'progress-line pad'}, el('span', {class: 'spinner'}), 'Running the tests…')); return; }
    const last = tests.last;
    if (!last) {
      const summary = practice ? session.lastRun : null;
      refs.testsBody.replaceChildren(el('p', {class: 'muted small pad', text: summary?.phases ? `Last recorded run: ${Object.entries(summary.phases).map(([n, p]) => `phase ${n} ${p.passed}/${p.total}`).join(' · ')}. Run the tests again to see details.` : 'Run the tests to see results. Ctrl+Enter in the editor runs them too.'}));
      badge.hidden = true;
      return;
    }
    if (last.error) { refs.testsBody.replaceChildren(el('div', {class: 'result-banner bad'}, el('strong', {text: 'The tests could not run'}), el('p', {text: last.error}))); return; }
    if (!practice) {
      badge.hidden = false;
      badge.textContent = last.code === 0 ? '✓' : '✗';
      badge.className = `tab-badge ${last.code === 0 ? 'good' : 'bad'}`;
      refs.testsBody.replaceChildren(
        el('div', {class: `result-banner ${last.code === 0 ? 'ok' : 'bad'}`}, el('strong', {text: last.code === 0 ? (last.benchmark ? 'The regression tests passed' : 'Tests passed') : last.timedOut ? 'The run timed out' : `Tests failed (exit ${last.code})`}),
          last.benchmark && session.expectedFailures?.length ? el('p', {text: `Tests that must pass after the fix: ${session.expectedFailures.slice(0, 6).join(', ')}${session.expectedFailures.length > 6 ? '…' : ''}`}) : null),
        el('pre', {class: 'io-block', text: tests.output || '(no output)'}));
      return;
    }
    const results = last.results || [];
    const counted = results.filter(r => r.status !== 'skip');
    const passed = counted.filter(r => r.status === 'pass').length;
    badge.hidden = false;
    badge.textContent = `${passed}/${counted.length}`;
    badge.className = `tab-badge ${counted.length && passed === counted.length ? 'good' : 'bad'}`;
    const order = [...(last.tests || []), ...new Set(results.map(r => r.file))].filter((f, i, all) => all.indexOf(f) === i);
    const groups = order.map(file => {
      const rows = results.filter(r => r.file === file);
      const phase = phaseOfFile(file);
      const total = rows.filter(r => r.status !== 'skip').length, ok = rows.filter(r => r.status === 'pass').length;
      const details = el('details', {class: 'test-group', open: total !== ok},
        el('summary', {}, icon('chevron', 'icon chev'), phase ? `Phase ${phase}` : 'Your tests', el('span', {class: 'muted small', text: file}), el('span', {class: `meta ${ok === total ? 'good' : 'bad'}`, text: `${ok}/${total} passed`})));
      for (const row of rows) {
        const line = el('div', {class: `test-row ${row.status}`}, icon(row.status === 'pass' ? 'check' : row.status === 'skip' ? 'chevron' : 'cross'), el('span', {text: row.name}), el('span', {class: 'ms', text: row.ms ? `${row.ms} ms` : ''}));
        if (row.message || row.stack) line.append(el('pre', {class: 'failure', text: [row.message, row.stack].filter(Boolean).join('\n')}));
        details.append(line);
      }
      return details;
    });
    refs.testsBody.replaceChildren(el('div', {class: 'tests-view'}, groups.length ? groups : el('p', {class: 'muted pad', text: 'No tests ran.'})), ...(tests.output ? [el('details', {class: 'test-output'}, el('summary', {text: 'Program output'}), el('pre', {class: 'io-block', text: tests.output}))] : []));
  }

  // ---------- question drawer ----------
  function phaseState(index) {
    const record = session.phases[index];
    if (!record) return 'locked';
    if (record.passedAt) return 'passed';
    if (record.skippedAt) return 'skipped';
    return index + 1 === session.unlocked ? 'current' : 'incomplete';
  }
  function renderStepper() {
    if (!practice) return;
    const items = [];
    session.problem.phases.forEach((phase, index) => {
      const state = phaseState(index);
      if (index) items.push(el('span', {class: 'step-line', 'aria-hidden': 'true'}));
      const isCurrent = index + 1 === session.unlocked && session.status === 'active';
      items.push(el('span', {class: `step ${state}${isCurrent ? ' current' : ''}`, role: 'listitem', title: `Phase ${index + 1}: ${state}`},
        el('span', {class: 'dot'}, state === 'passed' ? icon('check') : String(index + 1)), el('span', {class: 'label', text: KIND_LABEL[phase.kind]})));
    });
    refs.stepper.replaceChildren(...items);
  }
  function questionView() {
    if (!practice) {
      return el('div', {class: 'instructions'},
        el('div', {class: 'brief-meta'}, session.source?.startsWith('http') ? el('a', {href: session.source.replace(/\.git$/, ''), target: '_blank', rel: 'noreferrer', text: session.source.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')}) : el('span', {text: session.source || ''}),
          session.commit ? el('span', {class: 'muted small', text: ` · commit ${session.commit.slice(0, 12)}`}) : null),
        el('div', {class: 'md brief-text'}, renderMarkdown(session.brief || 'No brief.')),
        session.benchmark && session.expectedFailures?.length ? el('details', {class: 'panel-lite'}, el('summary', {text: `Tests that must pass after your fix (${session.expectedFailures.length})`}), el('ul', {class: 'expected-tests'}, session.expectedFailures.slice(0, 40).map(t => el('li', {}, el('code', {text: t}))))) : null,
        session.featureBrief ? el('details', {class: 'panel-lite'}, el('summary', {text: 'Stretch goal: a small feature'}), el('p', {text: session.featureBrief})) : null);
    }
    const nodes = [];
    const overview = el('details', {class: 'overview-card', open: session.phases.length === 1 && !session.lastRun}, el('summary', {text: 'About this codebase'}), el('div', {class: 'md'}, renderMarkdown(session.problem.overview)));
    nodes.push(overview);
    session.problem.phases.forEach((phase, index) => {
      const number = index + 1;
      const state = phaseState(index);
      const isCurrent = number === session.unlocked && session.status === 'active';
      const card = el('article', {class: `phase-card ${state}${isCurrent ? ' current' : ''}`});
      const pill = {passed: ['passed', 'Passed'], skipped: ['skipped', 'Skipped'], current: ['active', 'In progress'], incomplete: ['incomplete', 'Not passed'], locked: ['locked', 'Locked']}[state];
      card.append(el('div', {class: 'phase-head'},
        el('span', {class: 'phase-num'}, state === 'passed' ? icon('check') : state === 'locked' ? icon('lock') : String(number)),
        el('div', {class: 'phase-title'}, el('small', {text: `Phase ${number} · ${KIND_LABEL[phase.kind]}`}), el('strong', {text: phase.locked ? 'Unlocks later' : phase.title})),
        el('span', {class: `status-pill phase-status ${pill[0]}`, text: pill[1]})));
      if (phase.locked) card.append(el('p', {class: 'phase-locked', text: `Unlocks when you finish or skip phase ${number - 1}.`}));
      else {
        const body = el('div', {class: 'phase-body'});
        const md = el('div', {class: 'md'}, renderMarkdown(phase.instructions));
        if (isCurrent || state === 'current') body.append(md); else body.append(el('details', {}, el('summary', {class: 'button link', text: 'Show instructions'}), md));
        const hints = session.hintsShown?.[index] || [];
        if (hints.length) body.append(el('ul', {class: 'hint-list'}, hints.map((hint, i) => el('li', {}, icon('bulb'), el('div', {}, el('strong', {text: `Hint ${i + 1}. `}), el('span', {class: 'md'}, renderMarkdown(hint)))))));
        if (isCurrent && live()) {
          const record = session.phases[index];
          const actions = el('div', {class: 'phase-actions'});
          if (record.passedAt) {
            body.append(el('div', {class: 'success-banner'}, icon('check'), `All phase ${number} tests pass.`));
            if (number < session.problem.phases.length) actions.append(el('button', {class: 'button primary', onclick: e => advance(e.currentTarget, false)}, `Continue to phase ${number + 1} →`));
            else if (!mock) actions.append(el('button', {class: 'button primary', onclick: () => submitSession()}, 'Submit for feedback'));
          } else {
            const used = hints.length;
            actions.append(el('button', {class: 'button small', disabled: used >= phase.hintCount, onclick: e => takeHint(e.currentTarget)}, icon('bulb'), used >= phase.hintCount ? 'No more hints' : `Get a hint (${used}/${phase.hintCount})`));
            if (number < session.problem.phases.length) actions.append(el('button', {class: 'button link small', onclick: e => advance(e.currentTarget, true)}, `Skip to phase ${number + 1}`));
          }
          body.append(actions);
        }
        card.append(body);
      }
      nodes.push(card);
    });
    if (session.status !== 'active' && !mock) nodes.push(el('div', {class: 'notice-banner info'}, el('p', {text: 'This session is no longer active. Answer the debrief questions to see your feedback.'})));
    return el('div', {class: 'instructions'}, ...nodes);
  }
  async function takeHint(button) {
    button.disabled = true;
    try { const result = await api('/api/practice/hint', {id}); applyPractice(result.practice); }
    catch (error) { notify(error.message, 'error'); button.disabled = false; }
  }
  async function advance(button, skip) {
    if (skip) {
      const ok = await confirmDialog({title: `Skip to phase ${session.unlocked + 1}?`, body: 'Skipping is recorded in your feedback. You can keep working on this phase\'s code later.', confirm: 'Skip ahead', cancel: 'Stay'});
      if (!ok) return;
    }
    button.disabled = true;
    try {
      await saveAll();
      const result = await api('/api/practice/advance', {id, skip});
      for (const name of result.added) newFiles.add(name);
      applyPractice(result.practice);
      files = result.practice.files;
      renderTree();
      notify(`Phase ${session.unlocked} unlocked${result.added.length ? ': ' + result.added.join(', ') + ' added' : ''}.`, 'success');
      interviewer?.notifyEvent(`The candidate moved on to phase ${session.unlocked}${skip ? ' (skipping the previous phase)' : ''}.`);
      const test = result.added.find(name => name.startsWith('tests/'));
      if (test) await openFile(test);
    } catch (error) { notify(error.message, 'error'); button.disabled = false; }
  }
  function phasePassed(phase) {
    notify(phase < session.problem.phases.length ? `Phase ${phase} passed! Continue to phase ${phase + 1} when you're ready.` : 'All phases pass! Submit when you are ready.', 'success');
    setLeft('question');
    interviewer?.notifyEvent(`All phase ${phase} tests now pass.`);
  }
  function applyPractice(view) {
    if (!view) return;
    session = view;
    skew = view.serverNow - Date.now();
    renderStepper();
    if (leftTab === 'question') renderDrawer();
    if (active) refs.editor.updateOptions({readOnly: active.readonly || !live()});
    refs.submit.disabled = mock ? false : !live();
  }
  async function afterAgentTurn() {
    if (practice) {
      try {
        const view = await api(`/api/practice?id=${id}`);
        const before = new Set(session.phases.filter(p => p.passedAt).map(p => p.number));
        applyPractice(view);
        for (const p of view.phases) if (p.passedAt && !before.has(p.number)) phasePassed(p.number);
        if (testsChanged) { tests.last = null; renderTestResults(); }
      } catch {}
    }
    testsChanged = false;
    loadChanges();
  }

  // ---------- panels ----------
  function setLeft(name) {
    leftTab = name;
    store.set('dg-ade-left', name);
    refs.main.classList.toggle('drawer-open', !!name);
    for (const button of refs.rail.querySelectorAll('.rail-button')) button.classList.toggle('active', button.dataset.left === name);
    renderDrawer();
  }
  async function renderDrawer() {
    if (!leftTab) return;
    if (leftTab === 'question') { refs.drawerTitle.textContent = practice ? 'Question' : 'Brief'; refs.drawerBody.replaceChildren(questionView()); }
    else if (leftTab === 'sessions') { refs.drawerTitle.textContent = 'Agent sessions'; const box = el('div', {class: 'sessions-box'}); refs.drawerBody.replaceChildren(box); await assistant.renderSessionList(box); }
    else if (leftTab === 'interviewer' && interviewer) { refs.drawerTitle.textContent = 'Interviewer'; refs.drawerBody.replaceChildren(interviewer.root); interviewer.scroll(); }
  }
  function setRight(name) {
    rightTab = name;
    for (const button of refs.paneTabs.querySelectorAll('.tab')) button.classList.toggle('active', button.dataset.pane === name);
    for (const pane of refs.right.querySelectorAll('.pane')) pane.hidden = pane.dataset.pane !== name;
    if (name === 'diff') { loadChanges().then(() => { if (!diffPath && changes[0]) openDiff(changes[0].path); else if (diffPath) openDiff(diffPath); }); }
    if (name === 'terminal') setTimeout(() => refs.termInput.focus(), 0);
    if (window.matchMedia('(max-width: 900px)').matches) setMobile('code');
  }
  function setMobile(name) {
    mobilePane = name;
    root.dataset.mobile = name;
    for (const button of refs.mobileBar.querySelectorAll('button')) button.classList.toggle('active', button.dataset.mobile === name);
    if (name === 'question' && !leftTab) setLeft('question');
  }

  // ---------- time and submission ----------
  function tick() {
    if (practice) {
      const ms = session.deadline - (Date.now() + skew);
      refs.timer.replaceChildren(icon('clock'), session.status === 'active' ? clock(ms) : 'Ended');
      refs.timer.className = `timer${session.status === 'active' && ms < 300000 ? ' danger' : session.status === 'active' && ms < 600000 ? ' warn' : ''}`;
      if (session.status === 'active' && ms <= 0 && !ending) timeUp();
    } else {
      refs.timer.replaceChildren(icon('clock'), clock(Date.now() - (session.started || Date.now())));
      refs.timer.title = 'Time since you opened this repo';
    }
  }
  async function timeUp() {
    ending = true;
    refs.editor.updateOptions({readOnly: true});
    if (mock) { interviewer?.timeUp(); return; }
    notify("Time's up. Answer the debrief questions to get your feedback.");
    try { applyPractice(await api(`/api/practice?id=${id}`)); } catch {}
    showDebrief();
  }
  async function submitSession() {
    if (!live()) { showDebrief(); return; }
    const passed = session.phases.filter(p => p.passedAt).length;
    const ok = await confirmDialog({title: 'Submit your session?', body: `You've passed ${passed} of ${session.problem.phases.length} phases. Submitting stops the timer, then you answer three short debrief questions.`, confirm: 'Submit', cancel: 'Keep working'});
    if (!ok) return;
    try {
      await saveAll();
      applyPractice(await api('/api/practice/submit', {id}));
      showDebrief();
    } catch (error) { notify(error.message, 'error'); }
  }
  function showDebrief() {
    if (debriefDialog || mock) return;
    ending = true;
    refs.editor.updateOptions({readOnly: true});
    const questions = session.debrief?.questions || [];
    const drafts = store.get('dg-debrief-' + id, []);
    const fields = questions.map((question, i) => el('textarea', {id: `debrief-${i}`, maxlength: 6000, placeholder: 'A few sentences…'}, session.debrief?.answers?.[i] || drafts[i] || ''));
    fields.forEach(field => field.addEventListener('input', () => store.set('dg-debrief-' + id, fields.map(f => f.value))));
    const status = el('div', {class: 'progress-line', hidden: true}, el('span', {class: 'spinner'}), el('span', {text: 'Reviewing your session…'}));
    const submit = el('button', {class: 'button primary'}, 'Get my feedback');
    const dialog = el('dialog', {class: 'dialog wide'},
      el('div', {class: 'dialog-heading'}, el('h2', {text: session.endReason === 'time_up' ? "Time's up: debrief" : 'Debrief'})),
      el('p', {text: 'Interviewers close with questions like these. Answer in a few sentences each. Your answers are the evidence for the communication score.'}),
      questions.map((question, i) => el('div', {class: 'debrief-q'}, el('label', {for: `debrief-${i}`, text: `${i + 1}. ${question}`}), fields[i])),
      el('div', {class: 'dialog-actions'}, status, el('button', {class: 'button ghost', onclick: () => { dialog.close(); location.hash = '#/repos/guided'; }}, 'Finish later'), submit));
    dialog.addEventListener('cancel', e => e.preventDefault());
    submit.onclick = async () => {
      submit.disabled = true;
      status.hidden = false;
      try {
        const result = await api('/api/practice/debrief', {id, answers: fields.map(f => f.value)});
        if (result.job) await waitJob(result, message => { status.lastChild.textContent = message; });
        store.remove('dg-debrief-' + id);
        dialog.close();
        location.hash = `#/feedback/${id}`;
      } catch (error) { notify(error.message, 'error'); submit.disabled = false; status.hidden = true; }
    };
    debriefDialog = dialog;
    dialog.addEventListener('close', () => { dialog.remove(); debriefDialog = null; });
    document.body.append(dialog);
    dialog.showModal();
  }
  async function leave() {
    if (practice && live() && !mock) {
      const ok = await confirmDialog({title: 'Leave the workspace?', body: 'Your work is saved and you can resume it from Code repos, but the timer keeps running.', confirm: 'Leave', cancel: 'Keep working'});
      if (!ok) return;
    }
    await saveAll().catch(() => {});
    location.hash = mock ? '#/mock' : practice ? '#/repos/guided' : '#/repos';
  }

  root.onkeydown = e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === '`') { e.preventDefault(); setRight('terminal'); }
  };

  // ---------- start ----------
  const ready = (async () => {
    renderStepper();
    setLeft(mock ? 'interviewer' : leftTab === undefined ? 'question' : leftTab);
    setRight('editor');
    setMobile(window.matchMedia('(max-width: 900px)').matches ? 'assistant' : mobilePane);
    renderTree(); renderTabs(); renderTerminal(); renderTestResults();
    refs.editorHost.hidden = true;
    if (mock) {
      const module = await import('./mock.js');
      interviewer = module.createInterviewerPanel(mock, {onEnded: () => { location.hash = `#/mockreport/${mock}`; }, getCode: () => null});
      if (leftTab === 'interviewer') renderDrawer();
    }
    await loadChanges();
    const first = practice ? (files.includes('README.md') ? 'README.md' : files.find(n => !n.startsWith('tests/')) || files[0])
      : files.find(n => /^readme(\.md|\.rst|\.txt)?$/i.test(n)) || null;
    if (first) await openFile(first).catch(() => {});
    // On phones, start on the assistant (or the interviewer) rather than the file just opened.
    if (window.matchMedia('(max-width: 900px)').matches) setMobile(mock ? 'question' : 'assistant');
    assistant.openLatest();
    tick();
    timer = setInterval(tick, 1000);
    autosave = setInterval(() => { if (live()) saveAll().catch(() => {}); }, 15000);
    if (practice && !mock && (session.status === 'debrief' || session.status === 'reviewing')) showDebrief();
    document.title = `${title} · Debug Gym`;
  })();

  return {
    key, ready,
    async dispose() {
      if (disposed) return;
      disposed = true;
      clearInterval(timer); clearInterval(autosave);
      await saveAll().catch(() => {});
      assistant.stop();
      interviewer?.dispose();
      window.removeEventListener('dg-editor-settings', onSettings);
      debriefDialog?.close();
      for (const tab of tabs) { setInlineSource(tab.model, null); tab.model.dispose(); }
      if (diffModels) { diffModels.original.dispose(); diffModels.modified.dispose(); }
      for (const d of disposables) d.dispose();
      root.onkeydown = null;
      root.replaceChildren();
    }
  };
}
