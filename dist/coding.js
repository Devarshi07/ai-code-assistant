// Coding questions: the question library with filters, and the coding
// workspace (statement, editor, Run Code / Submit Code, test results,
// submissions and the AI assistant).
import {el, api, waitJob, notify, confirmDialog, store, icon, splitter, DIFFICULTY_CLASS} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {loadMonaco, editorOptions, applySettings, setInlineSource, settings, monacoLanguage, applyKeymap, KEYMAP_LABEL} from './monaco.js';
import {createAssistant, ago} from './assistant-ui.js';
import {enterFullscreen} from './app.js';

const LANGUAGE_LABEL = {python: 'Python 3', javascript: 'JavaScript (Node.js)', java: 'Java 21', cpp: 'C++20', go: 'Go', sql: 'SQL (SQLite)'};
const VERDICT = {success: 'Success', wrong: 'Wrong Answer', runtime: 'Runtime Error', timeout: 'Terminated due to timeout', compile: 'Compilation error', output: 'Output limit exceeded'};
const EXT = {python: 'py', javascript: 'js', java: 'java', cpp: 'cpp', go: 'go', sql: 'sql'};
// Question kinds beyond classic algorithm problems.
const KIND_LABEL = {ml: 'Machine learning', sql: 'SQL', rest: 'REST API client', api: 'Build an API'};
const CUSTOM_PLACEHOLDER = {
  sql: 'SQL that creates and fills the tables, then Run Code runs your query against them.',
  rest: 'Your program\'s stdin. The first sample\'s API data is served to it.',
  api: 'One JSON request per line, such as {"method": "GET", "path": "/tasks"}.'
};

// ---------- library ----------
export async function renderLibrary(root) {
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading questions…'));
  const questions = await api('/api/coding/questions');
  const filters = {status: [], difficulty: [], skills: [], search: '', track: 'all', ...store.get('dg-question-filters', {})};
  const skills = [...new Set(questions.flatMap(q => q.skills))].sort();
  // Tracks group the bank the way assessments do: algorithms, ML, SQL and API questions.
  const TRACKS = [['all', 'All'], ['algorithms', 'Algorithms'], ['ml', 'Machine learning'], ['sql', 'SQL'], ['api', 'APIs']];
  const trackOf = q => q.kind === 'ml' ? 'ml' : q.kind === 'sql' ? 'sql' : q.kind === 'rest' || q.kind === 'api' ? 'api'
    : q.skills.includes('Machine Learning') ? 'ml' : q.skills.includes('SQL') ? 'sql' : q.skills.some(s => s === 'REST APIs' || s === 'API Design') ? 'api' : 'algorithms';
  const trackBar = el('div', {class: 'segmented track-bar', role: 'radiogroup', 'aria-label': 'Question track'});
  const list = el('div', {class: 'challenge-list'});
  const count = el('span', {class: 'muted'});
  const paint = () => {
    store.set('dg-question-filters', filters);
    trackBar.replaceChildren(...TRACKS.filter(([id]) => id === 'all' || questions.some(q => trackOf(q) === id)).map(([id, label]) => el('button', {class: filters.track === id ? 'active' : '', role: 'radio', 'aria-checked': String(filters.track === id), onclick: () => { filters.track = id; paint(); }},
      label, id !== 'all' ? el('span', {class: 'track-count', text: String(questions.filter(q => trackOf(q) === id).length)}) : null)));
    const needle = filters.search.trim().toLowerCase();
    const shown = questions.filter(q =>
      (filters.track === 'all' || trackOf(q) === filters.track) &&
      (!filters.status.length || filters.status.includes(q.status === 'solved' ? 'solved' : 'unsolved')) &&
      (!filters.difficulty.length || filters.difficulty.includes(q.difficulty)) &&
      (!filters.skills.length || q.skills.some(s => filters.skills.includes(s))) &&
      (!needle || q.title.toLowerCase().includes(needle) || q.summary.toLowerCase().includes(needle)));
    count.textContent = `${shown.length} of ${questions.length} questions`;
    list.replaceChildren(...(shown.length ? shown.map(q => el('article', {class: `challenge-card ${q.status}`},
      el('div', {class: 'challenge-main'},
        el('h3', {}, el('a', {href: `#/question/${q.id}`, text: q.title})),
        el('div', {class: 'challenge-meta'},
          el('span', {class: `difficulty ${DIFFICULTY_CLASS[q.difficulty]}`, text: q.difficulty}),
          KIND_LABEL[q.kind] ? el('span', {class: `kind-chip ${q.kind}`, text: KIND_LABEL[q.kind]}) : null,
          el('span', {text: `Max score: ${q.maxScore}`}),
          el('span', {text: q.skills.join(', ')})),
        el('p', {class: 'challenge-summary', text: q.summary})),
      el('div', {class: 'challenge-side'},
        q.status === 'solved' ? el('span', {class: 'solved-mark'}, icon('check'), 'Solved') : q.status === 'attempted' ? el('span', {class: 'muted small', text: q.best ? `Best ${q.best.score}/${q.maxScore}` : 'Attempted'}) : null,
        el('a', {class: `button ${q.status === 'solved' ? '' : 'primary'} small`, href: `#/question/${q.id}`}, q.status === 'solved' ? 'Solve again' : q.status === 'attempted' ? 'Continue' : 'Solve challenge'))))
      : [el('div', {class: 'empty-state', text: questions.length ? 'No questions match these filters.' : 'No questions found in questions/. Run node scripts/validate-questions.mjs to check them.'})]));
  };
  const group = (title, key, values, labels = {}) => el('fieldset', {class: 'filter-group'}, el('legend', {text: title}),
    values.map(value => el('label', {class: 'filter-check'}, el('input', {type: 'checkbox', checked: filters[key].includes(value), onchange: event => {
      filters[key] = event.target.checked ? [...filters[key], value] : filters[key].filter(v => v !== value);
      paint();
    }}), labels[value] || value)));
  const search = el('input', {type: 'search', class: 'search-input', placeholder: 'Search questions', value: filters.search, 'aria-label': 'Search questions', oninput: event => { filters.search = event.target.value; paint(); }});
  const solved = questions.filter(q => q.status === 'solved').length;
  root.replaceChildren(
    el('div', {class: 'page-title'}, el('h1', {text: 'Coding questions'}), el('span', {class: 'title-badge', text: `${solved}/${questions.length} solved`})),
    el('p', {class: 'page-lead', text: 'Assessment-style problems with sample and hidden test cases: algorithms in Python, JavaScript, Java, C++ or Go, plus machine learning, SQL and API questions. Run against the samples, then submit to be scored on every test case. An AI assistant sits beside the editor.'}),
    trackBar,
    el('div', {class: 'library-layout'},
      el('div', {}, el('div', {class: 'library-tools'}, search, count), list),
      el('aside', {class: 'filters', 'aria-label': 'Filters'},
        group('Status', 'status', ['solved', 'unsolved'], {solved: 'Solved', unsolved: 'Unsolved'}),
        group('Difficulty', 'difficulty', ['Easy', 'Medium', 'Hard']),
        group('Skills', 'skills', skills),
        el('button', {class: 'button link small', onclick: () => { filters.status = []; filters.difficulty = []; filters.skills = []; filters.search = ''; filters.track = 'all'; search.value = ''; store.set('dg-question-filters', filters); renderLibrary(root); }}, 'Clear filters'))));
  paint();
}

