const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Word } = require('../src/models');
const { filterWords, loadWordList, parseWordList } = require('../src/wordlist');
const { bestSelection } = require('../src/solver');

/** Independent check: a real board built from the candidates, honestly scored. */
function assertValidSelection(candidates, result) {
  const pool = new Set(candidates.map(c => (c instanceof Word ? c.text : c.trim().toLowerCase())));
  const words = [...result.words];
  assert.deepEqual(words, [...words].sort(), 'words must be in alphabetical order');
  const seen = new Set();
  for (const word of words) {
    assert.ok(pool.has(word), `'${word}' is not one of the candidates`);
    assert.equal(new Set(word).size, word.length, `'${word}' repeats a letter`);
    for (const ch of word) {
      assert.ok(!seen.has(ch), `'${word}' reuses '${ch}', which is already on the board`);
      seen.add(ch);
    }
  }
  assert.equal(result.total, words.reduce((sum, word) => sum + word.length, 0), 'total must count every tile');
}

function check(candidates, words, total, message) {
  const result = bestSelection(candidates);
  assertValidSelection(candidates, result);
  assert.equal(result.total, total, message);
  assert.deepEqual([...result.words], words, message);
}

describe('bestSelection', () => {
  test('three animals fit together', () => {
    check(['cat', 'dog', 'bird', 'fish'], ['cat', 'dog', 'fish'], 10);
  });

  test('words with repeated letters are never used', () => {
    check(['letter', 'otter', 'cab', 'dim'], ['cab', 'dim'], 6);
  });

  test('longest word first is not optimal', () => {
    check(['blanket', 'trophy', 'jumbled', 'fix'], ['fix', 'jumbled', 'trophy'], 16, 'two medium words beat the longest word');
  });

  test('tie goes to the alphabetically first word list', () => {
    // 'pod tan' and 'and top' both cover the same six letters.
    check(['tan', 'pod', 'top', 'and'], ['and', 'top'], 6);
  });

  test('anagram tie picks the first spelling', () => {
    check(['pot', 'top', 'opt', 'and'], ['and', 'opt'], 6);
  });

  test('words are normalized and deduplicated', () => {
    check(['Tango', 'tango', ' FLY ', 'jinx'], ['fly', 'tango'], 8);
  });

  test('nothing playable gives an empty board', () => {
    check([], [], 0);
    check(['otter', 'llama', 'kiwi'], [], 0);
  });

  test('sixteen candidates with five tied boards', () => {
    const candidates = ['quiz', 'jumpy', 'vex', 'fjord', 'glyph', 'brick', 'wealth', 'stomp', 'dwarf', 'nymph',
      'sculpt', 'garden', 'volcano', 'kiosk', 'whisky', 'zebra'];
    check(candidates, ['dwarf', 'glyph', 'quiz', 'vex'], 17);
  });

  test('accepts words from the loader', () => {
    check(parseWordList('Banjo 2 music\nharp 1 music\nsax 2 music\nflute 1 music\n'), ['banjo', 'flute'], 10);
  });

  test('music theme from the word list', () => {
    check(filterWords(loadWordList(), { theme: 'music', maxDifficulty: 2 }), ['chord', 'flute', 'jam'], 13);
  });

  test('kitchen theme from the word list', () => {
    check(filterWords(loadWordList(), { theme: 'kitchen', maxDifficulty: 2 }), ['bread', 'fig', 'plum', 'wok'], 15);
  });
});
