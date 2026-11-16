// Loads the vendored Monaco editor (the editor behind VS Code) and provides
// shared themes, language detection, editor settings and AI inline completions.
import {store} from './ui.js';

const BASE = '/vendor/monaco/vs';
let loading = null;

const EXTENSION_LANGUAGES = {
  py: 'python', js: 'javascript', cjs: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala', c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  cs: 'csharp', go: 'go', rs: 'rust', rb: 'ruby', php: 'php', swift: 'swift', r: 'r', pl: 'perl', pm: 'perl', ex: 'elixir', exs: 'elixir',
  sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', json: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini',
  md: 'markdown', markdown: 'markdown', rst: 'restructuredtext', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  sql: 'sql', xml: 'xml', svg: 'xml', graphql: 'graphql', proto: 'protobuf', lua: 'lua', dart: 'dart'
};
const FILE_LANGUAGES = {dockerfile: 'dockerfile', makefile: 'shell', gemfile: 'ruby', rakefile: 'ruby'};

// Language ids used by coding questions map onto Monaco ids.
export const CODE_LANGUAGES = {python: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', go: 'go', sql: 'sql'};

export function monacoLanguage(name = '') {
  const base = String(name).split('/').pop().toLowerCase();
  if (FILE_LANGUAGES[base]) return FILE_LANGUAGES[base];
  const ext = base.includes('.') ? base.split('.').pop() : '';
  return EXTENSION_LANGUAGES[ext] || CODE_LANGUAGES[base] || 'plaintext';
}

export const settings = {
  get() {
    return {theme: 'auto', fontSize: 14, tabSize: 4, autocomplete: true, inlineSuggestions: true, minimap: false, wordWrap: 'off', keymap: 'normal', ...store.get('dg-editor-settings', {})};
  },
  set(patch) {
    const next = {...settings.get(), ...patch};
    store.set('dg-editor-settings', next);
    window.dispatchEvent(new CustomEvent('dg-editor-settings', {detail: next}));
    return next;
  }
};

function appTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function themeName(choice = settings.get().theme) {
  if (choice === 'high-contrast') return 'hc-black';
  if (choice === 'light') return 'dg-light';
  if (choice === 'dark') return 'dg-dark';
  return appTheme() === 'dark' ? 'dg-dark' : 'dg-light';
}

function defineThemes(monaco) {
  // Neutral greys with a blue cursor and selection, matching figma.css.
  monaco.editor.defineTheme('dg-light', {base: 'vs', inherit: true, rules: [], colors: {
    'editor.background': '#ffffff', 'editorLineNumber.foreground': '#b0b0b6', 'editorLineNumber.activeForeground': '#4b4b52', 'editor.lineHighlightBackground': '#f7f7f8', 'editor.lineHighlightBorder': '#00000000',
    'editorGutter.background': '#ffffff', 'editor.selectionBackground': '#cfe5fd', 'editor.inactiveSelectionBackground': '#e6f1fe', 'editorCursor.foreground': '#1f82ef',
    'editorIndentGuide.background1': '#ececef', 'editorWidget.background': '#ffffff', 'editorWidget.border': '#e6e6e8', 'diffEditor.insertedTextBackground': '#14955a22', 'diffEditor.removedTextBackground': '#e0482d22'
  }});
  monaco.editor.defineTheme('dg-dark', {base: 'vs-dark', inherit: true, rules: [], colors: {
    'editor.background': '#232326', 'editorLineNumber.foreground': '#66666e', 'editorLineNumber.activeForeground': '#c7c7cc', 'editor.lineHighlightBackground': '#2c2c30', 'editor.lineHighlightBorder': '#00000000',
    'editorGutter.background': '#232326', 'editor.selectionBackground': '#24476e', 'editor.inactiveSelectionBackground': '#1d3550', 'editorCursor.foreground': '#3d95f5',
    'editorIndentGuide.background1': '#34343a', 'editorWidget.background': '#2a2a2d', 'editorWidget.border': '#3a3a3e', 'diffEditor.insertedTextBackground': '#36c27f22', 'diffEditor.removedTextBackground': '#ff6a5022'
  }});
}

// Inline (ghost text) completions: each model can register a fetcher.
const inlineSources = new Map();
export function setInlineSource(model, source) {
  if (source) inlineSources.set(model.uri.toString(), source); else inlineSources.delete(model.uri.toString());
}

function registerInlineCompletions(monaco) {
  monaco.languages.registerInlineCompletionsProvider({pattern: '**'}, {
    async provideInlineCompletions(model, position, context, token) {
      const source = inlineSources.get(model.uri.toString());
      if (!source || !settings.get().inlineSuggestions) return {items: []};
      // Wait for a pause in typing; Monaco cancels the token on the next keystroke.
      await new Promise(resolve => setTimeout(resolve, context.triggerKind === 1 ? 0 : 350));
      if (token.isCancellationRequested) return {items: []};
      const offset = model.getOffsetAt(position);
      const text = model.getValue();
      const prefix = text.slice(Math.max(0, offset - 4000), offset);
      const suffix = text.slice(offset, offset + 1500);
      const controller = new AbortController();
      token.onCancellationRequested(() => controller.abort());
      try {
        const completion = await source({prefix, suffix, signal: controller.signal});
        if (!completion || token.isCancellationRequested) return {items: []};
        return {items: [{insertText: completion, range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)}]};
      } catch { return {items: []}; }
    },
    disposeInlineCompletions() {},
    freeInlineCompletions() {}
  });
}

