// Coding questions: the question library with filters, and the coding
// workspace (statement, editor, Run Code / Submit Code, test results,
// submissions and the AI assistant).
import {el, api, waitJob, notify, confirmDialog, store, icon, splitter, DIFFICULTY_CLASS} from './ui.js';
import {renderMarkdown} from './markdown.js';
import {loadMonaco, editorOptions, applySettings, setInlineSource, settings, monacoLanguage} from './monaco.js';
import {createAssistant, ago} from './assistant-ui.js';
import {enterFullscreen} from './app.js';

const LANGUAGE_LABEL = {python: 'Python 3', javascript: 'JavaScript (Node.js)', java: 'Java 21', cpp: 'C++20', go: 'Go'};
const VERDICT = {success: 'Success', wrong: 'Wrong Answer', runtime: 'Runtime Error', timeout: 'Terminated due to timeout', compile: 'Compilation error', output: 'Output limit exceeded'};
const EXT = {python: 'py', javascript: 'js', java: 'java', cpp: 'cpp', go: 'go'};

// ---------- library ----------
export async function renderLibrary(root) {
  root.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), 'Loading questions…'));
  const questions = await api('/api/coding/questions');
  const filters = store.get('dg-question-filters', {status: [], difficulty: [], skills: [], search: ''});
  const skills = [...new Set(questions.flatMap(q => q.skills))].sort();
  const list = el('div', {class: 'challenge-list'});
  const count = el('span', {class: 'muted'});
  const paint = () => {
    store.set('dg-question-filters', filters);
    const needle = filters.search.trim().toLowerCase();
    const shown = questions.filter(q =>
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
    el('p', {class: 'page-lead', text: 'Assessment-style problems with sample and hidden test cases. Write your solution in Python, JavaScript, Java, C++ or Go, run it against the samples, then submit to be scored on every test case. An AI assistant sits beside the editor.'}),
    el('div', {class: 'library-layout'},
      el('div', {}, el('div', {class: 'library-tools'}, search, count), list),
      el('aside', {class: 'filters', 'aria-label': 'Filters'},
        group('Status', 'status', ['solved', 'unsolved'], {solved: 'Solved', unsolved: 'Unsolved'}),
        group('Difficulty', 'difficulty', ['Easy', 'Medium', 'Hard']),
        group('Skills', 'skills', skills),
        el('button', {class: 'button link small', onclick: () => { filters.status = []; filters.difficulty = []; filters.skills = []; filters.search = ''; search.value = ''; renderLibrary(root); }}, 'Clear filters'))));
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

function createWorkspace(root, q, monaco) {
  const refs = {};
  const state = q.state;
  let language = state.language || store.get('dg-code-language', 'python');
  if (!q.languages.some(l => l.id === language)) language = 'python';
  const models = {};      // one Monaco model per language keeps undo history
  const templates = {};
  let editor = null, saveTimer = null, running = false, lastResult = null, selectedCase = 0, leftTab = 'problem', aiOpen = store.get('dg-coding-ai-open', true);
  let lastRunSummary = '';
  const disposables = [];

  // ---------- layout ----------
  refs.languageSelect = el('select', {class: 'language-select', 'aria-label': 'Language', onchange: () => switchLanguage(refs.languageSelect.value)},
    q.languages.map(l => el('option', {value: l.id, text: l.label})));
  refs.languageSelect.value = language;
  refs.aiToggle = el('button', {class: `button small ai-toggle${aiOpen ? ' active' : ''}`, onclick: () => toggleAi()}, icon('spark'), 'AI Assistant');
  const top = el('header', {class: 'fs-top'},
    el('a', {class: 'icon-button', href: '#/questions', title: 'Back to questions', 'aria-label': 'Back to questions'}, icon('back')),
    el('div', {class: 'fs-title'}, el('strong', {text: q.title}), el('span', {class: `difficulty ${DIFFICULTY_CLASS[q.difficulty]}`, text: q.difficulty}), el('span', {class: 'chip', text: `Max score ${q.maxScore}`})),
    el('span', {class: 'grow'}),
    refs.aiToggle);

  refs.problemTab = el('button', {class: 'tab', onclick: () => setLeft('problem')}, 'Problem');
  refs.submissionsTab = el('button', {class: 'tab', onclick: () => setLeft('submissions')}, 'Submissions');
  refs.leftBody = el('div', {class: 'pane-scroll'});
  const left = el('section', {class: 'cq-left'}, el('div', {class: 'tabs'}, refs.problemTab, refs.submissionsTab), refs.leftBody);

  refs.editorHost = el('div', {class: 'monaco-host'});
  refs.cursor = el('span', {class: 'muted small'});
  refs.saved = el('span', {class: 'muted small'});
  const editorBar = el('div', {class: 'editor-bar'},
    refs.languageSelect,
    el('span', {class: 'grow'}),
    refs.saved,
    el('button', {class: 'icon-button', title: 'Upload code as a file', 'aria-label': 'Upload code as a file', onclick: upload}, icon('upload')),
    el('button', {class: 'icon-button', title: 'Reset to the starter template', 'aria-label': 'Reset to the starter template', onclick: reset}, icon('reset')),
    el('button', {class: 'icon-button', title: 'Editor settings', 'aria-label': 'Editor settings', onclick: event => settingsMenu(event.currentTarget)}, icon('gear')));
  refs.customToggle = el('input', {type: 'checkbox', id: 'customInput', onchange: () => { refs.customBox.hidden = !refs.customToggle.checked; if (refs.customToggle.checked && !refs.customInput.value) refs.customInput.value = q.samples[0]?.input || ''; }});
  refs.customInput = el('textarea', {class: 'custom-input', rows: 4, spellcheck: 'false', 'aria-label': 'Custom input'});
  refs.customBox = el('div', {class: 'custom-box', hidden: true}, refs.customInput);
  refs.runButton = el('button', {class: 'button small', onclick: () => run(false)}, 'Run Code');
  refs.submitButton = el('button', {class: 'button primary small', onclick: () => run(true)}, 'Submit Code');
  const runBar = el('div', {class: 'run-bar'},
    refs.cursor,
    el('span', {class: 'grow'}),
    el('label', {class: 'custom-check', for: 'customInput'}, refs.customToggle, 'Test against custom input'),
    refs.runButton, refs.submitButton);
  refs.results = el('section', {class: 'cq-results', 'aria-live': 'polite'});
  const resultsSplit = el('div', {class: 'splitter horizontal', role: 'separator', 'aria-orientation': 'horizontal'});
  const center = el('section', {class: 'cq-center'}, editorBar, refs.editorHost, runBar, refs.customBox, resultsSplit, refs.results);

  const assistant = createAssistant({
    variant: 'side', modes: ['ask'],
    scope: () => ({scope: 'question', question: q.id}),
    context: () => ({language, code: editor?.getValue() || '', lastRun: lastRunSummary, help: store.get('dg-help-level', 'full')}),
    codeActions: [{label: 'Insert', title: 'Insert at the cursor in the editor', action: code => insertCode(code)}],
    suggestions: ['Explain the problem with a small example', 'What approach would fit these constraints?', 'Why does my code fail the sample test?', 'What edge cases should I test?']
  });
  const help = el('select', {class: 'help-select', 'aria-label': 'Help level', title: 'Guided: hints and explanations only. Full: the assistant may write code.', onchange: event => store.set('dg-help-level', event.target.value)},
    el('option', {value: 'full', text: 'Full help'}), el('option', {value: 'guided', text: 'Guided help'}));
  help.value = store.get('dg-help-level', 'full');
  assistant.setHeaderExtra(help);
  refs.ai = el('aside', {class: 'cq-ai', 'aria-label': 'AI assistant'}, assistant.root);

  const leftSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  const aiSplit = el('div', {class: 'splitter', role: 'separator', 'aria-orientation': 'vertical'});
  refs.main = el('div', {class: `cq-main${aiOpen ? ' ai-open' : ''}`}, left, leftSplit, center, aiSplit, refs.ai);
  root.replaceChildren(top, refs.main);
  const sizes = store.get('dg-cq-sizes', {});
  for (const [name, value] of Object.entries(sizes)) refs.main.style.setProperty(name, value + 'px');
  splitter(refs.main, leftSplit, '--cq-left', x => x - refs.main.getBoundingClientRect().left, 260, 900, 'dg-cq-sizes');
  splitter(refs.main, aiSplit, '--cq-ai', x => refs.main.getBoundingClientRect().right - x, 280, 720, 'dg-cq-sizes');
  splitter(refs.main, resultsSplit, '--cq-results', (x, y) => center.getBoundingClientRect().bottom - y, 80, 700, 'dg-cq-sizes');

  // ---------- editor ----------
  editor = monaco.editor.create(refs.editorHost, editorOptions({model: null}));
  disposables.push(editor);
  editor.onDidChangeCursorPosition(e => { refs.cursor.textContent = `Line ${e.position.lineNumber}, Col ${e.position.column}`; });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => run(false));
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => run(true));
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save(true));
  const onSettings = () => applySettings(editor);
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
    model.onDidChangeContent(() => { refs.saved.textContent = 'Unsaved'; clearTimeout(saveTimer); saveTimer = setTimeout(() => save(), 1500); });
    setInlineSource(model, ({prefix, suffix, signal}) => fetch('/api/assistant/complete', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({prefix, suffix, language: lang}), signal}).then(r => r.json()).then(r => r.completion || ''));
    models[lang] = model;
    return model;
  }
  async function switchLanguage(lang) {
    await save();
    language = lang;
    store.set('dg-code-language', lang);
    editor.setModel(await modelFor(lang));
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
      await api('/api/coding/save', {id: q.id, language, code});
      state.drafts[language] = code;
      refs.saved.textContent = 'Saved';
    } catch (error) { refs.saved.textContent = 'Not saved'; if (explicit) notify(error.message, 'error'); }
  }
  function insertCode(code) {
    const selection = editor.getSelection();
    editor.executeEdits('assistant', [{range: selection, text: code, forceMoveMarkers: true}]);
    editor.pushUndoStop();
    editor.focus();
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
    const input = el('input', {type: 'file', accept: '.py,.js,.java,.cpp,.cc,.cxx,.h,.hpp,.go,.txt'});
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 200000) { notify('That file is larger than 200 KB.', 'error'); return; }
      const text = await file.text();
      const model = await modelFor(language);
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
      select('Theme', 'theme', [['auto', 'Match the app'], ['light', 'Light'], ['dark', 'Dark'], ['high-contrast', 'High contrast']]),
      select('Font size', 'fontSize', [[12, '12 px'], [13, '13 px'], [14, '14 px'], [16, '16 px'], [18, '18 px'], [20, '20 px']]),
      select('Tab spaces', 'tabSize', [[2, '2'], [4, '4'], [8, '8']]),
      select('Word wrap', 'wordWrap', [['off', 'Off'], ['on', 'On']]),
      check('Autocomplete', 'autocomplete'),
      check('AI inline suggestions', 'inlineSuggestions'),
      check('Minimap', 'minimap'));
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
  async function run(submit) {
    if (running) return;
    running = true;
    refs.runButton.disabled = refs.submitButton.disabled = true;
    const custom = !submit && refs.customToggle.checked;
    await save();
    const code = editor.getValue();
    refs.results.replaceChildren(el('div', {class: 'progress-line'}, el('span', {class: 'spinner'}), el('span', {text: submit ? 'Submitting…' : 'Running…'})));
    try {
      const job = await api(submit ? '/api/coding/submit' : '/api/coding/run', {id: q.id, language, code, ...(custom ? {customInput: refs.customInput.value} : {})});
      const result = await waitJob(job, message => { refs.results.querySelector('.progress-line span:last-child').textContent = message; });
      lastResult = result;
      selectedCase = Math.max(0, result.tests.findIndex(t => t.status !== 'success'));
      if (selectedCase < 0) selectedCase = 0;
      lastRunSummary = summarize(result);
      renderResults();
      if (submit) {
        state.submissions.unshift({at: Date.now(), language, score: result.score, maxScore: result.maxScore, passed: result.passed, total: result.total, compiled: result.compiled, verdicts: result.tests.map(t => t.status), code});
        if (leftTab === 'submissions') setLeft('submissions');
      }
    } catch (error) {
      lastResult = null;
      refs.results.replaceChildren(el('div', {class: 'result-banner bad'}, el('strong', {text: 'Could not run your code'}), el('p', {text: error.message})));
    } finally {
      running = false;
      refs.runButton.disabled = refs.submitButton.disabled = false;
    }
  }
  function summarize(result) {
    if (!result.compiled) return `Compilation error:\n${result.compileMessage.slice(0, 1500)}`;
    const failing = result.tests.filter(t => t.status !== 'success');
    const first = failing[0];
    return `${result.mode === 'submit' ? 'Submission' : result.mode === 'custom' ? 'Custom input run' : 'Sample run'}: ${result.passed}/${result.total} passed.${first ? ` First failure: ${first.name} (${first.verdict})${first.input !== undefined ? `\nInput:\n${first.input.slice(0, 600)}\nExpected:\n${(first.expected || '').slice(0, 300)}\nGot:\n${(first.stdout || '').slice(0, 300)}` : ''}${first.stderr ? `\nStderr:\n${first.stderr.slice(-600)}` : ''}` : ''}`;
  }
  function renderResults() {
    const r = lastResult;
    if (!r) { refs.results.replaceChildren(el('div', {class: 'results-empty muted', text: 'Run Code to test against the sample cases. Submit Code runs every test case and scores your solution.'})); return; }
    const banner = !r.compiled
      ? el('div', {class: 'result-banner bad'}, el('strong', {text: 'Compilation error'}), el('p', {text: 'Check the compiler message below.'}))
      : r.mode === 'submit'
        ? el('div', {class: `result-banner ${r.passed === r.total ? 'ok' : 'bad'}`}, el('strong', {text: r.passed === r.total ? 'Congratulations! You passed every test case.' : `${r.passed} of ${r.total} test cases passed`}), el('p', {text: `Score: ${r.score} / ${r.maxScore}`}))
        : r.mode === 'custom'
          ? el('div', {class: 'result-banner neutral'}, el('strong', {text: r.tests[0].status === 'success' ? 'Ran with your custom input' : r.tests[0].verdict}))
          : el('div', {class: `result-banner ${r.passed === r.total ? 'ok' : 'bad'}`}, el('strong', {text: r.passed === r.total ? 'Congratulations! You passed the sample test cases.' : `${r.passed} of ${r.total} sample test cases passed`}),
            el('p', {text: r.passed === r.total ? 'Click Submit Code to run your code against all the test cases.' : 'Look at the failing case, fix your code and run it again.'}));
    if (!r.compiled) {
      refs.results.replaceChildren(banner, el('div', {class: 'io-label', text: 'Compiler Message'}), el('pre', {class: 'io-block error', text: r.compileMessage || 'Compilation failed.'}));
      return;
    }
    const cases = el('ul', {class: 'case-list', role: 'tablist'}, r.tests.map((t, i) => el('li', {}, el('button', {class: `case-item ${t.status === 'success' ? 'ok' : 'bad'}${i === selectedCase ? ' active' : ''}`, role: 'tab', 'aria-selected': String(i === selectedCase), onclick: () => { selectedCase = i; renderResults(); }},
      icon(t.status === 'success' ? 'check' : 'cross'), el('span', {text: t.custom ? 'Custom input' : t.name}), t.hidden ? icon('lock', 'icon lock') : null))));
    const t = r.tests[selectedCase];
    const detail = el('div', {class: 'case-detail'},
      el('div', {class: 'io-label', text: 'Compiler Message'}), el('pre', {class: `io-block ${t.status === 'success' ? 'ok' : 'error'}`, text: t.verdict}),
      t.hidden ? el('div', {class: 'hidden-case'}, icon('lock'), el('p', {text: 'This is a hidden test case. Its input and expected output stay private, as in a real assessment.'}))
        : [el('div', {class: 'io-label', text: 'Input (stdin)'}), ioBlock(t.input || ''),
          el('div', {class: 'io-label', text: 'Your Output (stdout)'}), el('pre', {class: 'io-block', text: t.stdout || '~ no response on stdout ~'}),
          t.expected !== undefined ? el('div', {class: 'io-label', text: 'Expected Output'}) : null, t.expected !== undefined ? ioBlock(t.expected) : null],
      t.stderr ? [el('div', {class: 'io-label', text: 'Debug output (stderr)'}), el('pre', {class: 'io-block error', text: t.stderr})] : null,
      t.ms !== null && t.ms !== undefined ? el('div', {class: 'muted small', text: `Time: ${(t.ms / 1000).toFixed(2)} s`}) : null);
    refs.results.replaceChildren(banner, el('div', {class: 'case-layout'}, cases, detail));
  }

  // ---------- AI panel ----------
  function toggleAi() {
    aiOpen = !aiOpen;
    store.set('dg-coding-ai-open', aiOpen);
    refs.main.classList.toggle('ai-open', aiOpen);
    refs.aiToggle.classList.toggle('active', aiOpen);
    if (aiOpen) assistant.focus();
  }

  // ---------- start ----------
  (async () => {
    editor.setModel(await modelFor(language));
    applySettings(editor);
    setLeft('problem');
    renderResults();
    assistant.openLatest();
    editor.focus();
  })().catch(error => notify(error.message, 'error'));

  return {
    id: q.id,
    async dispose() {
      await save().catch(() => {});
      window.removeEventListener('dg-editor-settings', onSettings);
      for (const model of Object.values(models)) { setInlineSource(model, null); model.dispose(); }
      for (const d of disposables) d.dispose();
      assistant.stop();
      root.replaceChildren();
    }
  };
}

function ioBlock(text) {
  const pre = el('pre', {class: 'io-block', text});
  const copy = el('button', {class: 'io-copy', title: 'Copy', 'aria-label': 'Copy', onclick: async () => { try { await navigator.clipboard.writeText(text); copy.textContent = 'Copied'; setTimeout(() => { copy.replaceChildren(icon('copy')); }, 1200); } catch {} }}, icon('copy'));
  return el('div', {class: 'io-wrap'}, pre, copy);
}
