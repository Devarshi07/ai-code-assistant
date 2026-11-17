import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { WordContainer } from '../src/container.ts';
import { PatternError, parsePattern } from '../src/pattern.ts';
import { loadBundled } from '../src/loader.ts';

const SAMPLE = ['cat', 'cot', 'cut', 'cute', 'cuts', 'coat', 'cart', 'chart', 'comet',
  'act', 'at', 'a', 'scat', 'tact', 'cactus'];

const fits = (pattern: string, word: string): boolean => parsePattern(pattern).matches(word);
const sample = () => new WordContainer(SAMPLE);

describe('Pattern#matches', () => {
  test('question mark is exactly one letter', () => {
    assert.equal(fits('c?t', 'cat'), true);
    assert.equal(fits('c?t', 'cot'), true);
    for (const word of ['ct', 'coat', 'scat', 'cats']) assert.equal(fits('c?t', word), false, `c?t should not match ${word}`);
  });

  test('star matches any run including none', () => {
    for (const word of ['ct', 'cat', 'chart']) assert.equal(fits('c*t', word), true, `c*t should match ${word}`);
    assert.equal(fits('c*t', 'cats'), false);
    assert.equal(fits('c*t', 'act'), false);
    assert.equal(fits('*', 'a'), true);
    assert.equal(fits('cat*', 'cat'), true);
  });

  test('stars can give letters back', () => {
    assert.equal(fits('*ab', 'aab'), true);
    assert.equal(fits('*ab', 'abab'), true);
    assert.equal(fits('*ab', 'aba'), false);
    assert.equal(fits('a*b*c', 'aabbcc'), true);
    assert.equal(fits('a*b*c', 'acb'), false);
    assert.equal(fits('*a*a', 'banana'), true);
    assert.equal(fits('*s*s*s*', 'mississippi'), true);
  });

  test('question marks and stars together', () => {
    assert.equal(fits('?*?', 'a'), false);
    assert.equal(fits('?*?', 'ab'), true);
    assert.equal(fits('?*?', 'abc'), true);
    assert.equal(fits('ba??na*', 'banana'), true);
    assert.equal(fits('ba??na*', 'bandana'), false);
    assert.equal(fits('*a*a', 'a'), false);
  });
});

describe('WordContainer#match', () => {
  test('crossword clue', () => {
    assert.deepEqual(sample().match('c?t'), ['cat', 'cot', 'cut']);
  });

  test('trailing star keeps alphabetical order', () => {
    assert.deepEqual(sample().match('c?t*'), ['cat', 'cot', 'cut', 'cute', 'cuts']);
  });

  test('stars anywhere', () => {
    const words = sample();
    assert.deepEqual(words.match('c*t'), ['cart', 'cat', 'chart', 'coat', 'comet', 'cot', 'cut']);
    assert.deepEqual(words.match('*at'), ['at', 'cat', 'coat', 'scat']);
    assert.deepEqual(words.match('*a*t*'), ['act', 'at', 'cactus', 'cart', 'cat', 'chart', 'coat', 'scat', 'tact']);
    assert.deepEqual(words.match('*c*c*'), ['cactus']);
  });

  test('whole store and fixed lengths', () => {
    const words = sample();
    assert.deepEqual(words.match('*'), [...SAMPLE].sort());
    assert.deepEqual(words.match('????'), ['cart', 'coat', 'cute', 'cuts', 'scat', 'tact']);
    assert.deepEqual(words.match('?'), ['a']);
    assert.deepEqual(words.match('*t?'), ['cute', 'cuts']);
  });

  test('no matches', () => {
    const words = sample();
    assert.deepEqual(words.match('q??'), []);
    assert.deepEqual(words.match('??????????'), []);
  });

  test('limit returns the alphabetically first matches', () => {
    const words = sample();
    assert.deepEqual(words.match('c*', 3), ['cactus', 'cart', 'cat']);
    assert.deepEqual(words.match('*t', 2), ['act', 'at']);
    assert.deepEqual(words.match('c?t', 0), []);
    assert.deepEqual(words.match('c?t', 50), ['cat', 'cot', 'cut']);
  });

  test('negative limit is rejected', () => {
    assert.throws(() => sample().match('c?t', -1), RangeError);
  });

  test('patterns are normalised', () => {
    const words = sample();
    assert.deepEqual(words.match('C.T'), ['cat', 'cot', 'cut']);
    assert.deepEqual(words.match('c_t'), ['cat', 'cot', 'cut']);
    assert.deepEqual(words.match(parsePattern('C?T')), ['cat', 'cot', 'cut']);
    words.add('Café');
    assert.deepEqual(words.match('CAF?'), ['cafe']);
  });

  test('invalid patterns throw', () => {
    const words = sample();
    for (const raw of ['c4t', '', 'c+t']) assert.throws(() => words.match(raw), PatternError, `${JSON.stringify(raw)} is not a pattern`);
  });

  test('results follow additions and removals', () => {
    const words = sample();
    words.remove('cot');
    words.add('KIT');
    words.add('Cat');
    assert.deepEqual(words.match('c?t'), ['cat', 'cut']);
    assert.deepEqual(words.match('?it'), ['kit']);
  });
});

describe('bundled lists', () => {
  let words: WordContainer;
  before(() => {
    words = new WordContainer();
    loadBundled(words);
  });

  test('solver panel searches', () => {
    assert.deepEqual(words.match('b??l'), ['ball', 'bell', 'boil', 'bowl']);
    assert.deepEqual(words.match('*ball'), ['ball', 'baseball', 'basketball', 'football', 'netball', 'tball', 'volleyball']);
    assert.deepEqual(words.match('*ing'), ['bowling', 'boxing', 'curling', 'cycling', 'diving', 'fencing', 'king', 'rowing', 'wing']);
    assert.deepEqual(words.match('c*e', 6), ['cafe', 'cake', 'candle', 'canoe', 'castle', 'cave']);
  });

  test('five letter slot', () => {
    const found = words.match('??a??');
    assert.equal(found.length, 28);
    assert.deepEqual(found.slice(0, 4), ['alarm', 'beach', 'blade', 'brain']);
    assert.deepEqual(found.slice(-3), ['toast', 'train', 'whale']);
  });
});
