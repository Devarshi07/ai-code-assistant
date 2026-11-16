// Syntax highlighting and a small, safe markdown renderer. All text is escaped
// before markup is added, so model output and problem text can't inject HTML.

export const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

const PY_KEYWORDS = 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case';
const PY_BUILTINS = 'abs all any bin bool bytes callable chr dict dir divmod enumerate filter float format frozenset getattr hasattr hash hex id input int isinstance issubclass iter len list map max min next object open ord pow print property range repr reversed round set setattr slice sorted staticmethod classmethod str sum super tuple type vars zip self cls Exception ValueError TypeError KeyError IndexError NotImplementedError RuntimeError StopIteration AssertionError';
const JS_KEYWORDS = 'async await break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new of return static super switch this throw try typeof var void while with yield null undefined true false';
const JS_BUILTINS = 'Array Boolean Date Error Infinity JSON Map Math NaN Number Object Promise RegExp Set String Symbol TypeError RangeError WeakMap console module require exports process performance BigInt Float64Array Int32Array Uint8Array Int8Array Uint32Array';

const words = list => new Set(list.split(' '));
// Shared token patterns. Groups: comment, block string, string, annotation, number, word.
const C_LIKE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:\\[\s\S]|[^`\\])*`?)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n]){0,2}'?)|(@[A-Za-z_][\w.]*|#!?\[[^\]\n]*\]?|^[ \t]*#[ \t]*(?:include|define|undef|ifn?def|if|elif|else|endif|pragma|error)\b[^\n]*)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?[uUlLfFn]*\b|\b0x[\da-f]+\b)|(\$?[A-Za-z_][\w$]*)/gim;
const HASH = /(#[^\n]*)|((?!))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(@{1,2}[A-Za-z_]\w*|:[A-Za-z_]\w*[?!]?|\$[A-Za-z_{][\w}]*)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_][\w-]*[?!]?)/gim;
const spec = (pattern, keywords, builtins = '') => ({pattern, keywords: words(keywords), builtins: words(builtins)});
const LANGS = {
  python: {
    keywords: words(PY_KEYWORDS), builtins: words(PY_BUILTINS),
    pattern: /(#[^\n]*)|([rbfu]{0,2}"""[\s\S]*?(?:"""|$)|[rbfu]{0,2}'''[\s\S]*?(?:'''|$))|([rbfu]{0,2}"(?:\\.|[^"\\\n])*"?|[rbfu]{0,2}'(?:\\.|[^'\\\n])*'?)|(@[A-Za-z_][\w.]*)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?j?\b|\b0x[\da-f]+\b)|([A-Za-z_]\w*)/gi
  },
  javascript: {
    keywords: words(JS_KEYWORDS + ' interface type enum implements namespace declare readonly private public protected abstract as keyof'), builtins: words(JS_BUILTINS),
    pattern: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:\\[\s\S]|[^`\\])*`?)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(@[A-Za-z_]\w*)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?\b|\b0x[\da-f]+\b)|([A-Za-z_$][\w$]*)/gi
  },
  go: spec(C_LIKE, 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota', 'append cap close copy delete len make new panic print println recover error string int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr byte rune bool float32 float64 any'),
  java: spec(C_LIKE, 'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try void volatile while var val fun null true false record yield when object override data sealed', 'String Integer Long Boolean Object List Map Set ArrayList HashMap Optional System Exception RuntimeException'),
  c: spec(C_LIKE, 'auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false nullptr class namespace template typename public private protected virtual override new delete this using try catch throw constexpr noexcept operator friend explicit mutable static_cast dynamic_cast reinterpret_cast const_cast NULL', 'std size_t string vector map unique_ptr shared_ptr printf malloc free memcpy strlen'),
  csharp: spec(C_LIKE, 'abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while async await get set record', 'Console List Dictionary Task String Exception'),
  rust: spec(C_LIKE, 'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while', 'Vec String Option Result Box Rc Arc RefCell HashMap HashSet Some None Ok Err println format vec panic assert assert_eq i8 i16 i32 i64 i128 u8 u16 u32 u64 u128 usize isize f32 f64 bool str char'),
  php: spec(C_LIKE, 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty extends final finally fn for foreach function global goto if implements include include_once instanceof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while yield null true false self parent', 'strlen count array_map array_filter in_array sprintf'),
  swift: spec(C_LIKE, 'class deinit enum extension func import init inout internal let operator private protocol public static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil rethrows super self Self throw throws true try async await', 'String Int Double Bool Array Dictionary print'),
  ruby: spec(HASH, 'alias and begin break case class def defined do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield require require_relative attr_accessor attr_reader attr_writer private protected public raise lambda proc', 'puts print p Array Hash String Integer'),
  shell: spec(HASH, 'if then else elif fi for while do done case esac function return in export local echo set unset source true false', 'cd ls rm cp mv mkdir grep sed awk cat python node npm pip git make')
};
const ALIASES = {py: 'python', python: 'python', python3: 'python', js: 'javascript', javascript: 'javascript', node: 'javascript', ts: 'javascript', typescript: 'javascript', json: 'javascript', jsx: 'javascript', tsx: 'javascript',
  go: 'go', golang: 'go', java: 'java', kotlin: 'java', kt: 'java', scala: 'java', c: 'c', h: 'c', cpp: 'c', 'c++': 'c', cc: 'c', hpp: 'c', cs: 'csharp', csharp: 'csharp', rust: 'rust', rs: 'rust', php: 'php',
  swift: 'swift', ruby: 'ruby', rb: 'ruby', sh: 'shell', bash: 'shell', shell: 'shell', zsh: 'shell', console: 'shell', yaml: 'shell', yml: 'shell', toml: 'shell', dockerfile: 'shell', make: 'shell', makefile: 'shell', r: 'shell', perl: 'shell', pl: 'shell', ex: 'shell', exs: 'shell', elixir: 'shell'};
const EXTENSIONS = {py: 'python', js: 'javascript', cjs: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'javascript', tsx: 'javascript', json: 'javascript', go: 'go', java: 'java', kt: 'java', kts: 'java', scala: 'java', c: 'c', h: 'c', cc: 'c', cpp: 'c', cxx: 'c', hpp: 'c', hh: 'c', cs: 'csharp', rs: 'rust', php: 'php', swift: 'swift', rb: 'ruby', rake: 'ruby', gemspec: 'ruby', sh: 'shell', bash: 'shell', zsh: 'shell', yml: 'shell', yaml: 'shell', toml: 'shell', cfg: 'shell', ini: 'shell', r: 'shell', pl: 'shell', pm: 'shell', ex: 'shell', exs: 'shell'};

export function languageOf(name = '') {
  const base = String(name).split('/').pop();
  if (/^(Makefile|Dockerfile|Gemfile|Rakefile)$/i.test(base)) return /^(Gemfile|Rakefile)$/i.test(base) ? 'ruby' : 'shell';
  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  if (ext && EXTENSIONS[ext]) return EXTENSIONS[ext];
  return ALIASES[String(name).toLowerCase()] || null;
}

// Returns highlighted HTML for code (escaped).
export function highlight(code, language) {
  const spec = LANGS[ALIASES[language] || language];
  if (!spec) return escapeHtml(code);
  let out = '', last = 0, previousWord = '';
  spec.pattern.lastIndex = 0;
  for (let match; (match = spec.pattern.exec(code));) {
    if (match[0] === '') { spec.pattern.lastIndex++; continue; }
    out += escapeHtml(code.slice(last, match.index));
    last = match.index + match[0].length;
    const text = escapeHtml(match[0]);
    if (match[1]) out += `<span class="tok-comment">${text}</span>`;
    else if (match[2]) out += `<span class="tok-string">${text}</span>`;
    else if (match[3]) out += `<span class="tok-string">${text}</span>`;
    else if (match[4]) out += `<span class="tok-decorator">${text}</span>`;
    else if (match[5]) out += `<span class="tok-number">${text}</span>`;
    else {
      const word = match[0];
      const next = code.slice(last).match(/^\s*\(/);
      if (spec.keywords.has(word)) out += `<span class="tok-keyword">${text}</span>`;
      else if (['def', 'function', 'class', 'func', 'fn', 'fun', 'struct', 'interface', 'trait', 'enum', 'module'].includes(previousWord)) out += `<span class="tok-def">${text}</span>`;
      else if (spec.builtins.has(word)) out += `<span class="tok-builtin">${text}</span>`;
      else if (next) out += `<span class="tok-call">${text}</span>`;
      else if (/^[A-Z][A-Z0-9_]+$/.test(word) && word.length > 1) out += `<span class="tok-constant">${text}</span>`;
      else out += text;
      previousWord = word;
      continue;
    }
    previousWord = '';
  }
  return out + escapeHtml(code.slice(last));
}

// Links: web links open in a new tab; with options.relativeLinks, a relative
// path becomes a link the page can handle (data-path); other targets show
// their label only. Text is already escaped, so attributes can't be broken out of.
function link(label, url, options) {
  if (/^https?:\/\//i.test(url)) return `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>`;
  if (options.relativeLinks && !/^[a-z][\w+.-]*:/i.test(url) && !url.startsWith('//')) {
    return url.startsWith('#') ? `<span class="md-anchor">${label}</span>` : `<a href="#" class="md-file-link" data-path="${url}">${label}</a>`;
  }
  return label;
}

function inline(text, options = {}) {
  // Escape first, then add markup to the escaped text. Code spans and links
  // are set aside first so emphasis never reaches into them. The markers that
  // hold them (\u0000n\u0000) can't come from the input, and a URL can never
  // contain one, so restored markup only ever lands in element content.
  let html = escapeHtml(String(text ?? '').replace(/\u0000/g, ''));
  const held = [];
  const hold = markup => { held.push(markup); return `\u0000${held.length - 1}\u0000`; };
  html = html
    .replace(/``([^`]+?)``|`([^`]+)`/g, (_, a, b) => hold(`<code>${a !== undefined ? a.trim() : b}</code>`))
    .replace(/!\[([^\]]*)\]\(([^)\s\u0000]+)(?:\s+&quot;[^&\u0000]*&quot;)?\)/g, (_, alt) => hold(`<span class="md-image">${alt ? `[image: ${alt}]` : '[image]'}</span>`))
    .replace(/\[([^\]]+)\]\(([^)\s\u0000]+)(?:\s+&quot;[^&\u0000]*&quot;)?\)/g, (_, label, url) => hold(link(label, url, options)))
    .replace(/&lt;(https?:\/\/[^\s&\u0000]+)&gt;/g, (_, url) => hold(link(url, url, options)))
    .replace(/&lt;br\s*\/?&gt;/gi, () => hold('<br>'));
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
  // Link labels may hold code spans, so restore in a few passes.
  for (let pass = 0; pass < 3 && /\u0000\d+\u0000/.test(html); pass++) html = html.replace(/\u0000(\d+)\u0000/g, (_, n) => held[Number(n)]);
  return html;
}

function codeBlock(code, language, {onCopy, codeActions = []} = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'md-code';
  const bar = document.createElement('div');
  bar.className = 'md-code-bar';
  const label = document.createElement('span');
  label.textContent = language || 'text';
  // Extra buttons, such as "Insert in editor", supplied by the caller.
  const extras = codeActions.map(({label: text, title, action}) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'md-copy';
    button.textContent = text;
    if (title) button.title = title;
    button.addEventListener('click', () => action(code, language));
    return button;
  });
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'md-copy';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(code); copy.textContent = 'Copied'; }
    catch { copy.textContent = 'Select & copy'; }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
    onCopy?.(code);
  });
  bar.append(label, ...extras, copy);
  const pre = document.createElement('pre');
  const element = document.createElement('code');
  element.innerHTML = highlight(code, language);
  pre.append(element);
  wrapper.append(bar, pre);
  return wrapper;
}

// Renders markdown into a DocumentFragment. Options: language (for unlabelled
// code), headingOffset (# becomes h(1 + offset); 2 by default, for chat),
// softBreaks (wrapped lines join like a README on GitHub; otherwise a newline
// is a line break, as chat replies expect), relativeLinks, document (also
// indented code blocks), codeActions and onCopy for code blocks.
export function renderMarkdown(source, options = {}) {
  const fragment = document.createDocumentFragment();
  renderBlocks(dropComments(String(source || '').replace(/\r\n?/g, '\n').split('\n')), fragment, options);
  return fragment;
}

const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const indentOf = line => line.length - line.trimStart().length;
const startsBlock = line => LIST_ITEM.test(line) || FENCE.test(line) || /^\s{0,3}(#{1,6}\s|>)/.test(line) || HR.test(line);
const tableCells = row => {
  let text = row.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
};

// HTML comments on their own lines (README badges, notes to editors) are
// hidden. Comments inside code blocks and inline text are left as written.
function dropComments(lines) {
  const out = [];
  let fence = null, comment = false;
  for (const line of lines) {
    if (comment) { if (line.includes('-->')) comment = false; continue; }
    const marker = line.match(FENCE);
    if (fence) { if (new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(line)) fence = null; out.push(line); continue; }
    if (marker) { fence = marker[2]; out.push(line); continue; }
    if (/^\s{0,3}<!--/.test(line)) { if (!line.slice(line.indexOf('<!--') + 4).includes('-->')) comment = true; continue; }
    out.push(line);
  }
  return out;
}

function renderBlocks(lines, parent, options) {
  const paragraph = [];
  const flush = () => {
    if (!paragraph.length) return;
    const p = document.createElement('p');
    p.innerHTML = joinLines(paragraph, options);
    parent.append(p);
    paragraph.length = 0;
  };
  const heading = (level, text) => {
    const h = document.createElement(`h${Math.min(6, level + (options.headingOffset ?? 2))}`);
    h.innerHTML = inline(text, options);
    parent.append(h);
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(FENCE);
    if (fence) {
      flush();
      const indent = fence[1].length;
      const closing = new RegExp(`^\\s*${fence[2][0] === '`' ? '`' : '~'}{${fence[2].length},}\\s*$`);
      const body = [];
      i++;
      while (i < lines.length && !closing.test(lines[i])) { const raw = lines[i++]; body.push(raw.slice(Math.min(indent, indentOf(raw)))); }
      i++;
      parent.append(codeBlock(body.join('\n'), fence[3] || options.language || '', options));
      continue;
    }
    const atx = line.match(/^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/);
    if (atx) { flush(); heading(atx[1].length, atx[2]); i++; continue; }
    // In documents, a single line underlined with === or --- is a heading. In
    // chat, "That is the fix.\n---" means a rule, so it stays a paragraph.
    if (options.document && !paragraph.length && line.trim() && !startsBlock(line) && !/^\s*\|/.test(line) && /^\s{0,3}(=+|-{2,})\s*$/.test(lines[i + 1] || '')) {
      heading(lines[i + 1].trim()[0] === '=' ? 1 : 2, line.trim());
      i += 2;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      flush();
      const quote = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) quote.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      const block = document.createElement('blockquote');
      renderBlocks(quote, block, options);
      parent.append(block);
      continue;
    }
    // A table needs a delimiter row with pipes and as many cells as its header.
    const rule = lines[i + 1] || '';
    if (line.includes('|') && rule.includes('|') && rule.includes('-') && TABLE_RULE.test(rule) && tableCells(line).length === tableCells(rule).length) {
      flush();
      i = renderTable(lines, i, parent, options);
      continue;
    }
    if (HR.test(line)) { flush(); parent.append(document.createElement('hr')); i++; continue; }
    const item = line.match(LIST_ITEM);
    // Only a list starting at 1 can interrupt a paragraph ("version\n2. Next" is one paragraph).
    if (item && !(paragraph.length && /\d/.test(item[2]) && parseInt(item[2], 10) !== 1)) { flush(); i = renderList(lines, i, parent, options); continue; }
    if (!line.trim()) { flush(); i++; continue; }
    if (options.document && !paragraph.length && /^( {4}|\t)/.test(line)) {
      const body = [];
      while (i < lines.length && (/^( {4}|\t)/.test(lines[i]) || (!lines[i].trim() && /^( {4}|\t)/.test(lines[i + 1] || '')))) body.push(lines[i++].replace(/^( {4}|\t)/, ''));
      parent.append(codeBlock(body.join('\n'), options.language || '', options));
      continue;
    }
    paragraph.push(line);
    i++;
  }
  flush();
}

// Lines of one paragraph: joined with spaces (softBreaks) or line breaks. A
// line ending in two spaces or a backslash always breaks.
function joinLines(lines, options) {
  if (!options.softBreaks) return lines.map(line => inline(line, options)).join('<br>');
  return lines.map((line, n) => {
    const last = n === lines.length - 1;
    const hard = !last && /( {2,}|\\)$/.test(line);
    return inline(line.trim().replace(/\\$/, ''), options) + (last ? '' : hard ? '<br>' : ' ');
  }).join('');
}

function renderTable(lines, start, parent, options) {
  const cells = tableCells;
  const align = cells(lines[start + 1]).map(rule => rule.startsWith(':') && rule.endsWith(':') ? 'center' : rule.endsWith(':') ? 'right' : '');
  const table = document.createElement('table');
  const thead = document.createElement('thead'), head = document.createElement('tr');
  cells(lines[start]).forEach((cell, n) => { const th = document.createElement('th'); th.innerHTML = inline(cell, options); if (align[n]) th.style.textAlign = align[n]; head.append(th); });
  thead.append(head);
  table.append(thead);
  const tbody = document.createElement('tbody');
  let i = start + 2;
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    const tr = document.createElement('tr');
    cells(lines[i++]).forEach((cell, n) => { const td = document.createElement('td'); td.innerHTML = inline(cell, options); if (align[n]) td.style.textAlign = align[n]; tr.append(td); });
    tbody.append(tr);
  }
  table.append(tbody);
  const scroll = document.createElement('div');
  scroll.className = 'md-table';
  scroll.append(table);
  parent.append(scroll);
  return i;
}

