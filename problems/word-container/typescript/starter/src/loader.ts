// Reading word lists into a WordContainer.
//
// Lists are UTF-8 text with one entry per line:
//
//   # comment lines start with '#'; blank lines are skipped
//   apple
//   Ice cream        stored as "icecream"
//   jalapeño;60      "entry;score" lines from crossword lists; the score is ignored
//
// A bad entry is recorded in the LoadReport instead of throwing, so one stray
// line does not abort an import. The bundled lists live in data/: core.txt holds
// everyday words and the themed packs (sports.txt, kitchen.txt) overlap it.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WordContainer } from './container.ts';
import { InvalidWord } from './normalize.ts';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
export const BUNDLED = ['core', 'sports', 'kitchen'];

export interface Rejected {
  line: number;
  entry: string;
  reason: string;
}

/** What happened while importing one list. */
export class LoadReport {
  source: string;
  added = 0;
  duplicates = 0;
  rejected: Rejected[] = [];

  constructor(source: string) {
    this.source = source;
  }

  summary(): string {
    let text = `${this.source}: ${this.added} added, ${this.duplicates} already stored`;
    if (this.rejected.length) text += `, ${this.rejected.length} rejected`;
    return text;
  }
}

/** Yields [line number, entry] for every line that holds an entry. */
export function* entries(text: string): Generator<[number, string]> {
  // Lists exported from spreadsheets often start with a byte-order mark.
  const lines = text.replace(/^\uFEFF+/, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i].split(';', 1)[0].trim();
    if (entry && !entry.startsWith('#')) yield [i + 1, entry];
  }
}

/** Add every entry in text to container and report what happened. */
export function loadText(container: WordContainer, text: string, source = '<text>'): LoadReport {
  const report = new LoadReport(source);
  for (const [line, entry] of entries(text)) {
    let isNew: boolean;
    try {
      isNew = container.add(entry);
    } catch (error) {
      if (!(error instanceof InvalidWord)) throw error;
      report.rejected.push({ line, entry, reason: error.message });
      continue;
    }
    if (isNew) report.added++;
    else report.duplicates++;
  }
  return report;
}

export function loadFile(container: WordContainer, file: string): LoadReport {
  return loadText(container, readFileSync(file, 'utf8'), basename(file));
}

/** Import bundled lists in order; returns one LoadReport per list. */
export function loadBundled(container: WordContainer, names: string[] = BUNDLED): LoadReport[] {
  return names.map(name => loadFile(container, `${DATA_DIR}${name}.txt`));
}