// ---------- workspace ----------
let current = null;

export async function closeFullscreen() {
  if (!current) return;
  await current.dispose();
  current = null;
}

export async function openQuestion(root, id) {
  if (current?.id === id && !root.hidden) return;
  await closeFullscreen();
  enterFullscreen('coding-ide');
  root.replaceChildren(el('div', {class: 'fs-loading'}, el('span', {class: 'spinner'}), 'Loading the question…'));
  const [question, monaco] = await Promise.all([api(`/api/coding/question?id=${encodeURIComponent(id)}`), loadMonaco()]);
  current = createWorkspace(root, question, monaco);
  document.title = `${question.title} · Debug Gym`;
}

// Mounts a coding question inside a practice test (see tests.js).
export function mountTestQuestion(root, q, monaco, options) {
  return createWorkspace(root, q, monaco, options);
}

// options.test = {id, key}: the question belongs to a practice test, so it
// saves and runs through the test and has no top bar or Submissions tab.
// options.ai = false hides the AI assistant.
function createWorkspace(root, q, monaco, options = {}) {
  const refs = {};
  const test = options.test || null;
  const aiAllowed = options.ai !== false;
  const state = q.state;
  const endpoints = test ? {
    save: (language, code, changed) => api('/api/tests/save', {id: test.id, key: test.key, language, code, changed})
  } : {
    save: (language, code) => api('/api/coding/save', {id: q.id, language, code})
  };
  let language = state.language || store.get('dg-code-language', 'python');
  // SQL, ML and API questions offer only some languages.
  if (!q.languages.some(l => l.id === language)) language = q.languages[0].id;
  const models = {};      // one Monaco model per language keeps undo history
  const templates = {};
  // In tests the assistant starts collapsed, so the editor has room; the toggle opens it.
  const aiKey = test ? 'dg-test-ai-open' : 'dg-coding-ai-open';
  let editor = null, saveTimer = null, running = false, lastResult = null, selectedCase = 0, leftTab = 'problem', aiOpen = aiAllowed && store.get(aiKey, !test);
  let lastRunSummary = '';
  // In tests, edits are recorded for code playback; pastes and AI inserts are tagged.
  let pendingSource = null;
  const takeSource = () => { const source = pendingSource; pendingSource = null; return source; };
  const disposables = [];

  // ---------- layout ----------
  refs.languageSelect = el('select', {class: 'language-select', 'aria-label': 'Language', onchange: () => switchLanguage(refs.languageSelect.value)},
    q.languages.map(l => el('option', {value: l.id, text: l.label})));
  refs.languageSelect.value = language;
  refs.aiToggle = el('button', {class: `button small ai-toggle${aiOpen ? ' active' : ''}`, onclick: () => toggleAi()}, icon('spark'), 'AI Assistant');
  const top = el('header', {class: 'fs-top'},
    el('a', {class: 'icon-button', href: '#/questions', title: 'Back to questions', 'aria-label': 'Back to questions'}, icon('back')),
    el('div', {class: 'fs-title'}, el('strong', {text: q.title}), el('span', {class: `difficulty ${DIFFICULTY_CLASS[q.difficulty]}`, text: q.difficulty}), KIND_LABEL[q.kind] ? el('span', {class: 'chip', text: KIND_LABEL[q.kind]}) : null, el('span', {class: 'chip', text: `Max score ${q.maxScore}`})),
    el('span', {class: 'grow'}),
    refs.aiToggle);

  refs.problemTab = el('button', {class: 'tab', onclick: () => setLeft('problem')}, 'Problem');
  refs.submissionsTab = el('button', {class: 'tab', hidden: !!test, onclick: () => setLeft('submissions')}, 'Submissions');
  refs.leftBody = el('div', {class: 'pane-scroll'});
  // In a test the question header ("Question 2 of 5") replaces the tab row.
  const left = el('section', {class: 'cq-left'}, test ? null : el('div', {class: 'tabs'}, refs.problemTab, refs.submissionsTab), refs.leftBody);

  refs.editorHost = el('div', {class: 'monaco-host'});
  refs.saved = el('span', {class: 'muted small'});
  refs.expand = el('button', {class: 'icon-button', title: 'Expand the editor (hide the problem)', 'aria-label': 'Expand the editor', 'aria-pressed': 'false', onclick: () => toggleLeft()}, icon('expand'));
  const editorBar = el('div', {class: 'editor-bar'},
    refs.languageSelect,
    el('button', {class: 'icon-button', title: 'Execution environment: versions and limits', 'aria-label': 'Execution environment', onclick: () => environmentDialog(q, language)}, icon('info')),
    el('span', {class: 'grow'}),
    refs.saved,
    test && aiAllowed ? refs.aiToggle : null,
    refs.expand,
    el('button', {class: 'icon-button', title: 'Upload code as a file', 'aria-label': 'Upload code as a file', onclick: upload}, icon('upload')),
    el('button', {class: 'icon-button', title: 'Reset to the starter template', 'aria-label': 'Reset to the starter template', onclick: reset}, icon('reset')),
    el('button', {class: 'icon-button', title: 'Editor settings', 'aria-label': 'Editor settings', onclick: event => settingsMenu(event.currentTarget)}, icon('gear')));
  // Status bar: cursor, indentation, autocomplete and editor mode, like assessment editors.
  refs.cursor = el('span');
  refs.statusSpaces = el('span');
  refs.statusAuto = el('span');
  refs.statusMode = el('span');
  refs.keymapStatus = el('span', {class: 'keymap-status'});
  const statusBar = el('div', {class: 'status-bar'}, refs.cursor, refs.statusSpaces, refs.statusAuto, refs.statusMode, refs.keymapStatus);
  refs.runButton = el('button', {class: 'button small', title: 'Run the sample test cases, or your custom input in the Custom tab (Ctrl+Enter)', onclick: () => run('run')}, icon('play'), 'Run Code');
  refs.testsButton = test ? el('button', {class: 'button small', title: 'Run every test case', onclick: () => run('tests')}, 'Run Tests') : null;
  refs.submitButton = el('button', {class: 'button primary small', title: test ? 'Save this answer and go to the next question' : 'Run every test case and record a score (Ctrl+Shift+Enter)', onclick: () => test ? proceed() : run('submit')}, test ? 'Save & Proceed' : 'Submit Code');
  const runBar = el('div', {class: 'run-bar'}, statusBar, el('span', {class: 'grow'}), refs.runButton, refs.testsButton, refs.submitButton);
  // Test Results: the Test Cases tab, and the Custom tab with your own input.
  refs.casesTab = el('button', {class: 'tab', onclick: () => setResultsTab('cases')}, 'Test Cases');
  refs.customTab = el('button', {class: 'tab', onclick: () => setResultsTab('custom')}, 'Custom');
  refs.resultsSummary = el('span', {class: 'results-summary'});
  refs.raw = el('input', {type: 'checkbox', onchange: () => renderResults()});
  refs.customInput = el('textarea', {class: 'custom-input', rows: 5, spellcheck: 'false', 'aria-label': 'Custom input', placeholder: CUSTOM_PLACEHOLDER[q.kind] || 'Type the input your program reads from stdin, then Run Code.'});
  refs.resultsBody = el('div', {class: 'results-body'});
  // Test Results stays folded until the first run, so the editor gets the room.
  refs.resultsFold = el('button', {class: 'icon-button results-fold', title: 'Show or hide test results', 'aria-label': 'Show or hide test results', 'aria-expanded': 'false', onclick: () => setResultsOpen(refs.results.classList.contains('collapsed'))}, icon('caret'));
  refs.results = el('section', {class: 'cq-results collapsed', 'aria-live': 'polite'},
    el('div', {class: 'results-head'}, refs.resultsFold, el('strong', {class: 'results-title', text: 'Test Results', onclick: () => setResultsOpen(refs.results.classList.contains('collapsed'))}), el('div', {class: 'results-tabs'}, refs.casesTab, refs.customTab), el('span', {class: 'grow'}), refs.resultsSummary,
      el('label', {class: 'custom-check', title: 'Show spaces, tabs and line ends'}, refs.raw, 'Raw format')),
    refs.resultsBody);
  const resultsSplit = el('div', {class: 'splitter horizontal', role: 'separator', 'aria-orientation': 'horizontal'});
  const center = el('section', {class: 'cq-center'}, editorBar, refs.editorHost, runBar, resultsSplit, refs.results);
  let resultsTab = 'cases', customResult = null, keymapOff = () => {}, keymapMode = null;

  const assistant = aiAllowed ? createAssistant({
    variant: 'side', modes: ['ask'],
    scope: () => ({scope: 'question', question: q.id, ...(test ? {test: test.id} : {})}),
    context: () => ({language, code: editor?.getValue() || '', lastRun: lastRunSummary, help: test ? 'full' : store.get('dg-help-level', 'full')}),
    codeActions: [{label: 'Insert', title: 'Insert at the cursor in the editor', action: code => insertCode(code)}],
    suggestions: ['Explain the problem with a small example', 'What approach would fit these constraints?', 'Why does my code fail the sample test?', 'What edge cases should I test?']
  }) : null;
  const closeAi = el('button', {class: 'icon-button', title: 'Close the assistant', 'aria-label': 'Close the assistant', onclick: () => toggleAi()}, '×');
  if (assistant && !test) {
    const help = el('select', {class: 'help-select', 'aria-label': 'Help level', title: 'Guided: hints and explanations only, enforced by a guardrail. Full: the assistant may write code.', onchange: event => store.set('dg-help-level', event.target.value)},
      el('option', {value: 'full', text: 'Full help'}), el('option', {value: 'guided', text: 'Guided help'}));
    help.value = store.get('dg-help-level', 'full');
    assistant.setHeaderExtra(help, closeAi);
  } else if (assistant) {
    // The test sets the level; the badge says what the assistant will and won't do.
    const full = options.aiLevel === 'unguarded';
    assistant.setHeaderExtra(el('span', {class: `chip ai-level ${full ? 'full' : 'guarded'}`, title: full ? 'Full help, including code.' : 'Hints, explanations and short snippets. Full solutions are blocked.', text: full ? 'Full help' : 'Guarded: hints only'}), closeAi);
  }
  refs.ai = el('aside', {class: 'cq-ai', 'aria-label': 'AI assistant'}, assistant ? assistant.root : el('span'));

  const leftSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  const aiSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  refs.main = el('div', {class: `cq-main${aiOpen ? ' ai-open' : ''}${test ? ' in-test' : ''}`}, left, leftSplit, center, aiSplit, refs.ai);
  if (test) root.replaceChildren(refs.main); else root.replaceChildren(top, refs.main);
  const sizes = store.get('dg-cq-sizes', {});
  for (const [name, value] of Object.entries(sizes)) refs.main.style.setProperty(name, value + 'px');
  splitter(refs.main, leftSplit, '--cq-left', x => x - refs.main.getBoundingClientRect().left, 260, 900, 'dg-cq-sizes');
  splitter(refs.main, aiSplit, '--cq-ai', x => refs.main.getBoundingClientRect().right - x, 280, 720, 'dg-cq-sizes');
  splitter(refs.main, resultsSplit, '--cq-results', (x, y) => center.getBoundingClientRect().bottom - y, 80, 700, 'dg-cq-sizes');

  // ---------- editor ----------
  editor = monaco.editor.create(refs.editorHost, editorOptions({model: null}));
  disposables.push(editor);
  editor.onDidChangeCursorPosition(e => { refs.cursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`; });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run('run'));
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => test ? run('tests') : run('submit'));
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save(true));
  // Copies inside the editor count as internal, so pasting them back is allowed.
  if (options.onCopy) for (const type of ['copy', 'cut']) refs.editorHost.addEventListener(type, () => {
    const selection = editor.getSelection(), model = editor.getModel();
    if (model && selection) options.onCopy(selection.isEmpty() ? model.getLineContent(selection.startLineNumber) : model.getValueInRange(selection));
  }, true);
  // Pastes from outside the test can be tracked or blocked (secure mode).
  if (options.pasteGuard) refs.editorHost.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text && options.pasteGuard(text) === 'block') { event.preventDefault(); event.stopPropagation(); return; }
    pendingSource = 'paste';
    setTimeout(() => { if (pendingSource === 'paste') pendingSource = null; }, 0);
  }, true);
  const paintStatus = () => {
    const s = settings.get();
    refs.statusSpaces.textContent = `Spaces: ${s.tabSize}`;
    refs.statusAuto.textContent = `Autocomplete: ${s.autocomplete ? 'On' : 'Off'}`;
    refs.statusMode.textContent = `Mode: ${KEYMAP_LABEL[s.keymap] || 'Normal'}`;
  };
  async function updateKeymap() {
    const mode = settings.get().keymap || 'normal';
    if (mode === keymapMode) return;
    keymapMode = mode;
    keymapOff();
    try { keymapOff = await applyKeymap(editor, mode, refs.keymapStatus); }
    catch (error) { keymapOff = () => {}; notify(error.message, 'error'); }
  }
  const onSettings = () => { applySettings(editor); paintStatus(); updateKeymap(); };
  window.addEventListener('dg-editor-settings', onSettings);

  async function template(lang) {
    if (templates[lang] === undefined) templates[lang] = (await api(`/api/coding/template?id=${encodeURIComponent(q.id)}&language=${lang}`)).code;
    return templates[lang];
  }
  async function modelFor(lang) {
    if (models[lang]) return models[lang];
    const text = state.drafts[lang] ?? await template(lang);
    const model = monaco.editor.createModel(text, monacoLanguage(lang), monaco.Uri.parse(`inmemory://question/${q.id}/solution.${EXT[lang]}`));
    model.updateOptions({tabSize: settings.get().tabSize});
    model.onDidChangeContent(event => {
      refs.saved.textContent = 'Unsaved'; clearTimeout(saveTimer); saveTimer = setTimeout(() => save(), 1500);
      options.recorder?.edit(lang, event.changes, model.getValueLength(), takeSource());
    });
    // Inline AI suggestions only where AI help is allowed (in tests: the unguarded level).
    if (options.inline !== false) setInlineSource(model, ({prefix, suffix, signal}) => fetch('/api/assistant/complete', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prefix, suffix, language: lang, scope: 'question', question: q.id, ...(test ? {test: test.id} : {})}), signal}).then(r => r.json()).then(r => r.completion || ''));
    models[lang] = model;
    return model;
  }
  async function switchLanguage(lang) {
    await save();
    language = lang;
    store.set('dg-code-language', lang);
    editor.setModel(await modelFor(lang));
    options.recorder?.snapshot(lang, editor.getValue());
    applySettings(editor);
    editor.focus();
  }
  async function save(explicit = false) {
    clearTimeout(saveTimer);
    const model = models[language];
    if (!model) return;
    const code = model.getValue();
    if (state.drafts[language] === code) { refs.saved.textContent = explicit ? 'Saved' : refs.saved.textContent === 'Unsaved' ? 'Saved' : refs.saved.textContent; return; }
    try {
      await endpoints.save(language, code, code.trim() !== (templates[language] ?? '').trim());
      state.drafts[language] = code;
      refs.saved.textContent = 'Saved';
      options.onChange?.();
    } catch (error) { refs.saved.textContent = 'Not saved'; if (explicit) notify(error.message, 'error'); }
  }
  // Save & Proceed: records this code as the answer and moves on (tests only).
  async function proceed() {
    clearTimeout(saveTimer);
    const code = editor.getValue();
    try {
      await api('/api/tests/save', {id: test.id, key: test.key, language, code, proceed: true});
      state.drafts[language] = code;
      refs.saved.textContent = 'Saved';
      options.onProceed?.();
    } catch (error) { notify(error.message, 'error'); }
  }
  function insertCode(code) {
    const selection = editor.getSelection();
    pendingSource = 'ai';
    editor.executeEdits('assistant', [{range: selection, text: code, forceMoveMarkers: true}]);
    editor.pushUndoStop();
    editor.focus();
    options.onAiInsert?.(code);
    notify('Inserted at the cursor. Review it, then run your code.');
  }
  async function reset() {
    const ok = await confirmDialog({title: 'Reset to the starter template?', body: `Your ${LANGUAGE_LABEL[language]} code is replaced with the original template. You can undo with Ctrl+Z.`, confirm: 'Reset', danger: true});
    if (!ok) return;
    const model = await modelFor(language);
    model.pushEditOperations([], [{range: model.getFullModelRange(), text: await template(language)}], () => null);
    editor.focus();
  }
  function upload() {
    const input = el('input', {type: 'file', accept: '.py,.js,.java,.cpp,.cc,.cxx,.h,.hpp,.go,.sql,.txt'});
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 200000) { notify('That file is larger than 200 KB.', 'error'); return; }
      const text = await file.text();
      const model = await modelFor(language);
      pendingSource = 'upload';
      model.pushEditOperations([], [{range: model.getFullModelRange(), text}], () => null);
      notify(`Loaded ${file.name}.`);
    };
    input.click();
  }
  function settingsMenu(anchor) {
    document.querySelector('.menu.floating')?.remove();
    const s = settings.get();
    const select = (label, key, options) => el('label', {class: 'setting-row'}, el('span', {text: label}),
      el('select', {onchange: event => settings.set({[key]: isNaN(Number(event.target.value)) ? event.target.value : Number(event.target.value)})}, options.map(([value, text]) => el('option', {value, text, selected: String(s[key]) === String(value)}))));
    const check = (label, key) => el('label', {class: 'setting-row'}, el('span', {text: label}), el('input', {type: 'checkbox', checked: !!s[key], onchange: event => settings.set({[key]: event.target.checked})}));
    const menu = el('div', {class: 'menu floating settings-menu', role: 'dialog', 'aria-label': 'Editor settings'},
      el('div', {class: 'menu-label', text: 'Editor settings'}),
      select('Editor Mode', 'keymap', [['normal', 'Normal'], ['vim', 'Vim'], ['emacs', 'Emacs']]),
      select('Theme', 'theme', [['auto', 'Match the app'], ['light', 'Light'], ['dark', 'Dark'], ['high-contrast', 'High contrast']]),
      select('Tab Spaces', 'tabSize', [[2, '2'], [4, '4'], [8, '8']]),
      select('Font size', 'fontSize', [[12, '12 px'], [13, '13 px'], [14, '14 px'], [16, '16 px'], [18, '18 px'], [20, '20 px']]),
      select('Word wrap', 'wordWrap', [['off', 'Off'], ['on', 'On']]),
      check('Autocomplete', 'autocomplete'),
      options.inline !== false ? check('AI inline suggestions', 'inlineSuggestions') : null,
      check('Minimap', 'minimap'),
      el('div', {class: 'menu-label', text: 'Ctrl+Space opens autocomplete · Ctrl+Enter runs'}));
    document.body.append(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${Math.max(8, rect.right - menu.offsetWidth)}px`;
    setTimeout(() => document.addEventListener('pointerdown', function away(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('pointerdown', away); } }), 0);
  }

  // ---------- left pane ----------
  function setLeft(name) {
    leftTab = name;
    refs.problemTab.classList.toggle('active', name === 'problem');
    refs.submissionsTab.classList.toggle('active', name === 'submissions');
    refs.leftBody.replaceChildren(name === 'problem' ? problemView() : submissionsView());
    refs.leftBody.scrollTop = 0;
  }
  function problemView() {
    const section = (title, md) => md ? el('section', {class: 'statement-section'}, el('h3', {text: title}), el('div', {class: 'md'}, renderMarkdown(md))) : null;
    const sample = (s, i) => el('section', {class: 'statement-section'},
      el('h3', {text: `Sample Input ${i}`}), ioBlock(s.input),
      el('h3', {text: `Sample Output ${i}`}), ioBlock(s.output),
      s.explanation ? el('h3', {text: `Explanation ${i}`}) : null, s.explanation ? el('div', {class: 'md'}, renderMarkdown(s.explanation)) : null);
    return el('article', {class: 'statement'},
      options.header || null,
      el('div', {class: 'md'}, renderMarkdown(q.statement)),
      section('Function Description', q.functionDescription),
      section('Input Format', q.inputFormat),
      section('Constraints', q.constraints),
      section('Output Format', q.outputFormat),
      q.samples.map(sample),
      el('div', {class: 'statement-foot muted small', text: `${q.testCount} test cases, ${q.sampleCount} of them samples. Time limits: ${q.languages.map(l => `${l.label} ${l.limit} s`).join(' · ')}.`}));
  }
  function submissionsView() {
    const subs = state.submissions;
    if (!subs.length) return el('div', {class: 'empty-state small', text: 'You haven\'t submitted this question yet. Submit Code runs every test case and records your score here.'});
    return el('table', {class: 'mini-table submissions'},
      el('thead', {}, el('tr', {}, el('th', {text: 'Result'}), el('th', {text: 'Score'}), el('th', {text: 'Language'}), el('th', {text: 'Time'}), el('th', {}))),
      el('tbody', {}, subs.map(s => {
        const accepted = s.compiled && s.passed === s.total;
        return el('tr', {},
          el('td', {}, el('span', {class: `verdict ${accepted ? 'ok' : 'bad'}`, text: accepted ? 'Accepted' : !s.compiled ? 'Compilation error' : verdictName(s.verdicts)})),
          el('td', {text: `${s.score} / ${s.maxScore}`}),
          el('td', {text: LANGUAGE_LABEL[s.language] || s.language}),
          el('td', {text: ago(s.at), title: new Date(s.at).toLocaleString()}),
          el('td', {}, s.code ? el('button', {class: 'button link small', onclick: () => viewSubmission(s)}, 'View code') : null));
      })));
  }
  const verdictName = verdicts => VERDICT[(verdicts || []).find(v => v !== 'success')] || 'Wrong Answer';
  function viewSubmission(s) {
    const dialog = el('dialog', {class: 'dialog wide'},
      el('div', {class: 'dialog-heading'}, el('h2', {text: `Submission · ${LANGUAGE_LABEL[s.language]} · ${s.score}/${s.maxScore}`}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
      el('div', {class: 'verdict-strip'}, (s.verdicts || []).map((v, i) => el('span', {class: `case-dot ${v === 'success' ? 'ok' : 'bad'}`, title: `Test case ${i}: ${VERDICT[v]}`}))),
      el('pre', {class: 'code-view', text: s.code}),
      el('div', {class: 'dialog-actions'}, el('button', {class: 'button', onclick: async () => {
        dialog.close();
        const ok = await confirmDialog({title: 'Load this submission?', body: 'It replaces the code in the editor for that language. You can undo with Ctrl+Z.', confirm: 'Load'});
        if (!ok) return;
        await switchLanguage(s.language);
        refs.languageSelect.value = s.language;
        const model = await modelFor(s.language);
        model.pushEditOperations([], [{range: model.getFullModelRange(), text: s.code}], () => null);
      }}, 'Load into the editor'), el('button', {class: 'button primary', onclick: () => dialog.close()}, 'Close')));
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  // ---------- running ----------
  // kind: 'run' (samples, or custom input when the Custom tab is open),
  // 'tests' (every test case, in tests) or 'submit' (every test case, scored).
  async function run(kind) {
    if (running) return;
    running = true;
    const buttons = [refs.runButton, refs.testsButton, refs.submitButton].filter(Boolean);
    for (const b of buttons) b.disabled = true;
    const custom = kind === 'run' && resultsTab === 'custom';
    await save();
    const code = editor.getValue();
    const label = kind === 'submit' ? 'Submitting…' : kind === 'tests' ? 'Running every test case…' : 'Running…';
    setResultsOpen(true);
    refs.resultsSummary.textContent = '';
    refs.resultsBody.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), el('span', {text: label})));
    if (custom) refs.resultsBody.prepend(customInputBlock());
    try {
      const url = test ? (kind === 'tests' ? '/api/tests/runtests' : '/api/tests/run') : (kind === 'submit' ? '/api/coding/submit' : '/api/coding/run');
      const job = await api(url, {...(test ? {id: test.id, key: test.key} : {id: q.id}), language, code, ...(custom ? {customInput: refs.customInput.value} : {})});
      const result = await waitJob(job, message => { const line = refs.resultsBody.querySelector('.progress-line span:last-child'); if (line) line.textContent = message; });
      if (custom) customResult = result;
      else {
        lastResult = result;
        selectedCase = Math.max(0, result.tests.findIndex(t => t.status !== 'success'));
      }
      lastRunSummary = summarize(result);
      renderResults();
      options.onChange?.();
      if (kind === 'submit') {
        state.submissions.unshift({at: Date.now(), language, score: result.score, maxScore: result.maxScore, passed: result.passed, total: result.total, compiled: result.compiled, verdicts: result.tests.map(t => t.status), code});
        if (leftTab === 'submissions') setLeft('submissions');
      }
    } catch (error) {
      refs.resultsBody.replaceChildren(...(custom ? [customInputBlock()] : []), el('div', {class: 'result-banner bad'}, el('strong', {text: 'Could not run your code'}), el('p', {text: error.message})));
    } finally {
      running = false;
      for (const b of buttons) b.disabled = false;
    }
  }
  function setResultsOpen(open) {
    refs.results.classList.toggle('collapsed', !open);
    refs.resultsFold.setAttribute('aria-expanded', String(open));
  }
  function toggleLeft() {
    const hidden = refs.main.classList.toggle('left-hidden');
    refs.expand.setAttribute('aria-pressed', String(hidden));
    refs.expand.title = hidden ? 'Show the problem' : 'Expand the editor (hide the problem)';
    editor?.layout();
  }
  function setResultsTab(name) {
    setResultsOpen(true);
    resultsTab = name;
    if (name === 'custom' && !refs.customInput.value) refs.customInput.value = q.samples[0]?.input || '';
    renderResults();
    if (name === 'custom') refs.customInput.focus();
  }
  const customInputBlock = () => el('div', {class: 'custom-block'}, el('div', {class: 'io-label', text: 'Custom Input'}), refs.customInput);
  function summarize(result) {
    if (!result.compiled) return `Compilation error:\n${result.compileMessage.slice(0, 1500)}`;
    const failing = result.tests.filter(t => t.status !== 'success');
    const first = failing[0];
    return `${result.mode === 'submit' ? 'Submission' : result.mode === 'custom' ? 'Custom input run' : 'Sample run'}: ${result.passed}/${result.total} passed.${first ? ` First failure: ${first.name} (${first.verdict}${first.errorType ? `, ${first.errorType}` : ''})${first.hidden ? ' on a hidden test case' : ''}${first.input !== undefined ? `\nInput:\n${first.input.slice(0, 600)}\nExpected:\n${(first.expected || '').slice(0, 300)}\nGot:\n${(first.stdout || '').slice(0, 300)}` : ''}${first.stderr ? `\nStderr:\n${first.stderr.slice(-600)}` : ''}` : ''}`;
  }
  function renderResults() {
    refs.casesTab.classList.toggle('active', resultsTab === 'cases');
    refs.customTab.classList.toggle('active', resultsTab === 'custom');
    const raw = refs.raw.checked;
    const pane = (label, text, kind = '', copyable = true) => [el('div', {class: 'io-label', text: label}), copyable ? ioBlock(text, {raw, kind}) : el('pre', {class: `io-block ${kind}`, text: raw ? visible(text) : text})];
    if (resultsTab === 'custom') {
      const r = customResult, t = r?.tests[0];
      refs.resultsSummary.textContent = '';
      refs.resultsBody.replaceChildren(customInputBlock(), !r ? el('p', {class: 'muted small', text: 'Run Code runs your program once with this input.'})
        : !r.compiled ? el('div', {}, ...pane('Compiler Message', r.compileMessage || 'Compilation failed.', 'error', false))
        : el('div', {}, ...pane('Compiler Message', t.verdict === 'Success' ? 'Success' : t.verdict, t.status === 'success' ? 'ok' : 'error', false), ...pane('Your Output (stdout)', t.stdout || '~ no response on stdout ~'), ...(t.stderr ? pane('Debug Output', t.stderr, 'error') : [])));
      return;
    }
    const r = lastResult;
    if (!r) {
      refs.resultsSummary.textContent = '';
      refs.resultsBody.replaceChildren(el('div', {class: 'results-empty muted', text: test ? 'Run Code runs the sample test cases. Run Tests runs every test case. Save & Proceed saves this answer and moves to the next question.' : 'Run Code runs the sample test cases. Submit Code runs every test case and scores your solution. Use the Custom tab to try your own input.'}));
      return;
    }
    const allPassed = r.compiled && r.passed === r.total;
    refs.resultsSummary.className = `results-summary ${allPassed ? 'ok' : 'bad'}`;
    refs.resultsSummary.textContent = !r.compiled ? 'Compilation error' : `${r.passed}/${r.total} test cases passed`;
    // One headline, as assessment editors show it: compiled or not, then how many cases passed.
    const what = r.mode === 'run' ? 'sample test cases' : 'test cases';
    const banner = !r.compiled
      ? el('div', {class: 'result-banner bad'}, el('strong', {text: 'Compilation error'}), el('p', {text: 'Check the compiler message below.'}))
      : el('div', {class: `result-banner ${allPassed ? 'ok' : 'bad'}`},
        el('strong', {text: allPassed ? `Compiled successfully. All ${what} passed!` : `Compiled successfully. ${r.passed}/${r.total} ${what} passed.`}),
        el('p', {text: r.mode === 'submit' ? `Score: ${r.score} / ${r.maxScore}`
          : r.mode === 'tests' ? (allPassed ? 'Save & Proceed to record this as your answer.' : 'Fix the failing cases, then Run Tests again.')
          : allPassed ? (test ? 'Run Tests to check every test case, then Save & Proceed.' : 'Submit Code to run your code against every test case.') : 'Open the failing case, fix your code and run it again.'}));
    if (!r.compiled) {
      refs.resultsBody.replaceChildren(banner, ...pane('Compiler Message', r.compileMessage || 'Compilation failed.', 'error', false));
      return;
    }
    const tabs = el('div', {class: 'case-tabs', role: 'tablist', 'aria-label': 'Test cases'}, r.tests.map((t, i) => el('button', {class: `case-tab ${t.status === 'success' ? 'ok' : 'bad'}${i === selectedCase ? ' active' : ''}`, role: 'tab', 'aria-selected': String(i === selectedCase), title: `${t.name}: ${t.verdict}`, onclick: () => { selectedCase = i; renderResults(); }},
      icon(t.status === 'success' ? 'check' : 'cross'), el('span', {text: t.name}), t.hidden ? icon('lock', 'icon lock') : null)));
    const t = r.tests[selectedCase];
    // SQL results read better as a table; the input (the setup script) stays text.
    const column = (label, text, kind = '') => el('div', {class: 'io-col'}, el('div', {class: 'io-label', text: label}),
      language === 'sql' && !label.startsWith('Input') && !refs.raw.checked ? sqlTable(text) || ioBlock(text, {kind}) : ioBlock(text, {raw: refs.raw.checked, kind}));
    const detail = el('div', {class: 'case-detail'},
      el('div', {class: `case-verdict ${t.status === 'success' ? 'ok' : 'bad'}`}, el('span', {class: 'io-label', text: 'Compiler Message'}), el('strong', {text: t.verdict}),
        t.ms !== null && t.ms !== undefined ? el('span', {class: 'muted small', text: `${(t.ms / 1000).toFixed(2)} s`}) : null),
      t.hidden
        ? el('div', {class: 'hidden-case'}, icon('lock'), el('p', {text: `Hidden test case: its input, its expected output and your program's output stay private.${t.errorType ? ` Error: ${t.errorType}.` : ''}`}))
        : el('div', {class: 'io-grid'}, column('Input (stdin)', t.input || ''), column('Your Output (stdout)', t.stdout || '~ no response on stdout ~', t.status === 'success' ? '' : 'error'), t.expected !== undefined ? column('Expected Output', t.expected) : null),
      t.stderr ? column('Debug Output', t.stderr, 'error') : null);
    refs.resultsBody.replaceChildren(banner, tabs, detail);
  }

  // ---------- AI panel ----------
  function toggleAi() {
    if (!assistant) return;
    aiOpen = !aiOpen;
    store.set(aiKey, aiOpen);
    refs.main.classList.toggle('ai-open', aiOpen);
    refs.aiToggle.classList.toggle('active', aiOpen);
    if (aiOpen) assistant.focus();
  }

  // ---------- start ----------
  (async () => {
    // Loads the local models while the candidate reads the problem.
    if (aiAllowed) fetch('/api/assistant/warm', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({completion: options.inline !== false})}).catch(() => {});
    await template(language).catch(() => '');
    editor.setModel(await modelFor(language));
    options.recorder?.snapshot(language, editor.getValue());
    applySettings(editor);
    paintStatus();
    updateKeymap();
    setLeft('problem');
    renderResults();
    assistant?.openLatest();
    editor.focus();
  })().catch(error => notify(error.message, 'error'));

  return {
    id: q.id,
    async dispose() {
      await save().catch(() => {});
      window.removeEventListener('dg-editor-settings', onSettings);
      keymapOff();
      for (const model of Object.values(models)) { setInlineSource(model, null); model.dispose(); }
      for (const d of disposables) d.dispose();
      assistant?.stop();
      root.replaceChildren();
    },
    save: () => save(),
    focus: () => editor?.focus()
  };
}

