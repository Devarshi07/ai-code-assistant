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
const fs = require('node:fs');
const path = require('node:path');
const { InvalidWord } = require('./normalize');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BUNDLED = ['core', 'sports', 'kitchen'];

/** What happened while importing one list. */
class LoadReport {
  constructor(source) {
    this.source = source;
    this.added = 0;
    this.duplicates = 0;
    this.rejected = []; // { line, entry, reason }
  }

  summary() {
    let text = `${this.source}: ${this.added} added, ${this.duplicates} already stored`;
    if (this.rejected.length) text += `, ${this.rejected.length} rejected`;
    return text;
  }
}

/** Yields [line number, entry] for every line that holds an entry. */
function* entries(text) {
  // Lists exported from spreadsheets often start with a byte-order mark.
  const lines = text.replace(/^﻿+/, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const entry = lines[i].split(';', 1)[0].trim();
    if (entry && !entry.startsWith('#')) yield [i + 1, entry];
  }
}

/** Add every entry in text to container and report what happened. */
function loadText(container, text, source = '<text>') {
  const report = new LoadReport(source);
  for (const [line, entry] of entries(text)) {
    let isNew;
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

function loadFile(container, file) {
  return loadText(container, fs.readFileSync(file, 'utf8'), path.basename(file));
}

/** Import bundled lists in order; returns one LoadReport per list. */
function loadBundled(container, names = BUNDLED) {
  return names.map(name => loadFile(container, path.join(DATA_DIR, `${name}.txt`)));
}

module.exports = { BUNDLED, DATA_DIR, LoadReport, entries, loadText, loadFile, loadBundled };
