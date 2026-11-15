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
export const CODE_LANGUAGES = {python: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', go: 'go'};

export function monacoLanguage(name = '') {
  const base = String(name).split('/').pop().toLowerCase();
  if (FILE_LANGUAGES[base]) return FILE_LANGUAGES[base];
  const ext = base.includes('.') ? base.split('.').pop() : '';
  return EXTENSION_LANGUAGES[ext] || CODE_LANGUAGES[base] || 'plaintext';
}

export const settings = {
  get() {
    return {theme: 'auto', fontSize: 14, tabSize: 4, autocomplete: true, inlineSuggestions: true, minimap: false, wordWrap: 'off', ...store.get('dg-editor-settings', {})};
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
  monaco.editor.defineTheme('dg-light', {base: 'vs', inherit: true, rules: [], colors: {
    'editor.background': '#ffffff', 'editorLineNumber.foreground': '#9aa7a5', 'editor.lineHighlightBackground': '#f3f7f6',
    'editorGutter.background': '#ffffff', 'editor.selectionBackground': '#b9e3dc', 'editorCursor.foreground': '#0f8a7d'
  }});
  monaco.editor.defineTheme('dg-dark', {base: 'vs-dark', inherit: true, rules: [], colors: {
    'editor.background': '#0f1716', 'editorLineNumber.foreground': '#566663', 'editor.lineHighlightBackground': '#16211f',
    'editorGutter.background': '#0f1716', 'editor.selectionBackground': '#1f4a44', 'editorCursor.foreground': '#2bb5a5'
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
    scrollBeyondLastLine: false, renderWhitespace: 'selection', fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
    quickSuggestions: s.autocomplete, suggestOnTriggerCharacters: s.autocomplete, wordBasedSuggestions: s.autocomplete ? 'currentDocument' : 'off',
    inlineSuggest: {enabled: true}, fixedOverflowWidgets: true, smoothScrolling: true, padding: {top: 10},
    ...overrides
  };
}

// Applies saved settings to a live editor.
export function applySettings(editor, s = settings.get()) {
  editor.updateOptions({fontSize: s.fontSize, minimap: {enabled: s.minimap}, wordWrap: s.wordWrap, quickSuggestions: s.autocomplete, suggestOnTriggerCharacters: s.autocomplete, wordBasedSuggestions: s.autocomplete ? 'currentDocument' : 'off'});
  editor.getModel()?.updateOptions({tabSize: s.tabSize});
}
