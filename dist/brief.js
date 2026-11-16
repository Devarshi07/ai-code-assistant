// Turns a phase's instructions (markdown) into the parts the question panel
// shows separately: the reports that start a bug hunt, the task itself and its
// "Done when" goal. Pure string work, so it also runs under node:test.

const QUOTE = /^\s{0,3}>/;
const DONE = /^\s*(?:\*\*Done when:?\*\*:?|Done when:)\s*(.+)$/i;

const trimBlank = lines => {
  let start = 0, end = lines.length;
  while (start < end && !lines[start].trim()) start++;
  while (end > start && !lines[end - 1].trim()) end--;
  return lines.slice(start, end);
};

// Single asterisks outside code spans, used to toggle italics inside a quote
// that is already shown in italics.
const dropToggles = text => text.split(/(`[^`]*`)/).map((part, i) => i % 2 ? part : part.replace(/(?<!\*)\*(?!\*)/g, '')).join('');

// One report: who sent it (from "**Mobile team:** …" or "… (Alice)") and its text.
// "**Mobile team:**", "*Expo:*" or "_Support:_" at the start of a quote line.
const SENDER = /^(?:\*\*([^*\n]{2,48}?):?\*\*:?|\*([^*\n]{2,48}?):\*|_([^_\n]{2,48}?):_)\s+/;

export function parseReport(source) {
  let text = String(source || '').trim(), who = null;
  const prefix = text.match(SENDER);
  if (prefix) { who = (prefix[1] || prefix[2] || prefix[3]).trim().replace(/:$/, ''); text = text.slice(prefix[0].length).trim(); }
  const suffix = text.match(/^([\s\S]*["”]\*?)\s*\(([^()\n]{2,48})\)\s*$/);
  if (suffix) { who = who || suffix[2].trim(); text = suffix[1].trim(); }
  // *"…"* or "…": the card adds its own quote styling.
  const wrapped = text.match(/^\*(?!\*)([\s\S]*?)(?<!\*)\*$/);
  if (wrapped) text = dropToggles(wrapped[1]).trim();
  const quoted = text.match(/^["“]([\s\S]*)["”]$/);
  if (quoted) text = quoted[1].trim();
  return {who, text};
}

// {segments, done, reports}: the instructions in their original order as text
// and report segments (consecutive quotes form one segment), plus the goal.
export function parseInstructions(source) {
  const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
  const segments = [];
  let text = [], done = null, reports = 0, fence = null;
  const pushText = () => { const markdown = trimBlank(text).join('\n'); if (markdown) segments.push({type: 'text', markdown}); text = []; };
  for (let i = 0; i < lines.length;) {
    // Code blocks stay text: a ">>> " prompt in one is not a report.
    const marker = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (fence || marker) {
      if (fence && marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*(`{3,}|~{3,})\s*$/.test(lines[i])) fence = null;
      else if (!fence && marker) fence = marker[1];
      text.push(lines[i++]);
      continue;
    }
    if (QUOTE.test(lines[i])) {
      const quote = [];
      while (i < lines.length && QUOTE.test(lines[i])) quote.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      // One quote block can hold several reports, one per "Sender:" line.
      const starts = quote.map((line, n) => SENDER.test(line.trim()) ? n : -1).filter(n => n >= 0);
      const groups = starts.length > 1 ? [quote.slice(0, starts[0]), ...starts.map((s, k) => quote.slice(s, starts[k + 1] ?? quote.length))] : [quote];
      for (const group of groups) {
        const report = parseReport(group.join('\n'));
        if (!report.text) continue;
        pushText();
        const last = segments[segments.length - 1];
        if (last?.type === 'reports') last.reports.push(report); else segments.push({type: 'reports', reports: [report]});
        reports++;
      }
      continue;
    }
    const goal = lines[i].match(DONE);
    if (goal && !done) { done = goal[1].trim(); i++; continue; }
    text.push(lines[i]);
    i++;
  }
  pushText();
  return {segments, done, reports};
}

// Paths in backticks that name files in the workspace, in order of appearance.
export function mentionedFiles(markdown, files) {
  const found = [];
  for (const match of String(markdown || '').matchAll(/`([^`\n]+)`/g)) {
    const path = resolveFile(match[1], files);
    if (path && !found.includes(path)) found.push(path);
  }
  return found;
}

// A code span or link target to a workspace file: an exact path, or a file
// name that only one file has.
export function resolveFile(text, files, from = '') {
  let name = String(text || '').trim().replace(/[#?].*$/, '');
  // Spaces mean prose ("npm test"), unless a link encoded them.
  if (/\s/.test(name)) return null;
  try { if (/%[0-9a-f]{2}/i.test(name)) name = decodeURIComponent(name); } catch {}
  // "/src/app.py" in a README means the repository root.
  const rooted = name.startsWith('/');
  name = name.replace(/^\/+/, '').replace(/^\.\//, '');
  if (!name || name.length > 300 || /[\n\t]/.test(name) || !/[\w-]\.[A-Za-z]\w*$/.test(name)) return null;
  // A link in docs/README.md to "setup.md" means docs/setup.md, before any root file.
  if (!rooted && from && from.includes('/')) {
    const joined = normalize(from.slice(0, from.lastIndexOf('/') + 1) + name);
    if (joined && files.includes(joined)) return joined;
  }
  const exact = normalize(name);
  if (exact && files.includes(exact)) return exact;
  if (rooted || name.includes('..')) return null;
  const matches = files.filter(f => f.endsWith('/' + name));
  return matches.length === 1 ? matches[0] : null;
}
function normalize(path) {
  const out = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!out.length) return null; out.pop(); } else out.push(part);
  }
  return out.join('/');
}

// Where a test that a runner reported by display name lives in its file, most
// exact first: the name in quotes (node:test), then unittest and JUnit method
// declarations, then looser forms. A bare substring comes last, so "stays
// whole" can't win over "contractions typed on mobile stay whole".
export function testNameCandidates(name) {
  const full = String(name || '').trim();
  const last = full.split('›').pop().trim();
  const words = last.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const snake = words.join('_');
  const camel = words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join('');
  const quoted = text => [`'${text}'`, `"${text}"`, `\`${text}\``];
  return [...new Set([
    ...quoted(last), ...(full !== last ? quoted(full) : []),
    snake ? `def test_${snake}(` : '', snake ? `def ${snake}(` : '', camel ? `void ${camel}(` : '',
    snake ? `test_${snake}` : '', camel, last, full
  ].filter(s => s && s.replace(/[^\w]/g, '').length > 2))];
}