export function loadMonaco() {
  if (window.monaco?.editor) return Promise.resolve(window.monaco);
  loading ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${BASE}/editor/editor.main.css`;
    document.head.append(css);
    const script = document.createElement('script');
    script.src = `${BASE}/loader.js`;
    script.onerror = () => reject(new Error('The code editor failed to load.'));
    script.onload = () => {
      window.require.config({paths: {vs: BASE}});
      window.require(['vs/editor/editor.main'], () => {
        const monaco = window.monaco;
        defineThemes(monaco);
        registerInlineCompletions(monaco);
        monaco.editor.setTheme(themeName());
        // Follow the app's light/dark switch when the editor theme is automatic.
        new MutationObserver(() => monaco.editor.setTheme(themeName())).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
        matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => monaco.editor.setTheme(themeName()));
        window.addEventListener('dg-editor-settings', () => monaco.editor.setTheme(themeName()));
        resolve(monaco);
      }, error => reject(error instanceof Error ? error : new Error('The code editor failed to load.')));
    };
    document.head.append(script);
  });
  return loading;
}

export function editorOptions(overrides = {}) {
  const s = settings.get();
  return {
    automaticLayout: true, fontSize: s.fontSize, tabSize: s.tabSize, insertSpaces: true, minimap: {enabled: s.minimap}, wordWrap: s.wordWrap,
    scrollBeyondLastLine: false, renderWhitespace: 'selection', fontFamily: '"JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, monospace', lineHeight: Math.round(s.fontSize * 1.6),
    renderLineHighlight: 'all', roundedSelection: true, cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on', guides: {indentation: true},
    quickSuggestions: s.autocomplete, suggestOnTriggerCharacters: s.autocomplete, wordBasedSuggestions: s.autocomplete ? 'currentDocument' : 'off',
    inlineSuggest: {enabled: true}, fixedOverflowWidgets: true, smoothScrolling: true, padding: {top: 10},
    ...overrides
  };
}

// Applies saved settings to a live editor.
export function applySettings(editor, s = settings.get()) {
  editor.updateOptions({fontSize: s.fontSize, lineHeight: Math.round(s.fontSize * 1.6), minimap: {enabled: s.minimap}, wordWrap: s.wordWrap, quickSuggestions: s.autocomplete, suggestOnTriggerCharacters: s.autocomplete, wordBasedSuggestions: s.autocomplete ? 'currentDocument' : 'off'});
  editor.getModel()?.updateOptions({tabSize: s.tabSize});
}

// Vim and Emacs key bindings (monaco-vim and monaco-emacs, MIT), loaded on first use.
// Their UMD builds take the global monaco object when the AMD loader is hidden.
const KEYMAP_SCRIPTS = {vim: '/vendor/monaco-vim/monaco-vim.umd.js', emacs: '/vendor/monaco-emacs/monaco-emacs.js'};
const keymapLoads = {};
function loadGlobalScript(src) {
  return new Promise((resolve, reject) => {
    const amd = window.define?.amd;
    if (window.define) window.define.amd = undefined;
    const script = document.createElement('script');
    script.src = src;
    const restore = () => { if (window.define) window.define.amd = amd; };
    script.onload = () => { restore(); resolve(); };
    script.onerror = () => { restore(); reject(new Error('The editor key bindings failed to load.')); };
    document.head.append(script);
  });
}

// Turns on the chosen key bindings; returns a function that turns them off.
export async function applyKeymap(editor, mode, statusNode) {
  if (statusNode) statusNode.textContent = '';
  if (mode === 'vim') {
    if (!window.MonacoVim) await (keymapLoads.vim ||= loadGlobalScript(KEYMAP_SCRIPTS.vim));
    const vim = window.MonacoVim.initVimMode(editor, statusNode);
    return () => { vim.dispose(); if (statusNode) statusNode.textContent = ''; };
  }
  if (mode === 'emacs') {
    if (!window.MonacoEmacs) await (keymapLoads.emacs ||= loadGlobalScript(KEYMAP_SCRIPTS.emacs));
    const emacs = new window.MonacoEmacs.EmacsExtension(editor);
    emacs.onDidChangeKey(keys => { if (statusNode) statusNode.textContent = keys; });
    emacs.start();
    return () => { emacs.dispose(); if (statusNode) statusNode.textContent = ''; };
  }
  return () => {};
}

export const KEYMAP_LABEL = {normal: 'Normal', vim: 'Vim', emacs: 'Emacs'};