// A list and its items, nested lists and paragraphs included. Items separated
// by blank lines stay one list, so numbering continues.
function renderList(lines, start, parent, options) {
  const first = lines[start].match(LIST_ITEM);
  const base = first[1].length, ordered = /\d/.test(first[2]);
  const list = document.createElement(ordered ? 'ol' : 'ul');
  if (ordered && parseInt(first[2], 10) !== 1) list.start = parseInt(first[2], 10);
  let i = start;
  while (i < lines.length) {
    const item = lines[i].match(LIST_ITEM);
    if (!item || item[1].length > base + 1 || item[1].length + 1 < base || /\d/.test(item[2]) !== ordered) break;
    const contentIndent = item[1].length + item[2].length + 1;
    const body = [item[3] || ''];
    let blank = false;
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) { body.push(''); blank = true; i++; continue; }
      const indent = indentOf(next);
      if (LIST_ITEM.test(next) && indent <= base + 1) break;
      if (indent > base) { body.push(next.slice(Math.min(indent, contentIndent))); blank = false; i++; continue; }
      // A wrapped line that isn't indented still belongs to the item.
      if (!blank && !startsBlock(next) && !/^\s*\|/.test(next)) { body.push(next.trim()); i++; continue; }
      break;
    }
    while (body.length > 1 && !body[body.length - 1].trim()) body.pop();
    const li = document.createElement('li');
    const task = body[0].match(/^\[( |x|X)\]\s+(.*)$/);
    if (task) { li.className = 'md-task'; li.dataset.done = String(task[1] !== ' '); body[0] = task[2]; }
    const simple = !body.some(line => !line.trim()) && !body.slice(1).some(line => startsBlock(line) || /^\s*\|/.test(line));
    if (simple) li.innerHTML = joinLines(body, options);
    else renderBlocks(body, li, options);
    if (task) li.prepend(Object.assign(document.createElement('span'), {className: 'md-check', textContent: task[1] === ' ' ? '☐' : '☑'}));
    list.append(li);
  }
  parent.append(list);
  return i;
}

export function codeView(code, language) {
  const pre = document.createElement('pre');
  pre.className = 'code-view';
  const element = document.createElement('code');
  element.innerHTML = highlight(code, language);
  pre.append(element);
  return pre;
}
