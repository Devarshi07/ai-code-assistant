// Text views of the store, used by the CLI and the editors' stats panel.
const BAR_WIDTH = 30;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

/** [letter, words starting with it] for every first letter in use. */
function letterBreakdown(container) {
  const rows = [];
  for (const letter of ALPHABET) {
    const total = container.count(letter);
    if (total) rows.push([letter, total]);
  }
  return rows;
}

function plural(n, word) {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

/** Headline total plus an A-Z bar chart. */
function formatStoreReport(container, title = 'Word store') {
  const rows = letterBreakdown(container);
  const widest = rows.reduce((most, [, total]) => Math.max(most, total), 1);
  const lines = [`${title}: ${plural(container.size, 'word')}`];
  for (const [letter, total] of rows) {
    const bar = '#'.repeat(Math.max(1, Math.floor((BAR_WIDTH * total + Math.floor(widest / 2)) / widest)));
    lines.push(`  ${letter}  ${bar.padEnd(BAR_WIDTH)} ${String(total).padStart(4)}`);
  }
  lines.push(`  A-Z total: ${rows.reduce((sum, [, total]) => sum + total, 0)}`);
  return lines.join('\n');
}

/** One autocomplete line: the badge count and the first few completions. */
function formatPrefix(container, prefix, shown = 6) {
  const total = container.count(prefix);
  const words = [];
  for (const word of container.withPrefix(prefix)) {
    if (words.length === shown) break;
    words.push(word);
  }
  const more = total > words.length ? ` (+${total - words.length} more)` : '';
  const listed = words.length ? words.join(', ') : '-';
  return `${prefix}...  ${plural(total, 'word')}: ${listed}${more}`;
}

/** One pattern-search line, noting when the list was cut at limit. */
function formatMatches(pattern, words, limit = null) {
  if (!words.length) return `${pattern}  no matches`;
  const cut = limit !== null && words.length === limit ? ' ...' : '';
  return `${pattern}  ${words.join(', ')}${cut}`;
}

module.exports = { letterBreakdown, formatStoreReport, formatPrefix, formatMatches };
