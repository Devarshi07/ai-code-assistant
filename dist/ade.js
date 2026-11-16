// The AI-assisted development environment for code repos, laid out like a
// code editor: the question and agent sessions in a side drawer, the file tree
// and editor (or the diff of your changes) in the middle with Terminal and
// Tests docked underneath, and the AI assistant on the right. Used for guided
// problems (timed, three phases, debrief and review) and for any repository.
import {el, api, waitJob, notify, clock, confirmDialog, choicePicker, store, icon, splitter, DIFFICULTY_CLASS, KIND_LABEL} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {parseInstructions, mentionedFiles, resolveFile, testNameCandidates} from './brief.js';
import {loadMonaco, editorOptions, applySettings, setInlineSource, settings, monacoLanguage, themeName} from './monaco.js';
import {createAssistant} from './assistant-ui.js';
import {enterFullscreen} from './app.js';

const RUN_TIMEOUT = 30000;
const LANGUAGE_LABEL = {python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript', java: 'Java', go: 'Go', express: 'Node.js · Express', django: 'Python · Django REST', fastapi: 'Python · FastAPI', spring: 'Java · Spring Boot'};
// Per-language details for guided sessions: a terminal hint, where tests run
// and a template for a test file the candidate adds.
const TERMINAL_HINT = {python: 'python -m unittest discover -s tests', javascript: 'node --test', typescript: 'node --experimental-strip-types main.ts', java: 'javac -d /tmp/out $(find src -name "*.java") && java -cp /tmp/out Main', go: 'go test ./tests/...', express: 'node --test', django: 'python -m unittest discover -s tests -t .', fastapi: 'python -m unittest discover -s tests -t .', spring: 'mvn -q test -Dtest=Phase1Test'};
const RUNS_IN = {python: 'Python 3.12 in Docker', javascript: 'Node.js test runner in your browser', typescript: 'Node.js 22 (types stripped) in Docker', java: 'Java 21 + JUnit 5 in Docker', go: 'Go 1.24 in Docker', express: 'Node.js 22 + Express in Docker', django: 'Django 5.2 + DRF in Docker', fastapi: 'FastAPI in Docker', spring: 'Spring Boot 3.4 + JUnit 5 in Docker (compiles first, ~10–20 s)'};
const JS_TEST_TEMPLATE = "const { test } = require('node:test');\nconst assert = require('node:assert/strict');\n\ntest('example', () => {\n  assert.equal(1 + 1, 2);\n});\n";
const TEST_TEMPLATE = {
  python: 'import unittest\n\n\nclass CustomTests(unittest.TestCase):\n    def test_example(self):\n        self.assertTrue(True)\n',
  javascript: JS_TEST_TEMPLATE,
  typescript: "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('example', () => {\n  assert.equal(1 + 1, 2);\n});\n",
  java: 'package tests;\n\nimport static org.junit.jupiter.api.Assertions.assertEquals;\n\nimport org.junit.jupiter.api.Test;\n\nclass CustomTest {\n    @Test\n    void example() {\n        assertEquals(2, 1 + 1);\n    }\n}\n',
  go: 'package tests\n\nimport "testing"\n\nfunc TestCustomExample(t *testing.T) {\n\tif 1+1 != 2 {\n\t\tt.Fatal("1 + 1 should be 2")\n\t}\n}\n',
  express: JS_TEST_TEMPLATE,
  django: 'from tests.base import ApiTestCase\n\n\nclass CustomTests(ApiTestCase):\n    # self.client is a DRF APIClient; the database is rolled back after each test.\n    def test_example(self):\n        self.assertTrue(True)\n',
  fastapi: 'import unittest\n\n\nclass CustomTests(unittest.TestCase):\n    def test_example(self):\n        self.assertTrue(True)\n',
  spring: 'package com.debuggym.api;\n\nimport static org.junit.jupiter.api.Assertions.assertEquals;\n\nimport org.junit.jupiter.api.Test;\n\nclass CustomTest {\n    @Test\n    void example() {\n        assertEquals(2, 1 + 1);\n    }\n}\n'
};
let current = null;

export async function closeFullscreen() {
  if (!current) return;
  const instance = current;
  current = null;
  await instance.dispose();
}

// Builds the workspace again for the same session, after a language switch.
async function reopenAde(root, kind, id, options) {
  await closeFullscreen();
  await openAde(root, kind, id, options);
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
  let workView = 'editor', dockTab = 'terminal', leftTab = store.get('dg-ade-left', 'question'), mobilePane = 'assistant';
  // The Interviewer panel only exists in AI-fluency interviews.
  if (!['question', 'sessions', null].includes(leftTab)) leftTab = 'question';
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
  // In a guided problem with more than one language, the language chip switches language.
  const languageLabel = lang => session.problem?.languageLabels?.[lang] || LANGUAGE_LABEL[lang] || lang;
  const canSwitch = practice && !mock && (session.problem?.languages?.length || 0) > 1 && session.status === 'active';
  refs.language = canSwitch
    ? el('button', {class: 'chip lang-switch', title: 'Switch to another language', 'aria-haspopup': 'menu', onclick: event => languageMenu(event.currentTarget)}, languageLabel(session.language), icon('caret', 'icon caret'))
    : el('span', {class: 'chip', text: session.languageLabel || languageLabel(session.language)});
  const chips = practice
    ? [el('span', {class: `difficulty ${DIFFICULTY_CLASS[session.difficulty]}`, text: session.difficulty}), refs.language]
    : [el('span', {class: 'chip', text: session.benchmark ? 'Real-world issue' : session.challenge ? 'Incident' : 'GitHub repo'}), session.runtime ? el('span', {class: 'chip', text: session.runtime}) : null];
  refs.aiToggle = el('button', {class: 'button small ai-toggle active', title: 'Show or hide the AI assistant', onclick: () => toggleAi()}, icon('spark'), 'AI');
  refs.more = practice && !mock ? el('button', {class: 'icon-button more-button', title: 'More actions', 'aria-label': 'More actions', 'aria-haspopup': 'menu', onclick: event => moreMenu(event.currentTarget)}, '⋯') : null;
  const top = el('header', {class: 'fs-top ade-top'},
    el('button', {class: 'icon-button', title: 'Leave the workspace', 'aria-label': 'Leave the workspace', onclick: leave}, icon('back')),
    el('div', {class: 'fs-title'}, el('strong', {text: title}), ...chips),
    practice ? refs.stepper : null,
    el('span', {class: 'grow'}),
    refs.timer, refs.aiToggle, refs.runTests, practice || mock ? refs.submit : null, refs.more);

  // Left rail and drawer.
  const railButton = (name, iconName, label) => el('button', {class: 'rail-button', 'data-left': name, title: label, 'aria-label': label, onclick: () => setLeft(leftTab === name ? null : name)}, icon(iconName), el('span', {text: label}));
  refs.rail = el('nav', {class: 'ade-rail', 'aria-label': 'Panels'},
    railButton('question', 'book', practice ? 'Question' : 'Brief'),
    railButton('sessions', 'history', 'Sessions'),
    mock ? railButton('interviewer', 'user', 'Interviewer') : null);
  refs.drawerTitle = el('strong');
  refs.drawerBody = el('div', {class: 'drawer-body'});
  refs.drawerBody.addEventListener('click', event => openFileReference(event));
  refs.drawerBody.addEventListener('keydown', event => { if (event.key === 'Enter') openFileReference(event); });
  refs.drawer = el('aside', {class: 'ade-drawer'}, el('div', {class: 'pane-header'}, refs.drawerTitle, el('span', {class: 'grow'}), el('button', {class: 'icon-button', 'aria-label': 'Close panel', onclick: () => setLeft(null)}, '×')), refs.drawerBody);

  // Assistant in the middle.
  const assistant = createAssistant({
    variant: 'ade', modes: ['ask', 'plan', 'agent'], scope, standingApproval: !practice,
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

  // The work area: files and editor (or your changes) on top, Terminal and Tests docked below.
  const viewTab = (name, iconName, label) => el('button', {class: 'tab', 'data-pane': name, onclick: () => setRight(name)}, icon(iconName), label, el('span', {class: 'tab-badge', hidden: true}));
  refs.editorPane = buildEditorPane();
  refs.diffPane = buildDiffPane();
  refs.terminalPane = buildTerminalPane();
  refs.testsPane = buildTestsPane();
  refs.dockToggle = el('button', {class: 'icon-button dock-toggle', title: 'Show or hide the panel (Ctrl+`)', 'aria-label': 'Show or hide the terminal and tests panel', onclick: () => setDock(refs.center.classList.contains('dock-closed'))}, icon('caret'));
  refs.workTabs = el('div', {class: 'tabs work-tabs', role: 'tablist'}, viewTab('editor', 'code', 'Code'), viewTab('diff', 'diff', 'Changes'));
  refs.dockTabs = el('div', {class: 'tabs dock-tabs', role: 'tablist'}, viewTab('terminal', 'terminal', 'Terminal'), viewTab('tests', 'check', 'Tests'), el('span', {class: 'grow'}), refs.dockToggle);
  const dockSplit = el('div', {class: 'splitter horizontal', role: 'separator', 'aria-orientation': 'horizontal'});
  refs.center = el('section', {class: `ade-center ade-work${store.get('dg-ade-dock', false) ? '' : ' dock-closed'}`, 'aria-label': 'Code'},
    refs.workTabs, el('div', {class: 'work-stack'}, refs.editorPane, refs.diffPane), dockSplit,
    el('section', {class: 'ade-dock', 'aria-label': 'Terminal and tests'}, refs.dockTabs, el('div', {class: 'dock-stack'}, refs.terminalPane, refs.testsPane)));
  refs.right = el('section', {class: 'ade-right ade-ai', 'aria-label': 'AI assistant'}, assistant.root);
  const tabBadge = name => refs.center.querySelector(`[data-pane="${name}"] .tab-badge`);

  const drawerSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  const rightSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  refs.mobileBar = el('nav', {class: 'ade-mobile-bar', 'aria-label': 'Workspace views'},
    ['question', 'assistant', 'code'].map(name => el('button', {'data-mobile': name, onclick: () => setMobile(name)}, icon(name === 'question' ? 'book' : name === 'assistant' ? 'spark' : 'code'), name === 'question' ? (practice ? 'Question' : 'Brief') : name === 'assistant' ? 'Assistant' : 'Code')));
  refs.main = el('div', {class: `ade-main${store.get('dg-ade-ai-hidden', false) ? ' ai-hidden' : ''}`}, refs.rail, refs.drawer, drawerSplit, refs.center, rightSplit, refs.right);
  refs.aiToggle.classList.toggle('active', !refs.main.classList.contains('ai-hidden'));
  root.replaceChildren(top, refs.main, refs.mobileBar);
  const sizes = store.get('dg-ade-sizes', {});
  for (const [name, value] of Object.entries(sizes)) refs.main.style.setProperty(name, value + 'px');
  splitter(refs.main, drawerSplit, '--ade-drawer', x => x - refs.drawer.getBoundingClientRect().left, 240, 640, 'dg-ade-sizes');
  splitter(refs.main, rightSplit, '--ade-ai', x => refs.main.getBoundingClientRect().right - x, 300, 900, 'dg-ade-sizes');
  splitter(refs.center, dockSplit, '--dock-h', (x, y) => refs.center.getBoundingClientRect().bottom - y, 120, 800, 'dg-ade-dock-size');
  const dockSize = store.get('dg-ade-dock-size', {})['--dock-h'];
  if (dockSize) refs.center.style.setProperty('--dock-h', dockSize + 'px');

  // ---------- editor pane ----------
  function buildEditorPane() {
    refs.treeFilter = el('input', {class: 'tree-filter', type: 'search', placeholder: 'Find a file', 'aria-label': 'Find a file'});
    refs.treeFilter.addEventListener('input', () => { filter = refs.treeFilter.value.trim().toLowerCase(); renderTree(); });
    refs.tree = el('div', {class: 'file-tree', role: 'tree'});
    refs.treeCount = el('div', {class: 'tree-count muted small'});
    refs.explorer = el('aside', {class: 'ade-explorer', 'aria-label': 'Files'},
      el('div', {class: 'pane-header'}, el('span', {text: 'Explorer'}), el('span', {class: 'grow'}),
        el('button', {class: 'icon-button', title: 'New file', 'aria-label': 'New file', onclick: newFile}, icon('plus')),
        el('button', {class: 'icon-button', title: 'Refresh', 'aria-label': 'Refresh files', onclick: () => refreshFiles()}, icon('refresh'))),
      el('div', {class: 'tree-tools'}, refs.treeFilter), refs.treeCount, refs.tree,
      practice ? el('div', {class: 'explorer-foot'}, icon('lock'), ' Provided tests are read-only') : null);
    refs.fileTabs = el('div', {class: 'file-tabs', role: 'tablist'});
    refs.cursor = el('span', {class: 'muted small'});
    refs.saveState = el('span', {class: 'muted small'});
    refs.editorHost = el('div', {class: 'monaco-host'});
    refs.editorEmpty = el('div', {class: 'editor-empty muted', text: 'Open a file from the tree.'});
    // Markdown files (README.md first) open as a formatted document; "Edit source" shows the text.
    refs.mdPreview = el('article', {class: 'md-preview', hidden: true, 'aria-label': 'Formatted document'});
    refs.mdPreview.addEventListener('click', openFileReference);
    refs.mdPreview.addEventListener('keydown', event => { if (event.key === 'Enter') openFileReference(event); });
    refs.previewToggle = el('button', {class: 'button ghost small preview-toggle', hidden: true, onclick: () => togglePreview()});
    const explorerToggle = el('button', {class: 'icon-button', title: 'Toggle the file tree', 'aria-label': 'Toggle the file tree', onclick: () => { refs.editorPaneMain.classList.toggle('tree-hidden'); store.set('dg-ade-tree-hidden', refs.editorPaneMain.classList.contains('tree-hidden')); }}, icon('panel'));
    const bar = el('div', {class: 'editor-bar'}, explorerToggle, refs.fileTabs, el('span', {class: 'grow'}), refs.previewToggle, refs.saveState, refs.cursor,
      el('button', {class: 'icon-button', title: 'Editor settings', 'aria-label': 'Editor settings', onclick: e => editorSettings(e.currentTarget)}, icon('gear')));
    const editorSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
    refs.editorPaneMain = el('div', {class: `editor-split${store.get('dg-ade-tree-hidden', false) ? ' tree-hidden' : ''}`}, refs.explorer, editorSplit, el('div', {class: 'editor-col'}, bar, refs.editorHost, refs.mdPreview, refs.editorEmpty));
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
    refs.termInput = el('input', {class: 'term-input', placeholder: practice ? (TERMINAL_HINT[session.language] || 'ls') : session.benchmark ? 'git status' : 'ls -la', 'aria-label': 'Terminal command', spellcheck: 'false', autocomplete: 'off'});
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
        el('div', {class: 'editor-bar'}, refs.testsRun, refs.testsStatus, el('span', {class: 'grow'}), practice ? el('span', {class: 'muted small', text: RUNS_IN[session.language] || ''}) : null),
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
      tab = {path, model, savedVersion: model.getAlternativeVersionId(), readonly: file.readonly || isReadonly(path), view: null, preview: isMarkdown(path) ? store.get('dg-md-preview', true) : false};
      model.onDidChangeContent(() => { renderTabs(); if (tab === active && !refs.mdPreview.hidden) schedulePreview(); });
      setInlineSource(model, ({prefix, suffix, signal}) => fetch('/api/assistant/complete', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prefix, suffix, path, ...scope()}), signal}).then(r => r.json()).then(r => r.completion || ''));
      tabs.push(tab);
      event({type: 'open', path});
    }
    if (active && active !== tab) {
      active.view = refs.editor.saveViewState();
      if (!refs.mdPreview.hidden) active.previewScroll = refs.mdPreview.scrollTop;
    }
    active = tab;
    newFiles.delete(path);
    refs.editor.setModel(tab.model);
    refs.editor.updateOptions({readOnly: tab.readonly});
    if (tab.view) refs.editor.restoreViewState(tab.view);
    // Jumping to a line (a traceback, a test) needs the source, not the formatted view.
    if (line && tab.preview) tab.preview = false;
    if (line) { refs.editor.revealLineInCenter(line); refs.editor.setPosition({lineNumber: line, column: 1}); }
    refs.editorEmpty.hidden = true;
    refs.editorHost.hidden = false;
    paintPreview();
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
      else { refs.editor.setModel(null); refs.editorHost.hidden = true; refs.editorEmpty.hidden = false; paintPreview(); renderTabs(); renderTree(); }
    } else renderTabs();
  }

  // ---------- Markdown preview ----------
  const isMarkdown = path => /\.(md|markdown)$/i.test(path || '');
  let previewTimer = null;
  function paintPreview() {
    const markdown = !!active && isMarkdown(active.path);
    const showing = markdown && active.preview !== false;
    refs.previewToggle.hidden = !markdown;
    refs.previewToggle.replaceChildren(icon(showing ? 'code' : 'book'), showing ? 'Edit source' : 'Preview');
    refs.previewToggle.title = showing ? 'Show the Markdown source' : 'Show the formatted document';
    refs.mdPreview.hidden = !showing;
    if (active) refs.editorHost.hidden = showing;
    refs.cursor.hidden = showing;
    if (showing) renderPreview(true);
  }
  function renderPreview(reset = false) {
    clearTimeout(previewTimer);
    if (!active || refs.mdPreview.hidden) return;
    // Coming back to a document returns to where you were reading.
    const top = reset ? active.previewScroll || 0 : refs.mdPreview.scrollTop;
    const body = el('div', {class: 'md md-doc'}, renderMarkdown(active.model.getValue(), {headingOffset: 0, softBreaks: true, relativeLinks: true, document: true}));
    linkFileMentions(body, active.path);
    refs.mdPreview.replaceChildren(body);
    refs.mdPreview.scrollTop = top;
  }
  const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(() => renderPreview(), 200); };
  function togglePreview() {
    if (!active || !isMarkdown(active.path)) return;
    if (!refs.mdPreview.hidden) active.previewScroll = refs.mdPreview.scrollTop;
    active.preview = active.preview === false;
    store.set('dg-md-preview', active.preview);
    paintPreview();
    if (!active.preview) { refs.editor.layout(); if (!active.readonly) refs.editor.focus(); }
  }
  // Code spans and relative links that name a workspace file become links that open it.
  function linkFileMentions(container, from = '') {
    for (const code of container.querySelectorAll('code')) {
      if (code.closest('pre')) continue;
      const path = resolveFile(code.textContent, files, from);
      if (!path) continue;
      code.classList.add('file-ref');
      Object.assign(code.dataset, {file: path});
      code.setAttribute('role', 'link');
      code.tabIndex = 0;
      code.title = `Open ${path}`;
    }
    for (const anchor of container.querySelectorAll('a.md-file-link')) {
      const path = resolveFile(anchor.dataset.path, files, from);
      if (path) { anchor.dataset.file = path; anchor.title = `Open ${path}`; }
      else { anchor.classList.add('missing'); anchor.title = `${anchor.dataset.path} is not in this workspace`; }
    }
  }
  function openFileReference(event) {
    const target = event.target.closest?.('[data-file], a.md-file-link');
    if (!target) return;
    event.preventDefault();
    if (target.dataset.file) openFile(target.dataset.file).catch(error => notify(error.message, 'error'));
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
    const suggestion = practice ? session.customExample || (session.language === 'python' ? 'tests/test_custom.py' : 'tests/custom.test.js') : '';
    const input = el('input', {value: suggestion, maxlength: 300, 'aria-label': 'File path', placeholder: 'src/new_file.py'});
    const finish = async create => {
      dialog.close(); dialog.remove();
      const name = input.value.trim();
      if (!create || !name) return;
      const template = practice && /test/i.test(name) ? (TEST_TEMPLATE[session.language] || '').replace('class CustomTest {', `class ${(name.split('/').pop() || '').replace(/\.java$/, '') || 'CustomTest'} {`) : '';
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
    const badge = tabBadge('diff');
    badge.hidden = !changes.length;
    badge.textContent = String(changes.length);
    refs.changeList.replaceChildren(...(changes.length ? changes.map(c => el('button', {class: `change-row${c.path === diffPath ? ' active' : ''}`, title: c.path, onclick: () => openDiff(c.path)},
      el('span', {class: `change-mark ${c.status}`, text: c.status === 'added' ? 'A' : c.status === 'deleted' ? 'D' : 'M'}), el('span', {class: 'change-name', text: c.path.split('/').pop()}), el('span', {class: 'change-dir muted small', text: c.path.includes('/') ? c.path.slice(0, c.path.lastIndexOf('/')) : ''})))
      : [el('p', {class: 'muted small pad', text: 'No changed files yet. Edits you or the agent make show up here.'})]));
    if (workView === 'diff' && !diffPath && changes[0]) openDiff(changes[0].path);
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
      e.running ? el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Running…') : el('pre', {class: `term-output${e.code ? ' failed' : ''}`}, ...linkify(e.output || '(no output)')),
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
    if (practice && leftTab === 'question') renderDrawer();
    refs.testsRun.disabled = refs.runTests.disabled = true;
    refs.testsStatus.textContent = 'Running…';
    renderTestResults();
    let text = '';
    try {
      await saveAll();
      if (practice) {
        let result;
        if ((session.runner || (session.language === 'javascript' ? 'browser' : 'python')) === 'browser') {
          const run = await runInBrowser();
          const recorded = await api('/api/practice/result', {id, target: 'tests', results: run.results, output: run.output.slice(-3000), exitCode: run.exitCode, ms: run.ms, timedOut: run.timedOut});
          result = {...run, ...recorded};
        } else {
          result = await waitJob(await api('/api/practice/run', {id, target: 'tests'}), message => { refs.testsStatus.textContent = message; });
        }
        if (disposed) return text;
        tests.last = result;
        tests.lastAt = result.practice?.lastRun?.at || 0;
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
      // After a restart or leaving, this page is gone: say nothing.
      if (disposed) return text;
      tests.last = {error: error.message};
      text = tests.text = `The tests could not run: ${error.message}`;
      if (!forAgent) notify(error.message, 'error');
    } finally {
      if (disposed) return text;
      tests.running = false;
      refs.testsRun.disabled = refs.runTests.disabled = false;
      refs.testsStatus.textContent = '';
      renderTestResults();
      if (practice && leftTab === 'question') renderDrawer();
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
    const phaseFiles = session.testFiles || [1, 2, 3].map(n => session.language === 'python' ? `tests/test_phase${n}.py` : `tests/phase${n}.test.js`);
    const index = phaseFiles.indexOf(file);
    if (index >= 0) return index + 1;
    return null;
  }
  function renderTestResults() {
    const badge = tabBadge('tests');
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
        el('pre', {class: 'io-block'}, ...linkify(tests.output || '(no output)')));
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
        if (row.message || row.stack) line.append(el('pre', {class: 'failure'}, ...linkify([row.message, row.stack].filter(Boolean).join('\n'))));
        details.append(line);
      }
      return details;
    });
    refs.testsBody.replaceChildren(el('div', {class: 'tests-view'}, groups.length ? groups : el('p', {class: 'muted pad', text: 'No tests ran.'})), ...(tests.output ? [el('details', {class: 'test-output'}, el('summary', {text: 'Program output'}), el('pre', {class: 'io-block'}, ...linkify(tests.output)))] : []));
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
    // Guided problems: a header, then Task (the current phase as a brief:
    // reports, the task, the goal with each check's last result, hints) or
    // Codebase (the overview and where to start). File names are links.
    const tab = store.get('dg-brief-tab', 'task') === 'codebase' ? 'codebase' : 'task';
    const total = session.problem.phases.length;
    const passed = session.phases.filter(p => p.passedAt).length;
    const hero = el('header', {class: 'brief-hero'},
      el('div', {class: 'brief-chips'},
        el('span', {class: `difficulty ${DIFFICULTY_CLASS[session.difficulty]}`, text: session.difficulty}),
        session.problem.pattern ? el('span', {class: 'chip', text: session.problem.pattern}) : null,
        el('span', {class: 'chip'}, icon('clock'), `${session.minutes} min`)),
      el('h2', {class: 'brief-title', text: session.title}),
      session.problem.summary ? el('p', {class: 'brief-summary', text: session.problem.summary}) : null,
      el('div', {class: 'brief-progress', title: `${passed} of ${total} phases passed`},
        session.problem.phases.map((phase, index) => el('span', {class: `seg ${phaseState(index)}${index + 1 === session.unlocked ? ' now' : ''}`, title: `Phase ${index + 1} · ${KIND_LABEL[phase.kind]}: ${phaseState(index)}`})),
        el('small', {text: `${passed}/${total} phases passed`})));
    const tabs = el('div', {class: 'brief-tabs', role: 'tablist', 'aria-label': 'Question'}, [['task', 'Task'], ['codebase', 'Codebase']].map(([key, label]) =>
      el('button', {class: `brief-tab${tab === key ? ' active' : ''}`, role: 'tab', 'aria-selected': String(tab === key), onclick: () => { store.set('dg-brief-tab', key); renderDrawer(); }}, label)));
    const body = tab === 'codebase' ? codebaseView() : taskView();
    if (session.status !== 'active' && !mock) body.prepend(el('div', {class: 'notice-banner info'}, el('p', {text: session.endReason === 'restarted' ? 'This attempt was restarted.' : 'Time is up or the session was submitted. Answer the debrief questions to see your feedback, or restart the problem from the ⋯ menu.'})));
    return el('div', {class: 'brief'}, hero, tabs, body);
  }

  const KIND_ICON = {bug: 'flag', feature: 'code', optimize: 'spark'};
  // Markdown with file links. softBreaks: the text is wrapped like a document.
  function briefMarkdown(markdown, className = 'md') {
    const box = el('div', {class: className}, renderMarkdown(markdown || '', {softBreaks: true}));
    linkFileMentions(box);
    return box;
  }
  // The last result of each test in a phase's test file: from this page's
  // latest run, or from the last run the server recorded.
  function phaseChecks(index) {
    const file = (session.testFiles || [])[index];
    // This page's run, unless the server recorded a newer one (the agent ran the tests).
    const local = tests.last?.results?.length && (tests.lastAt || 0) >= (session.lastRun?.at || 0);
    const results = local ? tests.last.results : session.lastRun?.results || [];
    const rows = results.filter(r => r.file === file && r.status !== 'skip');
    return rows.length ? rows.map(r => ({file, name: r.name, status: r.status})) : null;
  }
  function taskView() {
    const index = Math.min(session.unlocked, session.problem.phases.length) - 1;
    const nodes = [phaseBrief(index)];
    const others = session.problem.phases.map((_, i) => i === index ? null : phaseRow(i)).filter(Boolean);
    if (others.length) nodes.push(el('section', {class: 'brief-section'}, el('h3', {class: 'brief-h', text: 'All phases'}), el('div', {class: 'phase-rows'}, others)));
    return el('div', {class: 'brief-body'}, ...nodes);
  }
  function phaseBrief(index) {
    const phase = session.problem.phases[index];
    const number = index + 1, state = phaseState(index);
    const isCurrent = number === session.unlocked && session.status === 'active';
    const pill = {passed: ['passed', 'Passed'], skipped: ['skipped', 'Skipped'], current: ['active', 'In progress'], incomplete: ['incomplete', 'Not passed'], locked: ['locked', 'Locked']}[state];
    const parsed = parseInstructions(phase.instructions);
    const card = el('article', {class: `phase-brief kind-${phase.kind} ${state}`},
      el('div', {class: 'phase-brief-head'},
        el('span', {class: `kind-badge ${phase.kind}`}, icon(KIND_ICON[phase.kind] || 'code'), KIND_LABEL[phase.kind]),
        el('span', {class: 'muted small', text: `Phase ${number} of ${session.problem.phases.length}`}),
        el('span', {class: 'grow'}),
        el('span', {class: `status-pill phase-status ${pill[0]}`, text: pill[1]})),
      el('h3', {class: 'phase-brief-title', text: phase.title}));
    for (const segment of parsed.segments) {
      if (segment.type === 'text') card.append(briefMarkdown(segment.markdown, 'md brief-text'));
      else card.append(el('div', {class: 'reports'}, segment.reports.map(reportCard)));
    }
    card.append(goalBox(index, parsed.done, isCurrent));
    const hints = session.hintsShown?.[index] || [];
    if (hints.length || (isCurrent && live() && state !== 'passed' && phase.hintCount)) {
      const section = el('section', {class: 'hints'}, el('div', {class: 'hints-head'}, icon('bulb'), el('strong', {text: 'Hints'}), el('span', {class: 'muted small', text: `${hints.length} of ${phase.hintCount} used · each one is noted in your review`})));
      hints.forEach((hint, i) => section.append(el('div', {class: 'hint-card'}, el('span', {class: 'hint-num', text: String(i + 1)}), briefMarkdown(hint))));
      if (isCurrent && live() && state !== 'passed' && hints.length < phase.hintCount) section.append(el('button', {class: 'button small hint-button', onclick: e => takeHint(e.currentTarget)}, icon('bulb'), hints.length ? `Show hint ${hints.length + 1}` : 'Show a hint'));
      card.append(section);
    }
    if (isCurrent && live()) {
      const actions = el('div', {class: 'phase-actions'});
      if (session.phases[index]?.passedAt) {
        if (number < session.problem.phases.length) actions.append(el('button', {class: 'button primary', onclick: e => advance(e.currentTarget, false)}, `Continue to phase ${number + 1} →`));
        else if (!mock) actions.append(el('button', {class: 'button primary', onclick: () => submitSession()}, 'Submit for feedback'));
      } else if (number < session.problem.phases.length) actions.append(el('button', {class: 'button link small', onclick: e => advance(e.currentTarget, true)}, `Skip to phase ${number + 1}`));
      if (actions.childNodes.length) card.append(actions);
    }
    return card;
  }
  function reportCard(report) {
    const initials = report.who ? report.who.split(/[\s&()]+/).filter(word => /^[A-Za-z]/.test(word)).slice(0, 2).map(word => word[0].toUpperCase()).join('') : '';
    return el('figure', {class: 'report'},
      el('span', {class: `report-avatar${initials ? '' : ' anon'}`, 'aria-hidden': 'true'}, initials || icon('chat')),
      el('div', {class: 'report-body'}, el('figcaption', {class: 'report-who', text: report.who || 'Report'}), briefMarkdown(report.text, 'md report-text')));
  }
  function goalBox(index, done, isCurrent) {
    const checks = phaseChecks(index);
    const state = phaseState(index);
    const ok = checks ? checks.filter(c => c.status === 'pass').length : 0;
    const allPass = state === 'passed' || (checks && ok === checks.length);
    const box = el('section', {class: `goal${allPass ? ' done' : ''}`},
      el('div', {class: 'goal-head'}, icon(allPass ? 'check' : 'flag'), el('strong', {text: 'Done when'}), briefMarkdown(done || 'every test in this phase\'s test file passes.', 'md goal-text')));
    if (checks) {
      box.append(el('div', {class: 'check-meter', role: 'img', 'aria-label': `${ok} of ${checks.length} checks passing`},
        el('div', {class: 'meter-bar'}, el('span', {style: `width:${Math.round(ok / checks.length * 100)}%`})),
        el('span', {class: 'meter-label', text: `${ok}/${checks.length} passing`})));
      box.append(el('ul', {class: 'check-list'}, checks.map(check => el('li', {},
        el('button', {class: `check ${check.status}`, title: 'Show this test in the editor', onclick: () => openTest(check)},
          icon(check.status === 'pass' ? 'check' : 'cross'), el('span', {text: check.name}))))));
    } else box.append(el('p', {class: 'muted small goal-empty', text: state === 'passed' ? 'All checks in this phase passed.' : 'Run the tests to see each check here.'}));
    if (isCurrent && live()) {
      const run = el('button', {class: 'button primary small', disabled: tests.running, onclick: () => runTests()}, icon('play'), tests.running ? 'Running…' : checks ? 'Run tests again' : 'Run tests');
      box.append(el('div', {class: 'goal-actions'}, run, el('span', {class: 'muted small', text: 'Ctrl+Enter in the editor'})));
    }
    return box;
  }
  async function openTest(check) {
    try {
      await openFile(check.file);
      const model = active?.model;
      if (!model || active.path !== check.file) return;
      for (const candidate of testNameCandidates(check.name)) {
        const match = model.findMatches(candidate, false, false, false, null, false)[0];
        if (match) { refs.editor.revealLineInCenter(match.range.startLineNumber); refs.editor.setSelection(match.range); return; }
      }
    } catch (error) { notify(error.message, 'error'); }
  }
  function phaseRow(index) {
    const phase = session.problem.phases[index];
    const number = index + 1, state = phaseState(index);
    const label = {passed: 'Passed', skipped: 'Skipped', incomplete: 'Not passed', current: 'In progress', locked: 'Locked'}[state];
    if (phase.locked) return el('div', {class: 'phase-row locked'}, el('span', {class: 'phase-row-num'}, icon('lock')), el('div', {}, el('small', {text: `Phase ${number} · ${KIND_LABEL[phase.kind]}`}), el('strong', {text: `Unlocks after phase ${number - 1}`})));
    const details = el('details', {class: `phase-row ${state}`},
      el('summary', {}, el('span', {class: 'phase-row-num'}, state === 'passed' ? icon('check') : String(number)), el('div', {}, el('small', {text: `Phase ${number} · ${KIND_LABEL[phase.kind]}`}), el('strong', {text: phase.title})), el('span', {class: 'grow'}), el('span', {class: `status-pill phase-status ${state === 'passed' ? 'passed' : state === 'skipped' ? 'skipped' : 'incomplete'}`, text: label})));
    details.addEventListener('toggle', () => { if (details.open && details.childNodes.length === 1) details.append(el('div', {class: 'phase-row-body'}, briefMarkdown(phase.instructions, 'md brief-text'))); });
    return details;
  }
  function codebaseView() {
    const overview = session.problem.overview || '';
    const start = mentionedFiles(overview, files);
    const readme = files.includes('README.md');
    return el('div', {class: 'brief-body'},
      el('section', {class: 'brief-section'}, briefMarkdown(overview, 'md brief-text')),
      start.length ? el('section', {class: 'brief-section'}, el('h3', {class: 'brief-h', text: 'Start here'}),
        el('div', {class: 'file-chips'}, start.map(path => el('button', {class: 'file-chip', title: `Open ${path}`, onclick: () => openFile(path).catch(error => notify(error.message, 'error'))}, icon('file'), el('span', {text: path}))))) : null,
      el('section', {class: 'brief-section'}, el('h3', {class: 'brief-h', text: 'How your code runs'}),
        el('ul', {class: 'run-facts'},
          el('li', {}, icon('play'), el('span', {text: RUNS_IN[session.language] || 'Tests run in a sandbox.'})),
          el('li', {}, icon('lock'), el('span', {text: `The provided tests are read-only. Add your own in a new file, for example ${session.customExample || 'tests/test_custom.py'}.`})),
          el('li', {}, icon('terminal'), el('span', {text: 'The Terminal runs one command at a time on a disposable copy, with no network.'})))),
      readme ? el('button', {class: 'button small', onclick: () => openFile('README.md').catch(error => notify(error.message, 'error'))}, icon('book'), 'Read README.md') : null);
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
        if (disposed) return;
        const before = new Set(session.phases.filter(p => p.passedAt).map(p => p.number));
        // The agent's run replaces this page's last run before the panel redraws.
        if (testsChanged) { tests.last = null; tests.lastAt = 0; }
        applyPractice(view);
        for (const p of view.phases) if (p.passedAt && !before.has(p.number)) phasePassed(p.number);
        if (testsChanged) renderTestResults();
      } catch {}
    }
    testsChanged = false;
    loadChanges();
  }

  // ---------- panels ----------
  function setLeft(name) {
    if (name === 'interviewer' && !interviewer && !mock) name = 'question';
    leftTab = name;
    if (name !== 'interviewer') store.set('dg-ade-left', name);
    refs.main.classList.toggle('drawer-open', !!name);
    for (const button of refs.rail.querySelectorAll('.rail-button')) button.classList.toggle('active', button.dataset.left === name);
    renderDrawer();
  }
  async function renderDrawer() {
    if (!leftTab) return;
    if (leftTab === 'question') {
      // Re-rendered after every run and hint: keep the reader's place.
      const top = refs.drawerBody.scrollTop;
      refs.drawerTitle.textContent = practice ? 'Question' : 'Brief';
      refs.drawerBody.replaceChildren(questionView());
      refs.drawerBody.scrollTop = top;
    }
    else if (leftTab === 'sessions') { refs.drawerTitle.textContent = 'Agent sessions'; const box = el('div', {class: 'sessions-box'}); refs.drawerBody.replaceChildren(box); await assistant.renderSessionList(box); }
    else if (leftTab === 'interviewer' && interviewer) { refs.drawerTitle.textContent = 'Interviewer'; refs.drawerBody.replaceChildren(interviewer.root); interviewer.scroll(); }
  }
  // 'editor' and 'diff' switch the main view; 'terminal' and 'tests' open the
  // docked panel without hiding the code you are looking at.
  function setRight(name) {
    if (name === 'editor' || name === 'diff') {
      workView = name;
      for (const button of refs.workTabs.querySelectorAll('.tab')) button.classList.toggle('active', button.dataset.pane === name);
      refs.editorPane.hidden = name !== 'editor';
      refs.diffPane.hidden = name !== 'diff';
      if (name === 'diff') { loadChanges().then(() => { if (!diffPath && changes[0]) openDiff(changes[0].path); else if (diffPath) openDiff(diffPath); }); }
    } else {
      dockTab = name;
      setDock(true);
      for (const button of refs.dockTabs.querySelectorAll('.tab')) button.classList.toggle('active', button.dataset.pane === name);
      refs.terminalPane.hidden = name !== 'terminal';
      refs.testsPane.hidden = name !== 'tests';
      if (name === 'terminal') setTimeout(() => refs.termInput.focus(), 0);
    }
    if (window.matchMedia('(max-width: 900px)').matches) setMobile('code');
  }
  function setDock(open) {
    refs.center.classList.toggle('dock-closed', !open);
    refs.dockToggle.setAttribute('aria-expanded', String(open));
    store.set('dg-ade-dock', open);
  }
  function toggleAi() {
    const hidden = refs.main.classList.toggle('ai-hidden');
    store.set('dg-ade-ai-hidden', hidden);
    refs.aiToggle.classList.toggle('active', !hidden);
    if (!hidden) assistant.focus();
  }
  // File paths with line numbers in tracebacks and test output open in the editor.
  function linkify(text) {
    const nodes = [];
    const pattern = /(?:file:\/\/)?(?:\/(?:work|testbed|candidate)\/)?((?:[\w.-]+\/)*[\w.-]+\.[A-Za-z]\w*)(?:", line |:)(\d+)/g;
    let last = 0;
    for (const match of String(text).matchAll(pattern)) {
      const path = match[1].replace(/^\.\//, '');
      const known = files.includes(path) ? path : files.find(f => f.endsWith('/' + path));
      if (!known) continue;
      if (match.index > last) nodes.push(text.slice(last, match.index));
      const line = Number(match[2]);
      nodes.push(el('a', {class: 'trace-link', href: '#', title: `Open ${known} at line ${line}`, onclick: event => { event.preventDefault(); openFile(known, {line}).catch(error => notify(error.message, 'error')); }}, match[0]));
      last = match.index + match[0].length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
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
      el('div', {class: 'dialog-actions'}, status,
        el('button', {class: 'button ghost', title: 'Skip the review and start this problem again', onclick: () => restartAttempt()}, icon('reset'), 'Restart instead'),
        el('span', {class: 'grow'}),
        el('button', {class: 'button ghost', onclick: () => { dialog.close(); location.hash = '#/repos/guided'; }}, 'Finish later'), submit));
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
  // Practice: close this attempt without a review and start a fresh copy.
  let restarting = false;
  async function restartAttempt() {
    if (restarting) return;
    // A run that finishes after the restart would report into the new attempt's page.
    if (tests.running || terminal.running) { notify('A test run or command is still running. Restart when it finishes.', 'error'); return; }
    // The new attempt can start in any of the problem's languages.
    const languages = session.problem?.languages || [session.language];
    let language = session.language;
    const body = el('div', {class: 'restart-body'},
      el('p', {text: 'This attempt closes without a review, and a fresh copy of the codebase starts with a new timer. The old attempt stays in Your activity, marked as restarted.'}),
      languages.length > 1 ? el('div', {class: 'dialog-field'}, el('label', {text: 'Language for the new attempt'}), choicePicker(languages.map(l => [l, languageLabel(l)]), language, value => { language = value; }, 'Language')) : null);
    const ok = await confirmDialog({title: `Restart ${session.title}?`, body, confirm: 'Restart', cancel: 'Keep this attempt', danger: true});
    if (!ok || tests.running || terminal.running) return;
    restarting = true;
    assistant.stop();
    try {
      const fresh = await api('/api/practice/restart', {id, language});
      store.remove('dg-debrief-' + id);
      ending = true;
      debriefDialog?.close();
      notify('Started a fresh attempt. Good luck!', 'success');
      location.hash = `#/ade/practice/${fresh.id}`;
    } catch (error) { notify(error.message, 'error'); }
    finally { restarting = false; }
  }
  // Mid-session language switch: the timer and phase progress carry over, and
  // each language keeps its own code (switching back at the same phase brings it back).
  let switching = false;
  function languageMenu(anchor) {
    document.querySelector('.menu.floating')?.remove();
    const solved = (() => { let n = 0; while (n < session.unlocked - 1 && session.phases[n]?.passedAt) n++; return n; })();
    const note = lang => {
      if (lang === session.language) return 'Current language';
      if (session.drafts?.[lang]?.unlocked === session.unlocked) return 'Your earlier code in this language comes back';
      return `Fresh codebase for phase ${session.unlocked}${solved ? `, with the fix${solved > 1 ? 'es' : ''} for the phase${solved > 1 ? 's' : ''} you passed` : ''}`;
    };
    const menu = el('div', {class: 'menu floating language-menu', role: 'menu'},
      el('div', {class: 'menu-label', text: 'Switch language'}),
      ...session.problem.languages.map(lang => el('button', {class: `menu-item${lang === session.language ? ' selected' : ''}`, role: 'menuitemradio', 'aria-checked': String(lang === session.language),
        onclick: () => { menu.remove(); if (lang !== session.language) switchLanguage(lang); }},
        el('strong', {text: languageLabel(lang)}), el('small', {text: note(lang)}))));
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, rect.left))}px`;
    setTimeout(() => document.addEventListener('pointerdown', function away(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', away); } }), 0);
  }
  async function switchLanguage(language) {
    if (switching || !live()) return;
    if (tests.running || terminal.running) { notify('A test run or command is still running. Switch when it finishes.', 'error'); return; }
    const from = languageLabel(session.language), to = languageLabel(language);
    const back = session.drafts?.[language]?.unlocked === session.unlocked;
    const ok = await confirmDialog({title: `Switch to ${to}?`,
      body: `The timer keeps running and your phase progress carries over. Your ${from} code is kept: switch back during this phase to get it back. ${back ? `Your ${to} code from earlier comes back.` : `You get the ${to} codebase for phase ${session.unlocked}.`} The provided tests are the ${to} versions, and the AI assistant starts a new chat.`,
      confirm: `Switch to ${to}`, cancel: `Stay in ${from}`});
    if (!ok || tests.running || terminal.running) return;
    switching = true;
    assistant.stop();
    try {
      await saveAll();
      const result = await api('/api/practice/language', {id, language});
      store.set(`dg-ade-newchat-${id}`, true);
      notify(result.restored ? `Switched to ${to}. Your earlier ${to} code is back.` : `Switched to ${to}. Your ${from} code is saved.`, 'success');
      interviewer?.notifyEvent(`The candidate switched from ${from} to ${to}.`);
      await reopenAde(root, kind, id, {mock});
    } catch (error) { notify(error.message, 'error'); switching = false; }
  }
  function moreMenu(anchor) {
    document.querySelector('.menu.floating')?.remove();
    const item = (iconName, label, hint, action, danger = false) => el('button', {class: `menu-item${danger ? ' danger' : ''}`, role: 'menuitem', onclick: () => { menu.remove(); action(); }}, icon(iconName), el('span', {}, el('strong', {text: label}), el('small', {text: hint})));
    const menu = el('div', {class: 'menu floating more-menu', role: 'menu'},
      canSwitch && live() ? item('code', 'Switch language', `${session.problem.languages.map(languageLabel).join(', ')}; your progress carries over`, () => languageMenu(refs.language)) : null,
      item('reset', 'Restart this problem', 'A fresh codebase and a new timer; this attempt is not reviewed', restartAttempt, true),
      item('book', 'Open README.md', 'The project notes, formatted', () => openFile('README.md').catch(error => notify(error.message, 'error'))),
      item('back', 'Leave the workspace', 'Your work is saved; the timer keeps running', leave));
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
    setTimeout(() => document.addEventListener('pointerdown', function away(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', away); } }), 0);
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
    if (mod && e.key === '`') { e.preventDefault(); if (!refs.center.classList.contains('dock-closed') && dockTab === 'terminal') setDock(false); else setRight('terminal'); }
  };

  // ---------- start ----------
  const ready = (async () => {
    renderStepper();
    setLeft(mock ? 'interviewer' : leftTab === undefined ? 'question' : leftTab);
    setRight('editor');
    for (const button of refs.dockTabs.querySelectorAll('.tab')) button.classList.toggle('active', button.dataset.pane === dockTab);
    refs.terminalPane.hidden = dockTab !== 'terminal';
    refs.testsPane.hidden = dockTab !== 'tests';
    refs.dockToggle.setAttribute('aria-expanded', String(!refs.center.classList.contains('dock-closed')));
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
    // After a language switch, a new chat: the earlier one talks about the other language's files.
    if (store.get(`dg-ade-newchat-${id}`, false)) { store.remove(`dg-ade-newchat-${id}`); assistant.newSession(false); }
    else assistant.openLatest();
    fetch('/api/assistant/warm', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({completion: true})}).catch(() => {});
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
