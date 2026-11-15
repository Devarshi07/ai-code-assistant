const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { InvalidWord, normalizeWord } = require('../src/normalize');
const { WordContainer } = require('../src/container');
const { loadBundled, loadText } = require('../src/loader');
const { letterBreakdown } = require('../src/report');

// Every bundled list, normalised and de-duplicated, holds this many words.
const BUNDLED_TOTAL = 447;
const BUNDLED_FIRST_LETTERS = {
  a: 27, b: 48, c: 50, d: 18, e: 9, f: 23, g: 20, h: 14, i: 6,
  j: 14, k: 10, l: 15, m: 18, n: 10, o: 9, p: 31, q: 3, r: 24,
  s: 45, t: 21, u: 4, v: 6, w: 15, y: 4, z: 3,
};

function bundledStore() {
  const words = new WordContainer();
  loadBundled(words);
  return words;
}

const sample = () => new WordContainer(['cat', 'cart', 'cot']);

describe('normalizeWord', () => {
  test('lowercases and strips accents', () => {
    assert.equal(normalizeWord('Café'), 'cafe');
    assert.equal(normalizeWord('  NAÏVE '), 'naive');
    assert.equal(normalizeWord('Jalapeño'), 'jalapeno');
  });

  test('drops spaces, hyphens and apostrophes', () => {
    assert.equal(normalizeWord('ice cream'), 'icecream');
    assert.equal(normalizeWord('Jiu-Jitsu'), 'jiujitsu');
    assert.equal(normalizeWord("o'clock"), 'oclock');
    assert.equal(normalizeWord('rock ’n’ roll'), 'rocknroll');
  });

  test('rejects entries that are not words', () => {
    for (const raw of ['r2d2', '24/7', 'c++', '', '   ', '-']) {
      assert.throws(() => normalizeWord(raw), InvalidWord, `${JSON.stringify(raw)} should be rejected`);
    }
  });
});

describe('WordContainer', () => {
  test('add reports new and repeated words', () => {
    const words = sample();
    assert.equal(words.add('coat'), true);
    assert.equal(words.add('Cat'), false);
    assert.equal(words.size, 4);
  });

  test('lookups ignore case and accents', () => {
    const words = sample();
    assert.ok(words.has('CAT'));
    words.add('Café');
    assert.ok(words.has('cafe'));
    assert.ok(words.has(' CAFÉ '));
    assert.equal(words.has('r2d2'), false);
  });

  test('a prefix is not a word', () => {
    const words = sample();
    assert.equal(words.has('car'), false);
    assert.equal(words.has('ca'), false);
    assert.equal(words.has('carts'), false);
  });

  test('iterates in alphabetical order', () => {
    const words = sample();
    words.addAll(['act', 'cut', 'a', 'coat']);
    assert.deepEqual([...words], ['a', 'act', 'cart', 'cat', 'coat', 'cot', 'cut']);
  });

  test('withPrefix lists completions', () => {
    const words = sample();
    assert.deepEqual([...words.withPrefix('CA')], ['cart', 'cat']);
    assert.deepEqual([...words.withPrefix('dog')], []);
  });

  test('count by prefix', () => {
    const words = sample();
    assert.equal(words.count('ca'), 2);
    assert.equal(words.count('cot'), 1);
    assert.equal(words.count('x'), 0);
    assert.equal(words.count(), 3);
  });

  test('remove forgets the word', () => {
    const words = sample();
    assert.equal(words.remove('cart'), true);
    assert.equal(words.has('cart'), false);
    assert.equal(words.remove('cart'), false);
    assert.equal(words.count('car'), 0);
    assert.deepEqual([...words], ['cat', 'cot']);
  });

  test('re-adding a word leaves counts alone', () => {
    const words = sample();
    words.add('Cat');
    words.add('cat ');
    assert.equal(words.size, 3);
    assert.equal(words.count(), 3, 'count() must agree with size');
    assert.equal(words.count('ca'), 2, "only cat and cart start with 'ca'");
  });

  test('retiring a word that was imported twice', () => {
    const words = sample();
    words.add('squash');
    words.add('Squash');
    assert.equal(words.remove('squash'), true);
    assert.equal(words.has('squash'), false);
    assert.deepEqual([...words.withPrefix('squ')], []);
    assert.equal(words.count('squ'), 0, "no stored word starts with 'squ' any more");
  });
});

describe('loader', () => {
  test('loadText reports duplicates and rejects', () => {
    const words = new WordContainer();
    const report = loadText(words, '# fruit\napple\nApple\n\n24/7\nbanana;40\n  pear  \n', 'fruit.txt');
    assert.deepEqual([report.added, report.duplicates], [3, 1]);
    assert.deepEqual(report.rejected.map(({ line, entry }) => [line, entry]), [[5, '24/7']]);
    assert.deepEqual([...words], ['apple', 'banana', 'pear']);
  });

  test('bundled lists import summary', () => {
    const words = new WordContainer();
    const reports = loadBundled(words);
    assert.deepEqual(reports.map(r => [r.added, r.duplicates, r.rejected.length]), [[339, 1, 2], [67, 10, 0], [41, 18, 0]]);
    assert.equal(words.size, BUNDLED_TOTAL);
  });

  test('letter breakdown adds up to the total', () => {
    const words = bundledStore();
    const breakdown = Object.fromEntries(letterBreakdown(words));
    const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
    assert.equal(sum, words.size, 'the A-Z rows must add up to the headline total');
    assert.deepEqual(breakdown, BUNDLED_FIRST_LETTERS);
  });

  test('prefix badges match the listed completions', () => {
    const words = bundledStore();
    for (const prefix of ['bowl', 'squ', 'ba', 'ca', 's']) {
      assert.equal(words.count(prefix), [...words.withPrefix(prefix)].length, `badge for '${prefix}'`);
    }
  });
});