// Query output is a header line and tab-separated rows.
function sqlTable(text) {
  const lines = String(text).replace(/\n+$/, '').split('\n');
  if (lines.length < 2 && !lines[0]?.includes('\t')) return null;
  const [head, ...rows] = lines.map(line => line.split('\t'));
  return el('div', {class: 'md-table sql-result'}, el('table', {},
    el('thead', {}, el('tr', {}, head.map(h => el('th', {text: h})))),
    el('tbody', {}, rows.map(row => el('tr', {}, row.map(cell => el('td', {text: cell})))))));
}

// Raw format shows spaces, tabs and line ends, which helps with Wrong Answer on whitespace.
const visible = text => String(text).replace(/ /g, '·').replace(/\t/g, '→   ').replace(/\n/g, '↵\n');

function ioBlock(text, {raw = false, kind = ''} = {}) {
  const pre = el('pre', {class: `io-block ${kind}`, text: raw ? visible(text) : text});
  const copy = el('button', {class: 'io-copy', title: 'Copy', 'aria-label': 'Copy', onclick: async () => { try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; setTimeout(() => { copy.replaceChildren(icon('copy')); }, 1200); } catch {} }}, icon('copy'));
  return el('div', {class: 'io-wrap'}, pre, copy);
}

// The ⓘ panel: language versions and limits.
export function environmentDialog(q, current) {
  const dialog = el('dialog', {class: 'dialog'},
    el('div', {class: 'dialog-heading'}, el('h2', {text: 'Execution environment'}), el('button', {class: 'icon-button', 'aria-label': 'Close', onclick: () => dialog.close()}, '×')),
    el('p', {text: 'Your code runs in an isolated Docker container with no network access. The template already reads standard input and prints to standard output.'}),
    el('table', {class: 'mini-table env-table'},
      el('thead', {}, el('tr', {}, el('th', {text: 'Language'}), el('th', {text: 'Version'}), el('th', {text: 'Time limit'}), el('th', {text: 'Memory limit'}))),
      el('tbody', {}, q.languages.map(l => el('tr', {class: l.id === current ? 'current' : ''},
        el('td', {}, el('strong', {text: l.label}), l.notes ? el('div', {class: 'muted small', text: l.notes}) : null),
        el('td', {text: l.version || ''}), el('td', {text: `${l.limit} s`}), el('td', {text: l.memory ? `${l.memory} MB` : ''}))))),
    el('p', {class: 'muted small', text: 'Time limits apply to each test case. Output above 20 MB per test case is cut off.'}),
    el('div', {class: 'dialog-actions'}, el('button', {class: 'button primary', onclick: () => dialog.close()}, 'Close')));
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
