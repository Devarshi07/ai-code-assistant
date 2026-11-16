import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import type { Token } from '../src/tokenizer.ts';
import { Dictionary } from '../src/dictionary.ts';
import { SpellChecker } from '../src/checker.ts';
import type { Misspelling } from '../src/checker.ts';
import { formatReport, lineCol, underline } from '../src/report.ts';

const WORDS = Dictionary.load();

const spans = (tokens: Token[]) => tokens.map(t => [t.text, t.start, t.end]);
const issues = (text: string) => new SpellChecker(WORDS).check(text).map(m => [m.word, m.start, m.end]);

describe('tokenizer', () => {
  test('words and offsets', () => {
    assert.deepEqual(spans(tokenize('Hello, world!')), [['Hello', 0, 5], ['world', 7, 12]]);
  });

  test('hyphenated words are split', () => {
    assert.deepEqual(spans(tokenize('A well-known, half-baked idea')), [
      ['A', 0, 1], ['well', 2, 6], ['known', 7, 12], ['half', 14, 18], ['baked', 19, 24], ['idea', 25, 29],
    ]);
  });

  test('numbers are skipped', () => {
    assert.deepEqual(spans(tokenize('Room 204 at 10am on the 3rd')), [
      ['Room', 0, 4], ['at', 9, 11], ['on', 17, 19], ['the', 20, 23],
    ]);
  });

  test('apostrophes inside words', () => {
    assert.deepEqual(spans(tokenize("I don't think it's 5 o'clock")), [
      ['I', 0, 1], ["don't", 2, 7], ['think', 8, 13], ["it's", 14, 18], ["o'clock", 21, 28],
    ]);
  });

  test('quotes around words are not part of them', () => {
    assert.deepEqual(spans(tokenize("'Draft' notes, the students' work")), [
      ['Draft', 1, 6], ['notes', 8, 13], ['the', 15, 18], ['students', 19, 27], ['work', 29, 33],
    ]);
  });

  test('smart quotes around words', () => {
    assert.deepEqual(spans(tokenize('She wrote ‘mispelled’ twice')), [
      ['She', 0, 3], ['wrote', 4, 9], ['mispelled', 11, 20], ['twice', 22, 27],
    ]);
  });

  test('contractions typed on mobile stay whole', () => {
    assert.deepEqual(spans(tokenize('We don’t ship until it’s ready')), [
      ['We', 0, 2], ['don’t', 3, 8], ['ship', 9, 13], ['until', 14, 19], ['it’s', 20, 24], ['ready', 25, 30],
    ]);
  });
});

describe('checker', () => {
  test('misspellings are reported with offsets', () => {
    assert.deepEqual(issues('I recieve too many emials.'), [['recieve', 2, 9], ['emials', 19, 25]]);
  });

  test('case does not matter', () => {
    assert.deepEqual(issues('Tomorrow the team mets. Monday works.'), [['mets', 18, 22]]);
    const checker = new SpellChecker(WORDS, { ignoreUppercase: false });
    assert.deepEqual(checker.check('TOMORROW Works'), []);
  });

  test('acronyms are skipped', () => {
    assert.deepEqual(issues('Ask NASA about the API'), []);
    const checker = new SpellChecker(WORDS, { ignoreUppercase: false });
    assert.deepEqual(checker.check('Ask NASA about the API').map(m => m.word), ['NASA', 'API']);
  });

  test('contractions and possessives', () => {
    assert.deepEqual(issues("I don't know if the team's draft is done, but it's close."), []);
  });

  test('ignore all accepts a word', () => {
    const checker = new SpellChecker(WORDS);
    assert.deepEqual(checker.check('Deploy Kubernetes today'), [
      { word: 'Deploy', start: 0, end: 6 }, { word: 'Kubernetes', start: 7, end: 17 },
    ]);
    checker.ignore('kubernetes');
    checker.ignore('DEPLOY');
    assert.deepEqual(checker.check('Deploy Kubernetes today'), []);
  });

  test('contractions typed on mobile', () => {
    assert.deepEqual(issues('I don’t know if it’s done, and we can’t wait.'), []);
  });

  test('possessives typed on mobile', () => {
    assert.deepEqual(issues('The team’s notes are in the project’s folder.'), []);
  });

  test('misspellings next to mobile contractions', () => {
    assert.deepEqual(issues('Ths isn’t rihgt, they’re late'), [['Ths', 0, 3], ['rihgt', 10, 15]]);
  });
});

describe('report', () => {
  const TEXT = 'Standup notes\nShipped the calender view.\nTeh end';
  const FOUND: Misspelling[] = [{ word: 'calender', start: 26, end: 34 }, { word: 'Teh', start: 41, end: 44 }];

  test('line and column', () => {
    assert.deepEqual(lineCol(TEXT, 0), [1, 1]);
    assert.deepEqual(lineCol(TEXT, 26), [2, 13]);
    assert.deepEqual(lineCol(TEXT, 41), [3, 1]);
  });

  test('underline marks each word', () => {
    assert.equal(underline(TEXT, FOUND), [
      'Standup notes',
      'Shipped the calender view.',
      '            ^^^^^^^^',
      'Teh end',
      '^^^',
    ].join('\n'));
  });

  test('report rows', () => {
    assert.equal(formatReport(TEXT, FOUND), '2 spelling issues:\n  2:13    calender\n  3:1     Teh');
    assert.equal(formatReport(TEXT, []), 'No spelling issues found.');
  });

  test('report with suggestions', () => {
    const options: Record<string, string[]> = { calender: ['calendar'], Teh: [] };
    assert.equal(formatReport(TEXT, FOUND, word => options[word]), [
      '2 spelling issues:',
      '  2:13    calender      -> calendar',
      '  3:1     Teh           (no suggestions)',
    ].join('\n'));
  });
});
