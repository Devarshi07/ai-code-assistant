// The timed coding workspace: explorer, editor, tests and output, phase
// instructions and the AI assistant.
import {el, api, waitJob, notify, clock, confirmDialog, store, icon, DIFFICULTY_CLASS, KIND_LABEL} from './ui.js';
import {CodeEditor} from './editor.js';
import {renderMarkdown, languageOf} from './markdown.js';

const RUN_TIMEOUT = 30000;
const LANGUAGE_LABEL = {python: 'Python', javascript: 'JavaScript'};

export function createWorkspace(root, {onLeave, onFinished}) {
  let id = null, session = null, skew = 0, editor = null;
  let tabs = [], active = null, newFiles = new Set();
  const collapsed = new Set(store.get('dg-tree-collapsed', []));
  let runTarget = store.get('dg-run-target', 'tests'), running = false, lastRun = null, output = [], panelTab = 'tests';
  let sideTab = 'instructions', models = null, streaming = null, unread = false, overviewOpen = null;
  let timer = null, autosave = null, ending = false, debriefDialog = null;
  const refs = {};

  const live = () => session && session.status === 'active' && session.deadline - (Date.now() + skew) > 0;
  const dirty = tab => tab && !tab.readonly && tab.content !== tab.saved;
  const event = data => api('/api/practice/event', {id, ...data}).catch(() => {});

  // ---------- lifecycle ----------
  async function open(sessionId) {
    close();
    id = sessionId;
    apply(await api('/api/practice?id=' + id));
    tabs = []; active = null; newFiles = new Set(); output = []; lastRun = null; streaming = null; ending = false;
    overviewOpen = session.phases.length === 1 && !session.lastRun;
    build();
    root.hidden = false;
    document.body.classList.add('ide-open');
    renderAll();
    const first = session.files.includes('README.md') ? 'README.md' : session.files.find(name => !name.startsWith('tests/')) || session.files[0];
    if (first) await openFile(first).catch(error => notify(error.message, 'error'));
    loadModels();
    timer = setInterval(tick, 1000);
    autosave = setInterval(() => { if (live()) saveAll().catch(() => {}); }, 15000);
    tick();
    if (session.status === 'debrief' || session.status === 'reviewing') showDebrief();
    else if (session.status === 'ended') onFinished(id);
  }

  function close() {
    clearInterval(timer); clearInterval(autosave);
    streaming?.controller.abort();
    debriefDialog?.remove(); debriefDialog = null;
    if (root.firstChild) root.replaceChildren();
    root.hidden = true;
    document.body.classList.remove('ide-open');
  }

  async function leave() {
    if (live()) {
      const ok = await confirmDialog({title: 'Leave the session?', body: 'Your work is saved and you can resume from the problem list, but the timer keeps running.', confirm: 'Leave', cancel: 'Keep working'});
      if (!ok) return;
      await saveAll().catch(() => {});
    }
    close();
    onLeave();
  }

  function apply(view) {
    session = view;
    skew = view.serverNow - Date.now();
  }

  async function refresh() {
    apply(await api('/api/practice?id=' + id));
    renderAll();
  }

  // ---------- layout ----------
  function build() {
    root.replaceChildren();
    const sizes = store.get('dg-ide-sizes', {});
    for (const [name, value] of Object.entries(sizes)) root.style.setProperty(name, value + 'px');

    refs.stepper = el('div', {class: 'stepper', role: 'list', 'aria-label': 'Phases'});
    refs.timer = el('div', {class: 'timer', role: 'timer', 'aria-label': 'Time remaining'});
    refs.submit = el('button', {class: 'button primary small', onclick: () => submitSession()}, 'Submit');
    const top = el('header', {class: 'ide-top'},
      el('button', {class: 'icon-button', 'aria-label': 'Back to problems', title: 'Back to problems', onclick: leave}, icon('back')),
      el('div', {class: 'ide-title'},
        el('strong', {text: session.title}),
        el('span', {class: `chip difficulty ${DIFFICULTY_CLASS[session.difficulty]}`, text: session.difficulty}),
        el('span', {class: 'chip', text: LANGUAGE_LABEL[session.language]})),
      refs.stepper, refs.timer, refs.submit);

    refs.tree = el('div', {class: 'file-tree', role: 'tree'});
    const explorer = el('aside', {class: 'explorer', 'aria-label': 'Files'},
      el('div', {class: 'pane-header'}, el('span', {text: 'Explorer'}),
        el('button', {class: 'icon-button', title: 'New file', 'aria-label': 'New file', onclick: newFile}, icon('plus'))),
      refs.tree,
      el('div', {class: 'explorer-foot'}, icon('lock'), ' Provided tests are read-only'));

    refs.tabs = el('div', {class: 'tabs-bar', role: 'tablist'});
    refs.cursor = el('span');
    refs.saveState = el('span');
    refs.editorStatus = el('div', {class: 'editor-status'}, refs.cursor, refs.saveState, el('span', {}, el('kbd', {text: 'Ctrl'}), '+', el('kbd', {text: 'S'}), ' save & run'));
    refs.tabsRow = el('div', {class: 'tabs-bar'}, refs.tabs, el('span', {class: 'tabs-spacer'}), refs.editorStatus);
    const editorHost = el('div');
    editor = new CodeEditor(editorHost, {
      onChange: value => { if (!active) return; active.content = value; renderTabs(); renderSaveState(); },
      onSave: () => saveAndRun(),
      onRun: () => runCode(),
      onPaste: text => { if (active && !active.readonly) event({type: 'paste', path: active.path, text}); },
      onCursor: ({line, column}) => { refs.cursor.textContent = `Ln ${line}, Col ${column}`; }
    });

    refs.testsCount = el('span', {class: 'count', text: '–'});
    refs.testsTab = el('button', {class: 'panel-tab', onclick: () => setPanel('tests')}, 'Tests', refs.testsCount);
    refs.outputTab = el('button', {class: 'panel-tab', onclick: () => setPanel('output')}, 'Output');
    refs.runStatus = el('span', {class: 'run-status'});
    refs.runButton = el('button', {class: 'button primary small', onclick: () => runCode()});
    refs.runCaret = el('button', {class: 'button primary small caret', 'aria-label': 'Choose what to run', onclick: event => runMenu(event.currentTarget)}, '▾');
    refs.panelBody = el('div', {class: 'panel-body'});
    const bottom = el('section', {class: 'bottom'},
      el('div', {class: 'bottom-bar'}, refs.testsTab, refs.outputTab,
        el('div', {class: 'run-group'}, refs.runStatus, el('div', {class: 'split-button'}, refs.runButton, refs.runCaret))),
      refs.panelBody);
    const bottomSplit = el('div', {class: 'splitter horizontal', role: 'separator', 'aria-orientation': 'horizontal'});
    const center = el('section', {class: 'center'}, refs.tabsRow, editorHost, bottomSplit, bottom);

    refs.instructionsTab = el('button', {class: 'side-tab', onclick: () => setSide('instructions')}, icon('file'), 'Instructions');
    refs.unread = el('span', {class: 'unread', hidden: true});
    refs.assistantTab = el('button', {class: 'side-tab', onclick: () => setSide('assistant')}, icon('spark'), 'AI Assistant', refs.unread);
    refs.instructions = el('div', {class: 'instructions'});
    refs.assistant = buildAssistant();
    refs.sidePanel = el('div', {class: 'side-panel'});
    const side = el('aside', {class: 'side', 'aria-label': 'Instructions and AI assistant'}, el('div', {class: 'side-tabs', role: 'tablist'}, refs.instructionsTab, refs.assistantTab), refs.sidePanel);

    const explorerSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
    const panelSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
    root.append(top, el('div', {class: 'ide-main'}, explorer, explorerSplit, center, panelSplit, side));
    splitter(explorerSplit, '--explorer-w', x => x - explorer.getBoundingClientRect().left, 150, 420);
    splitter(panelSplit, '--panel-w', x => window.innerWidth - x, 300, 760);
    splitter(bottomSplit, '--bottom-h', (x, y) => center.getBoundingClientRect().bottom - y, 90, 640);
    root.onkeydown = event => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 's' && event.target.closest('.code-editor') === null) { event.preventDefault(); saveAndRun(); }
    };
  }

  function splitter(handle, variable, measure, min, max) {
    handle.addEventListener('pointerdown', start => {
      start.preventDefault();
      handle.setPointerCapture(start.pointerId);
      handle.classList.add('dragging');
      const move = e => {
        const size = Math.round(Math.min(max, Math.max(min, measure(e.clientX, e.clientY))));
        root.style.setProperty(variable, size + 'px');
      };
      const up = () => {
        handle.classList.remove('dragging');
        handle.removeEventListener('pointermove', move);
        const sizes = store.get('dg-ide-sizes', {});
        sizes[variable] = parseInt(root.style.getPropertyValue(variable), 10);
        store.set('dg-ide-sizes', sizes);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up, {once: true});
      handle.addEventListener('pointercancel', up, {once: true});
    });
  }

  function renderAll() {
    renderStepper();
    renderTree();
    renderTabs();
    renderRunBar();
    renderPanel();
    setSide(sideTab, false);
    renderInstructions();
    refs.submit.disabled = !live();
    if (active) editor.setReadOnly(active.readonly || !live());
  }

  // ---------- phases ----------
  function phaseState(index) {
    const record = session.phases[index];
    if (!record) return 'locked';
    if (record.passedAt) return 'passed';
    if (record.skippedAt) return 'skipped';
    return index + 1 === session.unlocked ? 'current' : 'incomplete';
  }

  function renderStepper() {
    const items = [];
    session.problem.phases.forEach((phase, index) => {
      const state = phaseState(index);
      if (index) items.push(el('span', {class: 'step-line', 'aria-hidden': 'true'}));
      const current = index + 1 === session.unlocked && session.status === 'active';
      items.push(el('span', {class: `step ${state}${current ? ' current' : ''}`, role: 'listitem', title: `Phase ${index + 1}: ${state}`},
        el('span', {class: 'dot'}, state === 'passed' ? icon('check') : String(index + 1)),
        el('span', {class: 'label', text: KIND_LABEL[phase.kind]})));
    });
    refs.stepper.replaceChildren(...items);
  }

  function renderInstructions() {
    const container = refs.instructions;
    const nodes = [];
    const overview = el('details', {class: 'overview-card'}, el('summary', {text: 'About this codebase'}), el('div', {class: 'md'}, renderMarkdown(session.problem.overview)));
    overview.open = overviewOpen;
    overview.addEventListener('toggle', () => { overviewOpen = overview.open; });
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
      if (phase.locked) {
        card.append(el('p', {class: 'phase-locked', text: `Unlocks when you finish or skip phase ${number - 1}.`}));
      } else {
        const body = el('div', {class: 'phase-body'});
        const md = el('div', {class: 'md'}, renderMarkdown(phase.instructions));
        if (isCurrent || state === 'current') body.append(md);
        else body.append(el('details', {}, el('summary', {class: 'button link', text: 'Show instructions'}), md));
        const hints = session.hintsShown?.[index] || [];
        if (hints.length) body.append(el('ul', {class: 'hint-list'}, hints.map((hint, i) => el('li', {}, icon('bulb'), el('div', {}, el('strong', {text: `Hint ${i + 1}. `}), el('span', {class: 'md'}, renderMarkdown(hint)))))));
        if (isCurrent && live()) {
          const record = session.phases[index];
          const actions = el('div', {class: 'phase-actions'});
          if (record.passedAt) {
            body.append(el('div', {class: 'success-banner'}, icon('check'), `All phase ${number} tests pass.`));
            if (number < session.problem.phases.length) actions.append(el('button', {class: 'button primary', onclick: event => advance(event.currentTarget, false)}, `Continue to phase ${number + 1} →`));
            else actions.append(el('button', {class: 'button primary', onclick: () => submitSession()}, 'Submit for feedback'));
          } else {
            const used = hints.length;
            actions.append(el('button', {class: 'button small', disabled: used >= phase.hintCount, onclick: event => takeHint(event.currentTarget)}, icon('bulb'), used >= phase.hintCount ? 'No more hints' : `Get a hint (${used}/${phase.hintCount})`));
            if (number < session.problem.phases.length) actions.append(el('button', {class: 'button link small', onclick: event => advance(event.currentTarget, true)}, `Skip to phase ${number + 1}`));
          }
          body.append(actions);
        }
        card.append(body);
      }
      nodes.push(card);
    });
    if (session.status !== 'active') nodes.push(el('div', {class: 'notice-banner info'}, el('p', {text: 'This session is no longer active. Answer the debrief questions to see your feedback.'})));
    container.replaceChildren(...nodes);
  }

  async function takeHint(button) {
    button.disabled = true;
    try {
      const result = await api('/api/practice/hint', {id});
      apply(result.practice);
      renderInstructions();
    } catch (error) { notify(error.message, 'error'); button.disabled = false; }
  }

  async function advance(button, skip) {
    if (skip) {
      const ok = await confirmDialog({title: `Skip to phase ${session.unlocked + 1}?`, body: 'Phase tests still run, and skipping is recorded in your feedback. You can keep working on this phase\'s code later.', confirm: 'Skip ahead', cancel: 'Stay'});
      if (!ok) return;
    }
    button.disabled = true;
    try {
      await saveAll();
      const result = await api('/api/practice/advance', {id, skip});
      apply(result.practice);
      for (const name of result.added) newFiles.add(name);
      renderAll();
      refs.sidePanel.scrollTop = 0;
      notify(`Phase ${session.unlocked} unlocked${result.added.length ? ': ' + result.added.join(', ') + ' added' : ''}.`, 'success');
      const test = result.added.find(name => name.startsWith('tests/'));
      if (test) await openFile(test);
    } catch (error) { notify(error.message, 'error'); button.disabled = false; }
  }

  // ---------- files ----------
  function renderTree() {
    const tree = {};
    for (const name of session.files) {
      let node = tree;
      const parts = name.split('/');
      parts.forEach((part, i) => {
        if (i === parts.length - 1) node[part] = name;
        else node = node[part + '/'] ||= {};
      });
    }
    const rows = [];
    const walk = (node, depth, prefix) => {
      const entries = Object.keys(node).sort((a, b) => (b.endsWith('/') - a.endsWith('/')) || a.localeCompare(b));
      for (const key of entries) {
        if (key.endsWith('/')) {
          const folder = prefix + key;
          const open = !collapsed.has(folder);
          rows.push(el('button', {class: `tree-row${open ? ' open' : ''}`, style: `padding-left:${10 + depth * 14}px`, role: 'treeitem', 'aria-expanded': String(open), onclick: () => { open ? collapsed.add(folder) : collapsed.delete(folder); store.set('dg-tree-collapsed', [...collapsed]); renderTree(); }},
            icon('chevron', 'icon chev'), icon('folder'), key.slice(0, -1)));
          if (open) walk(node[key], depth + 1, folder);
        } else {
          const path = node[key];
          const readonly = session.readonly.includes(path);
          rows.push(el('button', {class: `tree-row${active?.path === path ? ' active' : ''}`, style: `padding-left:${24 + depth * 14}px`, role: 'treeitem', title: path, onclick: () => openFile(path).catch(error => notify(error.message, 'error'))},
            icon('file'), key,
            newFiles.has(path) ? el('span', {class: 'new-badge', text: 'NEW'}) : readonly ? icon('lock', 'icon lock') : null));
        }
      }
    };
    walk(tree, 0, '');
    refs.tree.replaceChildren(...rows);
  }

  function renderTabs() {
    refs.tabs.replaceChildren(...tabs.map(tab => el('button', {class: `file-tab${tab === active ? ' active' : ''}`, role: 'tab', 'aria-selected': String(tab === active), title: tab.path, onclick: event => { if (!event.target.closest('.close')) openFile(tab.path); }},
      tab.readonly ? icon('lock', 'icon') : null,
      tab.path.split('/').pop(),
      dirty(tab) ? el('span', {class: 'dirty', title: 'Unsaved changes'}) : null,
      el('span', {class: 'close', role: 'button', 'aria-label': `Close ${tab.path}`, onclick: () => closeTab(tab)}, '×'))));
    renderSaveState();
  }

  function renderSaveState() {
    refs.saveState.textContent = !active ? '' : active.readonly ? 'Read-only' : dirty(active) ? 'Unsaved' : 'Saved';
  }

  async function openFile(path) {
    if (active) {
      active.view = editor.viewState();
      if (dirty(active)) await saveTab(active).catch(error => notify(error.message, 'error'));
    }
    let tab = tabs.find(t => t.path === path);
    if (!tab) {
      const file = await api(`/api/practice/file?id=${id}&path=${encodeURIComponent(path)}`);
      tab = {path, content: file.content, saved: file.content, readonly: file.readonly || session.readonly.includes(path)};
      tabs.push(tab);
      event({type: 'open', path});
    }
    active = tab;
    newFiles.delete(path);
    editor.setDocument(tab.content, {language: languageOf(path), readOnly: tab.readonly || !live()});
    editor.restore(tab.view);
    renderTabs();
    renderTree();
    if (!tab.readonly) editor.focus();
  }

  async function closeTab(tab) {
    if (dirty(tab)) await saveTab(tab).catch(error => notify(error.message, 'error'));
    const index = tabs.indexOf(tab);
    tabs.splice(index, 1);
    if (active === tab) {
      active = null;
      const next = tabs[index] || tabs[index - 1];
      if (next) await openFile(next.path);
      else { editor.setDocument('', {placeholder: 'Open a file from the explorer.'}); renderTabs(); renderTree(); }
    } else renderTabs();
  }

  async function saveTab(tab) {
    if (!dirty(tab) || !live()) return;
    const content = tab.content;
    await api('/api/practice/file', {id, path: tab.path, content});
    tab.saved = content;
    renderTabs();
  }

  async function saveAll() {
    if (active) active.content = editor.value;
    for (const tab of tabs) if (dirty(tab)) await saveTab(tab);
  }

  async function newFile() {
    if (!live()) return;
    const suggestion = session.language === 'python' ? 'tests/test_custom.py' : 'tests/custom.test.js';
    const input = el('input', {value: suggestion, maxlength: 300, 'aria-label': 'File path', style: 'width:100%'});
    const create = async () => {
      const name = input.value.trim();
      dialog.close();
      dialog.remove();
      if (!name) return;
      const template = /test/.test(name) ? (session.language === 'python'
        ? 'import unittest\n\n\nclass CustomTests(unittest.TestCase):\n    def test_example(self):\n        self.assertTrue(True)\n'
        : "const { test } = require('node:test');\nconst assert = require('node:assert/strict');\n\ntest('example', () => {\n  assert.equal(1 + 1, 2);\n});\n") : '';
      try {
        const result = await api('/api/practice/file/create', {id, path: name, content: template});
        session.files = result.files;
        renderTree();
        await openFile(name);
      } catch (error) { notify(error.message, 'error'); }
    };
    const form = el('form', {onsubmit: event => { event.preventDefault(); create(); }},
      el('h2', {text: 'New file'}),
      el('p', {text: 'Use a relative path. Test files named like the suggestion run with every test run.'}),
      input,
      el('div', {class: 'dialog-actions'}, el('button', {class: 'button ghost', type: 'button', onclick: () => { dialog.close(); dialog.remove(); }}, 'Cancel'), el('button', {class: 'button primary', type: 'submit'}, 'Create')));
    const dialog = el('dialog', {class: 'dialog small'}, form);
    document.body.append(dialog);
    dialog.showModal();
    input.select();
  }

  // ---------- running ----------
  function renderRunBar() {
    refs.runButton.replaceChildren(icon('play'), runTarget === 'main' ? `Run ${session.main}` : 'Run tests');
    refs.runButton.disabled = running || !live();
    refs.runCaret.disabled = running || !live();
    if (!running) refs.runStatus.textContent = lastRun ? `Last run ${lastRun.ms} ms` : '';
  }

  function runMenu(anchor) {
    document.querySelector('.menu')?.remove();
    const rect = anchor.getBoundingClientRect();
    const choose = target => { runTarget = target; store.set('dg-run-target', target); menu.remove(); renderRunBar(); runCode(target); };
    const menu = el('div', {class: 'menu', role: 'menu', style: `right:${window.innerWidth - rect.right}px;bottom:${window.innerHeight - rect.top + 6}px`},
      el('button', {class: runTarget === 'tests' ? 'selected' : '', role: 'menuitem', onclick: () => choose('tests')}, 'Run tests', el('span', {class: 'kbd', text: 'Ctrl+Enter'})),
      el('button', {class: runTarget === 'main' ? 'selected' : '', role: 'menuitem', onclick: () => choose('main')}, `Run ${session.main}`));
    document.body.append(menu);
    setTimeout(() => document.addEventListener('pointerdown', function away(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', away); } }), 0);
  }

  async function saveAndRun() {
    try { await saveAll(); } catch (error) { notify(error.message, 'error'); return; }
    if (live()) runCode();
  }

  function appendOutput(stream, text) {
    output.push({stream, text});
    if (panelTab === 'output') renderPanel();
  }

  async function runCode(target = runTarget) {
    if (running) return;
    if (!live()) { notify('This session has ended.', 'error'); return; }
    running = true;
    output = [];
    renderRunBar();
    refs.runStatus.textContent = target === 'main' ? `Running ${session.main}…` : 'Running tests…';
    if (target === 'main') setPanel('output'); else renderPanel();
    try {
      await saveAll();
      let result;
      if (session.language === 'javascript') {
        result = await runInBrowser(target);
        const recorded = await api('/api/practice/result', {id, ...result, output: output.map(o => o.text).join('').slice(-3000)});
        afterRun(result, recorded);
      } else {
        const job = await api('/api/practice/run', {id, target});
        result = await waitJob(job, message => { refs.runStatus.textContent = message; });
        output = result.output ? [{stream: 'stdout', text: result.output}] : [];
        afterRun(result, result);
      }
    } catch (error) {
      output.push({stream: 'stderr', text: error.message});
      setPanel('output');
      notify(error.message, 'error');
    } finally {
      running = false;
      renderRunBar();
      renderPanel();
    }
  }

  function afterRun(result, recorded) {
    lastRun = {...result, summary: recorded.summary};
    apply(recorded.practice);
    renderStepper();
    renderInstructions();
    refs.submit.disabled = !live();
    if (result.target === 'main' && result.exitCode) setPanel('output');
    if (result.timedOut) notify('The run was stopped after 30 seconds. Look for an infinite loop or a very slow test.', 'error');
    for (const phase of recorded.newlyPassed || []) {
      notify(phase < session.problem.phases.length ? `Phase ${phase} passed! Continue to phase ${phase + 1} when you're ready.` : 'All phases pass! Submit when you are ready.', 'success');
      setSide('instructions');
    }
  }

  async function runInBrowser(target) {
    const bundle = await api('/api/practice/bundle?id=' + id);
    return new Promise(resolve => {
      const worker = new Worker('/runner-worker.js', {type: 'module'});
      const results = [];
      const started = performance.now();
      let finished = false;
      const finish = done => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        worker.terminate();
        if (done.timedOut) {
          const file = results.at(-1)?.file || bundle.tests[0];
          results.push({file, name: 'Run stopped after 30 seconds', status: 'error', ms: RUN_TIMEOUT, message: 'A test is taking too long or looping forever. Tests after this point did not run.'});
          output.push({stream: 'stderr', text: '\n[Stopped: the run exceeded 30 seconds]\n'});
        }
        resolve({target, tests: bundle.tests, results, exitCode: done.exitCode ?? (results.some(r => r.status === 'fail' || r.status === 'error') ? 1 : 0), ms: Math.round(performance.now() - started), timedOut: !!done.timedOut});
      };
      const timeout = setTimeout(() => finish({timedOut: true}), RUN_TIMEOUT);
      worker.onmessage = ({data}) => {
        if (data.type === 'log') appendOutput(data.stream, data.text);
        else if (data.type === 'test') { results.push(data); lastRun = {target, tests: bundle.tests, results, live: true}; if (panelTab === 'tests') renderPanel(); }
        else if (data.type === 'done') finish(data);
      };
      worker.onerror = error => { error.preventDefault?.(); output.push({stream: 'stderr', text: `Runner error: ${error.message || 'the worker failed to start'}\n`}); finish({exitCode: 1}); };
      worker.postMessage({files: bundle.files, mode: target === 'main' ? 'main' : 'tests', testFiles: bundle.tests, main: bundle.main});
    });
  }

  function setPanel(name) {
    panelTab = name;
    refs.testsTab.classList.toggle('active', name === 'tests');
    refs.outputTab.classList.toggle('active', name === 'output');
    renderPanel();
  }

  function phaseOfFile(file) {
    for (let n = 1; n <= 3; n++) {
      const name = session.language === 'python' ? `tests/test_phase${n}.py` : `tests/phase${n}.test.js`;
      if (file === name) return n;
    }
    return null;
  }

  function renderPanel() {
    refs.testsTab.classList.toggle('active', panelTab === 'tests');
    refs.outputTab.classList.toggle('active', panelTab === 'output');
    const results = lastRun?.target === 'tests' ? lastRun.results || [] : session.lastRun && !lastRun ? [] : lastRun?.results || [];
    const counted = results.filter(r => r.status !== 'skip');
    const passed = counted.filter(r => r.status === 'pass').length;
    if (lastRun?.target === 'tests' || (lastRun?.results?.length)) {
      refs.testsCount.textContent = `${passed}/${counted.length}`;
      refs.testsCount.className = `count ${counted.length && passed === counted.length ? 'good' : counted.length ? 'bad' : ''}`;
    } else if (session.lastRun?.phases) {
      const phases = Object.values(session.lastRun.phases);
      const p = phases.reduce((s, x) => s + x.passed, 0), t = phases.reduce((s, x) => s + x.total, 0);
      refs.testsCount.textContent = t ? `${p}/${t}` : '–';
      refs.testsCount.className = `count ${t && p === t ? 'good' : t ? 'bad' : ''}`;
    } else { refs.testsCount.textContent = '–'; refs.testsCount.className = 'count'; }
    if (panelTab === 'output') {
      const pre = el('pre', {class: 'output-view'});
      if (!output.length) pre.append(el('span', {class: 'meta', text: running ? 'Running…' : 'Program output appears here. Use Run ▾ to run ' + session.main + '.'}));
      for (const chunk of output) pre.append(chunk.stream === 'stderr' ? el('span', {class: 'stderr', text: chunk.text}) : chunk.text);
      refs.panelBody.replaceChildren(pre);
      refs.panelBody.scrollTop = refs.panelBody.scrollHeight;
      return;
    }
    if (!lastRun || lastRun.target !== 'tests') {
      const summary = session.lastRun;
      refs.panelBody.replaceChildren(el('div', {class: 'placeholder'}, running ? el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Running tests…')
        : summary?.phases && summary.target === 'tests' ? `Last recorded run: ${Object.entries(summary.phases).map(([n, p]) => `phase ${n} ${p.passed}/${p.total}`).join(' · ')}. Run the tests again to see details.`
        : 'Run the tests to see results. Ctrl+S saves and runs; Ctrl+Enter runs.'));
      return;
    }
    const order = [...(lastRun.tests || []), ...new Set(results.map(r => r.file))].filter((file, i, all) => all.indexOf(file) === i);
    const groups = order.map(file => {
      const rows = results.filter(r => r.file === file);
      const phase = phaseOfFile(file);
      const total = rows.filter(r => r.status !== 'skip').length;
      const ok = rows.filter(r => r.status === 'pass').length;
      const details = el('details', {class: 'test-group', open: total !== ok || !rows.length},
        el('summary', {}, icon('chevron', 'icon chev'), phase ? `Phase ${phase}` : 'Your tests', el('span', {class: 'problem-meta', style: 'margin:0', text: file}),
          el('span', {class: `meta ${rows.length ? (ok === total ? 'good' : 'bad') : ''}`, text: rows.length ? `${ok}/${total} passed` : running ? 'running…' : 'not run'})));
      for (const row of rows) {
        const line = el('div', {class: `test-row ${row.status}`}, icon(row.status === 'pass' ? 'check' : row.status === 'skip' ? 'chevron' : 'cross'), el('span', {text: row.name}), el('span', {class: 'ms', text: row.ms ? `${row.ms} ms` : ''}));
        if (row.message || row.stack) line.append(el('pre', {class: 'failure', text: [row.message, row.stack].filter(Boolean).join('\n')}));
        details.append(line);
      }
      return details;
    });
    refs.panelBody.replaceChildren(el('div', {class: 'tests-view'}, groups.length ? groups : el('div', {class: 'placeholder', text: 'No tests ran.'})));
  }

  // ---------- assistant ----------
  function buildAssistant() {
    refs.model = el('select', {'aria-label': 'Model', onchange: () => store.set('dg-model', refs.model.value)});
    refs.context = el('span', {class: 'context-chip'}, icon('file'), 'Reads your project files');
    refs.messages = el('div', {class: 'messages', role: 'log', 'aria-live': 'polite'});
    refs.prompt = el('textarea', {rows: 1, placeholder: 'Ask the AI assistant…', 'aria-label': 'Message the AI assistant', maxlength: 12000});
    refs.send = el('button', {class: 'icon-button', 'aria-label': 'Send', title: 'Send (Enter)', onclick: () => send()}, icon('send'));
    refs.prompt.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); }
    });
    refs.prompt.addEventListener('input', () => { refs.prompt.style.height = 'auto'; refs.prompt.style.height = Math.min(180, refs.prompt.scrollHeight) + 'px'; });
    return el('div', {class: 'assistant'},
      el('div', {class: 'assistant-head'}, el('span', {text: 'Model'}), refs.model, refs.context),
      refs.messages,
      el('div', {class: 'composer'}, el('div', {class: 'composer-box'}, refs.prompt, refs.send), el('div', {class: 'hint', text: 'Enter to send · Shift+Enter for a new line · It can read your files but can\'t edit them or run code'})));
  }

  async function loadModels() {
    try {
      models = await api('/api/models');
      const preferred = store.get('dg-model', null);
      refs.model.replaceChildren(...models.models.map(m => el('option', {value: m.name, text: `${m.name}${m.parameterSize ? ' · ' + m.parameterSize : ''}`})));
      refs.model.value = models.models.some(m => m.name === preferred) ? preferred : models.assistant || models.models[0]?.name || '';
      if (!models.models.length) refs.model.append(el('option', {value: '', text: 'No models installed'}));
    } catch {
      refs.model.replaceChildren(el('option', {value: '', text: 'Ollama not running'}));
    }
    renderMessages();
  }

  function setSide(name, focus = true) {
    sideTab = name;
    refs.instructionsTab.classList.toggle('active', name === 'instructions');
    refs.assistantTab.classList.toggle('active', name === 'assistant');
    if (name === 'assistant') { unread = false; refs.unread.hidden = true; }
    const panel = name === 'assistant' ? refs.assistant : refs.instructions;
    if (refs.sidePanel.firstChild !== panel) refs.sidePanel.replaceChildren(panel);
    if (name === 'assistant') { renderMessages(); if (focus) refs.prompt.focus(); }
  }

  function messageNode(message) {
    if (message.role === 'user') return el('div', {class: 'msg user', text: message.content});
    const md = el('div', {class: 'md'}, renderMarkdown(message.content, {language: session.language, onCopy: code => event({type: 'copy', chars: code.length})}));
    return el('div', {class: 'msg assistant'}, el('div', {class: 'who'}, icon('spark'), message.model || 'Assistant', message.stopped ? ' · stopped' : ''), md);
  }

  function renderMessages() {
    if (!refs.messages) return;
    const nodes = session.chat.map(messageNode);
    if (!nodes.length && !streaming) {
      nodes.push(el('div', {class: 'assistant-empty'},
        el('h3', {text: 'Your AI pair'}),
        el('p', {text: `The assistant sees your project files${active ? ', with ' + active.path + ' as the open file' : ''}, the current phase and your latest test run.`}),
        el('ul', {}, el('li', {text: 'Read the code and form a plan before your first prompt.'}), el('li', {text: 'Name the files, functions and constraints you care about.'}), el('li', {text: 'Review what comes back, paste it yourself, then run the tests.'}))));
    }
    if (streaming) nodes.push(el('div', {class: 'msg user', text: streaming.question}), streaming.node);
    refs.messages.replaceChildren(...nodes);
    refs.messages.scrollTop = refs.messages.scrollHeight;
  }

  async function send() {
    if (streaming) { streaming.controller.abort(); return; }
    const question = refs.prompt.value.trim();
    if (!question) return;
    if (!live()) { notify('This session has ended.', 'error'); return; }
    try { await saveAll(); } catch {}
    const controller = new AbortController();
    const md = el('div', {class: 'md'}, el('p', {}, el('span', {class: 'spinner', style: 'display:inline-block;vertical-align:middle'}), ' Thinking…'));
    const node = el('div', {class: 'msg assistant streaming'}, el('div', {class: 'who'}, icon('spark'), refs.model.value || 'Assistant'), md);
    streaming = {controller, question, node, text: ''};
    refs.prompt.value = '';
    refs.prompt.style.height = 'auto';
    refs.send.replaceChildren(icon('stop'));
    refs.send.title = 'Stop generating';
    renderMessages();
    let frame = null, failure = null, model = refs.model.value;
    const paint = () => { frame = null; md.replaceChildren(renderMarkdown(streaming.text || '…', {language: session.language, onCopy: code => event({type: 'copy', chars: code.length})})); refs.messages.scrollTop = refs.messages.scrollHeight; };
    try {
      const response = await fetch('/api/practice/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal, body: JSON.stringify({id, message: question, model, openFile: active?.path})});
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'The assistant is unavailable.'); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (!line) continue;
          const part = JSON.parse(line);
          if (part.model) model = part.model;
          if (part.delta) { streaming.text += part.delta; if (!frame) frame = requestAnimationFrame(paint); }
          if (part.error) failure = part.error;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) failure = error.message;
    }
    const text = streaming.text;
    const stopped = controller.signal.aborted;
    streaming = null;
    if (frame) cancelAnimationFrame(frame);
    session.chat.push({role: 'user', content: question, at: Date.now()});
    if (text) session.chat.push({role: 'assistant', content: text, model, stopped, at: Date.now()});
    refs.send.replaceChildren(icon('send'));
    refs.send.title = 'Send (Enter)';
    renderMessages();
    if (failure) {
      refs.messages.append(el('div', {class: 'msg error', text: failure}));
      if (!text) { session.chat.pop(); refs.prompt.value = question; }
    }
    if (sideTab !== 'assistant') { unread = true; refs.unread.hidden = false; }
  }

  // ---------- time & submission ----------
  function tick() {
    if (!session) return;
    const ms = session.deadline - (Date.now() + skew);
    const shown = session.status === 'active' ? ms : Math.max(0, session.deadline - (session.ended || session.deadline));
    refs.timer.replaceChildren(icon('clock'), session.status === 'active' ? clock(shown) : 'Ended');
    refs.timer.className = `timer${session.status === 'active' && ms < 300000 ? ' danger' : session.status === 'active' && ms < 600000 ? ' warn' : ''}`;
    if (session.status === 'active' && ms <= 0 && !ending) timeUp();
  }

  async function timeUp() {
    ending = true;
    editor.setReadOnly(true);
    notify("Time's up. Answer the debrief questions to get your feedback.");
    try { await refresh(); } catch {}
    showDebrief();
  }

  async function submitSession() {
    if (!live()) { showDebrief(); return; }
    const passed = session.phases.filter(p => p.passedAt).length;
    const ok = await confirmDialog({title: 'Submit your session?', body: `You've passed ${passed} of ${session.problem.phases.length} phases. Submitting ends the timer, and then you'll answer three short debrief questions.`, confirm: 'Submit', cancel: 'Keep working'});
    if (!ok) return;
    try {
      await saveAll();
      apply(await api('/api/practice/submit', {id}));
      renderAll();
      showDebrief();
    } catch (error) { notify(error.message, 'error'); }
  }

  function showDebrief() {
    if (debriefDialog) return;
    ending = true;
    editor?.setReadOnly(true);
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
      el('div', {class: 'dialog-actions'}, status, el('button', {class: 'button ghost', onclick: () => { dialog.close(); close(); onLeave(); }}, 'Finish later'), submit));
    dialog.addEventListener('cancel', event => event.preventDefault());
    submit.onclick = async () => {
      submit.disabled = true;
      status.hidden = false;
      try {
        const result = await api('/api/practice/debrief', {id, answers: fields.map(f => f.value)});
        const view = result.job ? await waitJob(result, message => { status.lastChild.textContent = message; }) : result.practice;
        store.remove('dg-debrief-' + id);
        dialog.close();
        close();
        onFinished(view.id || id);
      } catch (error) {
        notify(error.message, 'error');
        submit.disabled = false;
        status.hidden = true;
      }
    };
    debriefDialog = dialog;
    document.body.append(dialog);
    dialog.showModal();
    if (session.status === 'reviewing') {
      status.hidden = false;
      status.lastChild.textContent = 'A review was in progress. Press "Get my feedback" if it does not finish shortly.';
      const poll = setInterval(async () => {
        if (!debriefDialog) { clearInterval(poll); return; }
        try { const view = await api('/api/practice?id=' + id); if (view.status === 'ended') { clearInterval(poll); dialog.close(); close(); onFinished(id); } } catch {}
      }, 3000);
    }
  }

  return {open, close, get id() { return id; }};
}
