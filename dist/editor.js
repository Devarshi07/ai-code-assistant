// A lightweight code editor: a transparent textarea over a highlighted <pre>,
// with line numbers, auto-indent, block indent/dedent and comment toggling.
import {highlight} from './markdown.js';

const OPENERS = {'{': '}', '[': ']', '(': ')'};

export class CodeEditor {
  constructor(root, {onChange = () => {}, onSave = () => {}, onRun = () => {}, onPaste = () => {}, onCursor = () => {}} = {}) {
    this.root = root;
    this.callbacks = {onChange, onSave, onRun, onPaste, onCursor};
    this.language = null;
    this.indentUnit = '    ';
    this.lineCount = 0;
    root.classList.add('code-editor');
    root.innerHTML = '<div class="ce-gutter" aria-hidden="true"><pre class="ce-lines"></pre></div><div class="ce-body"><div class="ce-active" aria-hidden="true"></div><pre class="ce-highlight" aria-hidden="true"><code></code></pre><textarea class="ce-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Code editor"></textarea></div><div class="ce-empty" hidden></div>';
    this.gutter = root.querySelector('.ce-lines');
    this.code = root.querySelector('.ce-highlight code');
    this.pre = root.querySelector('.ce-highlight');
    this.active = root.querySelector('.ce-active');
    this.input = root.querySelector('.ce-input');
    this.empty = root.querySelector('.ce-empty');
    this.input.addEventListener('input', () => { this.schedule(); this.callbacks.onChange(this.input.value); });
    this.input.addEventListener('scroll', () => this.sync());
    this.input.addEventListener('keydown', event => this.keydown(event));
    this.input.addEventListener('paste', event => { const text = event.clipboardData?.getData('text/plain'); if (text) this.callbacks.onPaste(text); });
    for (const type of ['keyup', 'click', 'focus', 'select']) this.input.addEventListener(type, () => this.cursorMoved());
    document.addEventListener('selectionchange', () => { if (document.activeElement === this.input) this.cursorMoved(); });
    new ResizeObserver(() => this.sync()).observe(this.input);
  }

  get value() { return this.input.value; }

  setDocument(text, {language = null, readOnly = false, placeholder = ''} = {}) {
    this.language = language;
    this.indentUnit = language === 'python' ? '    ' : '  ';
    this.input.value = text;
    this.input.readOnly = readOnly;
    this.root.classList.toggle('readonly', readOnly);
    this.empty.hidden = !placeholder;
    this.empty.textContent = placeholder;
    this.input.hidden = !!placeholder;
    this.input.setSelectionRange(0, 0);
    this.render();
    this.input.scrollTop = 0;
    this.input.scrollLeft = 0;
    this.sync();
  }

  setReadOnly(readOnly) {
    this.input.readOnly = readOnly;
    this.root.classList.toggle('readonly', readOnly);
  }

  focus() { this.input.focus({preventScroll: true}); }

  viewState() { return {scrollTop: this.input.scrollTop, scrollLeft: this.input.scrollLeft, start: this.input.selectionStart, end: this.input.selectionEnd}; }

  restore(state) {
    if (!state) return;
    this.input.setSelectionRange(Math.min(state.start, this.input.value.length), Math.min(state.end, this.input.value.length));
    this.input.scrollTop = state.scrollTop;
    this.input.scrollLeft = state.scrollLeft;
    this.sync();
  }

