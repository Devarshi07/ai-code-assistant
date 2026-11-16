// Plain-text views of spell-check results, for the CLI and support logs.
import type { Misspelling } from './checker.ts';

/** Turns a misspelled word into the replacements to list for it. */
export type SuggestFn = (word: string) => string[];

/** 1-based [line, column] of a character offset in text. */
export function lineCol(text: string, offset: number): [number, number] {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return [line, column];
}

/** The text with a row of marks under each misspelled word. */
export function underline(text: string, misspellings: Misspelling[], mark = '^'): string {
  const out: string[] = [];
  let lineStart = 0;
  for (const line of text.split('\n')) {
    const lineEnd = lineStart + line.length;
    const marks: string[] = new Array(line.length).fill(' ');
    for (const m of misspellings) {
      for (let i = Math.max(m.start, lineStart); i < Math.min(m.end, lineEnd); i++) marks[i - lineStart] = mark;
    }
    out.push(line);
    if (marks.includes(mark)) out.push(marks.join('').trimEnd());
    lineStart = lineEnd + 1;
  }
  return out.join('\n');
}

/**
 * One row per misspelling: line:column, the word, and suggestions.
 * suggest, when given, is called with each misspelled word and returns the
 * replacements to list.
 */
export function formatReport(text: string, misspellings: Misspelling[], suggest: SuggestFn | null = null): string {
  if (!misspellings.length) return 'No spelling issues found.';
  const noun = misspellings.length === 1 ? 'issue' : 'issues';
  const rows = [`${misspellings.length} spelling ${noun}:`];
  for (const m of misspellings) {
    const [line, column] = lineCol(text, m.start);
    let row = `  ${line}:${column}`.padEnd(10) + m.word;
    if (suggest) {
      const options = suggest(m.word);
      row = row.padEnd(24) + (options.length ? `-> ${options.join(', ')}` : '(no suggestions)');
    }
    rows.push(row);
  }
  return rows.join('\n');
}
