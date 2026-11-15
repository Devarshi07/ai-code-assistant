// Line diffs for approval cards and change previews.
import {el} from './ui.js';

// Returns [{op: ' ' | '+' | '-', text, a, b}] where a/b are 1-based line numbers.
export function lineDiff(before = '', after = '') {
  const a = before === null ? [] : String(before).split('\n');
  const b = after === null ? [] : String(after).split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const rows = [];
  for (let i = 0; i < start; i++) rows.push({op: ' ', text: a[i], a: i + 1, b: i + 1});
  const midA = a.slice(start, endA), midB = b.slice(start, endB);
  if (midA.length * midB.length <= 2500000) {
    // Longest common subsequence over the changed middle.
    const n = midA.length, m = midB.length;
    const table = Array.from({length: n + 1}, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) { rows.push({op: ' ', text: midA[i], a: start + i + 1, b: start + j + 1}); i++; j++; }
      // Removed lines come before the lines that replace them.
      else if (i < n && (j === m || table[i + 1][j] >= table[i][j + 1])) { rows.push({op: '-', text: midA[i], a: start + i + 1}); i++; }
      else { rows.push({op: '+', text: midB[j], b: start + j + 1}); j++; }
    }
  } else {
    midA.forEach((text, i) => rows.push({op: '-', text, a: start + i + 1}));
    midB.forEach((text, j) => rows.push({op: '+', text, b: start + j + 1}));
  }
  for (let i = endA, j = endB; i < a.length; i++, j++) rows.push({op: ' ', text: a[i], a: i + 1, b: j + 1});
  return rows;
}

export function diffCounts(rows) {
  return {added: rows.filter(r => r.op === '+').length, removed: rows.filter(r => r.op === '-').length};
}

// A compact unified view: changed lines with `context` lines around them.
export function diffView(before, after, {context = 3, maxRows = 400} = {}) {
  const rows = lineDiff(before ?? '', after ?? '');
  const keep = new Array(rows.length).fill(false);
  rows.forEach((row, i) => { if (row.op !== ' ') for (let k = Math.max(0, i - context); k <= Math.min(rows.length - 1, i + context); k++) keep[k] = true; });
  const out = el('div', {class: 'diff-view', role: 'table', 'aria-label': 'Changes'});
  let shown = 0, skipped = false;
  rows.forEach((row, i) => {
    if (!keep[i]) { if (!skipped && shown) out.append(el('div', {class: 'diff-gap', text: '⋯'})); skipped = true; return; }
    skipped = false;
    if (shown++ >= maxRows) return;
    out.append(el('div', {class: `diff-row ${row.op === '+' ? 'add' : row.op === '-' ? 'del' : ''}`},
      el('span', {class: 'ln', text: row.a ?? ''}), el('span', {class: 'ln', text: row.b ?? ''}),
      el('span', {class: 'op', text: row.op}), el('span', {class: 'tx', text: row.text || ' '})));
  });
  if (shown > maxRows) out.append(el('div', {class: 'diff-gap', text: `… ${shown - maxRows} more lines`}));
  if (!shown) out.append(el('div', {class: 'diff-gap', text: 'No line changes.'}));
  return out;
}