  schedule() {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => { this.pending = null; this.render(); });
  }

  render() {
    const text = this.input.value;
    this.code.innerHTML = highlight(text, this.language) + '\n';
    const lines = text.split('\n').length;
    if (lines !== this.lineCount) {
      this.lineCount = lines;
      let numbers = '';
      for (let i = 1; i <= lines; i++) numbers += i + '\n';
      this.gutter.textContent = numbers;
    }
    this.sync();
    this.cursorMoved();
  }

  sync() {
    const {scrollTop, scrollLeft} = this.input;
    this.pre.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
    this.gutter.style.transform = `translateY(${-scrollTop}px)`;
    this.positionActive();
  }

  cursorMoved() {
    const before = this.input.value.slice(0, this.input.selectionStart);
    const line = before.split('\n').length;
    const column = before.length - before.lastIndexOf('\n');
    if (line !== this.cursorLine) { this.cursorLine = line; this.positionActive(); }
    this.callbacks.onCursor({line, column});
  }

  positionActive() {
    const height = parseFloat(getComputedStyle(this.input).lineHeight) || 20;
    const top = parseFloat(getComputedStyle(this.input).paddingTop) || 0;
    this.active.style.transform = `translateY(${top + ((this.cursorLine || 1) - 1) * height - this.input.scrollTop}px)`;
    this.active.style.height = height + 'px';
  }

  insert(text, selectStart, selectEnd) {
    this.input.focus();
    // execCommand keeps the browser's native undo history intact.
    if (!document.execCommand('insertText', false, text)) {
      this.input.setRangeText(text, this.input.selectionStart, this.input.selectionEnd, 'end');
      this.input.dispatchEvent(new Event('input'));
    }
    if (selectStart !== undefined) this.input.setSelectionRange(selectStart, selectEnd ?? selectStart);
  }

  lineRange() {
    const value = this.input.value;
    const start = value.lastIndexOf('\n', this.input.selectionStart - 1) + 1;
    let endIndex = this.input.selectionEnd;
    if (endIndex > start && value[endIndex - 1] === '\n') endIndex--;
    const nextBreak = value.indexOf('\n', endIndex);
    const end = nextBreak < 0 ? value.length : nextBreak;
    return {start, end, text: value.slice(start, end)};
  }

  replaceLines(transform) {
    const {start, end, text} = this.lineRange();
    const lines = text.split('\n');
    const next = transform(lines);
    this.input.setSelectionRange(start, end);
    this.insert(next.join('\n'));
    this.input.setSelectionRange(start, start + next.join('\n').length);
  }

  keydown(event) {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); this.callbacks.onSave(); return; }
    if (mod && event.key === 'Enter') { event.preventDefault(); this.callbacks.onRun(); return; }
    if (this.input.readOnly) return;
    if (mod && event.key === '/') {
      event.preventDefault();
      const marker = this.language === 'python' ? '#' : '//';
      this.replaceLines(lines => {
        const code = lines.filter(line => line.trim());
        const commented = code.length && code.every(line => line.trimStart().startsWith(marker));
        const indent = Math.min(...code.map(line => line.match(/^\s*/)[0].length));
        return lines.map(line => {
          if (!line.trim()) return line;
          if (commented) return line.replace(new RegExp(`^(\\s*)${marker.replace(/\//g, '\\/')} ?`), '$1');
          return line.slice(0, indent) + marker + ' ' + line.slice(indent);
        });
      });
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const {selectionStart, selectionEnd, value} = this.input;
      const multiline = value.slice(selectionStart, selectionEnd).includes('\n');
      if (event.shiftKey || multiline) {
        const unit = this.indentUnit;
        this.replaceLines(lines => lines.map(line => event.shiftKey ? line.replace(new RegExp(`^ {1,${unit.length}}|^\\t`), '') : (line.trim() ? unit + line : line)));
      } else this.insert(this.indentUnit);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !mod && !event.altKey) {
      event.preventDefault();
      const {selectionStart, value} = this.input;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const current = value.slice(lineStart, selectionStart);
      let indent = current.match(/^\s*/)[0];
      const before = current.trimEnd();
      const last = before.slice(-1);
      const nextChar = value[this.input.selectionEnd];
      if ((this.language === 'python' && last === ':') || OPENERS[last]) indent += this.indentUnit;
      if (OPENERS[last] && nextChar === OPENERS[last]) {
        const outer = indent.slice(0, -this.indentUnit.length);
        const insertAt = selectionStart + 1 + indent.length;
        this.insert('\n' + indent + '\n' + outer, insertAt);
        return;
      }
      this.insert('\n' + indent);
      return;
    }
    if (event.key === 'Backspace' && !mod) {
      const {selectionStart, selectionEnd, value} = this.input;
      if (selectionStart !== selectionEnd) return;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const before = value.slice(lineStart, selectionStart);
      if (before.length && /^ +$/.test(before)) {
        const remove = before.length % this.indentUnit.length || this.indentUnit.length;
        event.preventDefault();
        this.input.setSelectionRange(selectionStart - remove, selectionStart);
        this.insert('');
      }
      return;
    }
    if ((event.key === '}' || event.key === ']' || event.key === ')') && this.language !== 'python') {
      const {selectionStart, value} = this.input;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const before = value.slice(lineStart, selectionStart);
      if (before.length >= this.indentUnit.length && /^ +$/.test(before)) {
        event.preventDefault();
        this.input.setSelectionRange(selectionStart - this.indentUnit.length, selectionStart);
        this.insert(event.key);
      }
    }
  }
}
