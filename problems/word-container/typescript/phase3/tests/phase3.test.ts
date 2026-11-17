import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { WordContainer } from '../src/container.ts';
import { generateWords, searchPatterns, slotPatterns } from './generator.ts';

// The whole grid-fill batch (500 queries on a 130k-word dictionary) must finish in this time.
const BATCH_MS = 2000;

// Awkward shapes: leading stars, several stars, stars between blanks.
const TRICKY = ['*ing', '*a*a*', '?*?*?', '*oo*', 'b*b', '*x', '???*???', '*e?e*', 's*s*s', '?'];

/** Independent check: the pattern as a regular expression, tried on every word. */
function bruteForce(words: string[], pattern: string, limit: number | null = null): string[] {
  const regex = new RegExp(`^${pattern.replace(/\?/g, '[a-z]').replace(/\*/g, '[a-z]*')}$`);
  const found = words.filter(word => regex.test(word));
  return limit === null ? found : found.slice(0, limit);
}

const summary = (found: string[]) => [found.length, found.slice(0, 3), found.slice(-3)];

describe('medium dictionary', () => {
  let words: WordContainer;
  let listed: string[];
  before(() => {
    words = new WordContainer(generateWords(11, 20000));
    listed = [...words];
  });

  test('dictionary size', () => {
    assert.equal(words.size, 19084);
  });

  test('known answers', () => {
    assert.deepEqual(words.match('br??k*'), [
      'brack', 'brarkeetroun', 'brecksilbrats', 'breekour', 'briekoal',
      'briekoulls', 'briekout', 'brookoonts', 'broxkais', 'brudkaiing']);
    assert.deepEqual(words.match('s?a?e'), ['seaze', 'slabe']);
    assert.deepEqual(words.match('*ooo*'), ['boooodthoob', 'liebroooop', 'nooostciex', 'yoooy']);
    assert.deepEqual(words.match('?*z'), []);
    assert.deepEqual(words.match('q*'), []);
  });

  test('broad patterns', () => {
    const cases = {
      '?oo?': [72, ['boog', 'bool', 'boom'], ['zoop', 'zoos', 'zoot']],
      '*ing': [1153, ['ailling', 'airing', 'aisleating'], ['zydnaing', 'zyllthiexing', 'zyting']],
      '??????': [1833, ['aibtai', 'aichee', 'ailler'], ['zynpie', 'zyting', 'zytwos']],
      '*a*e*i*': [218, ['aisleating', 'aitmeaing', 'aitveeting'], ['zasitweasing', 'zauntslenwai', 'zeaketmid']],
      '??????????????????*': [13, ['braindstougjending', 'braingshaunclecking', 'deantchoondclinter'],
        ['speentploolconging', 'stierfloackbriered', 'stoungspeantpleast']],
    };
    for (const [pattern, expected] of Object.entries(cases)) {
      assert.deepEqual(summary(words.match(pattern)), expected, `pattern ${pattern}`);
    }
    assert.deepEqual(words.match('*'), listed);
  });

  test('limits', () => {
    assert.deepEqual(words.match('s*', 5), ['sa', 'sab', 'sabbat', 'sabot', 'sabraclour']);
    assert.deepEqual(words.match('*ing', 4), ['ailling', 'airing', 'aisleating', 'aitmeaing']);
    assert.deepEqual(words.match('?e?e*', 6), ['bedeadbrall', 'beeed', 'beeeed', 'behextecker', 'bekeed', 'bereater']);
  });

  test('generated queries agree with brute force', () => {
    const patterns = [...slotPatterns(listed, 5, 30), ...searchPatterns(listed, 6, 20), ...TRICKY];
    for (const pattern of patterns) assert.deepEqual(words.match(pattern), bruteForce(listed, pattern), `pattern ${pattern}`);
    for (const pattern of TRICKY) assert.deepEqual(words.match(pattern, 7), bruteForce(listed, pattern, 7), `pattern ${pattern}, limit 7`);
  });
});

describe('mutation', () => {
  test('results track additions and removals', () => {
    const words = new WordContainer(generateWords(3, 6000));
    const listed = [...words];
    const queries = [...slotPatterns(listed, 8, 15), ...searchPatterns(listed, 9, 10), ...TRICKY, '*', '????????????*'];
    for (const pattern of queries) words.match(pattern); // warm up anything an implementation caches
    const retired = listed.filter((word, i) => i % 3 === 0 || word.length > 11);
    for (const word of retired) assert.equal(words.remove(word), true, `remove ${word}`);
    const newcomers = generateWords(4, 3000);
    words.addAll(newcomers);
    const gone = new Set(retired);
    const current = [...new Set([...listed.filter(word => !gone.has(word)), ...newcomers])].sort();
    assert.deepEqual([...words], current);
    for (const pattern of queries) assert.deepEqual(words.match(pattern), bruteForce(current, pattern), `pattern ${pattern}`);
    assert.deepEqual(words.match('*ing', 5), bruteForce(current, '*ing', 5));
  });
});

describe('scale', () => {
  let words: WordContainer;
  let batch: [string, number | null][];
  before(() => {
    words = new WordContainer(generateWords(2024, 150000));
    const listed = [...words];
    // A grid-fill pass: slots with crossing letters known, plus solver-panel searches.
    batch = [
      ...slotPatterns(listed, 77, 400).map(pattern => [pattern, null]),
      ...searchPatterns(listed, 78, 100).map(pattern => [pattern, 20]),
    ];
  });

  test('large dictionary spot checks', () => {
    assert.equal(words.size, 130128);
    assert.deepEqual(words.match('th??n'), ['thaun', 'thean', 'theen', 'thien', 'thoan', 'thoon']);
    const found = words.match('b?ea?');
    assert.deepEqual([found.length, found.slice(0, 4), found.slice(-2)], [13, ['beeai', 'biead', 'bieai', 'bieas'], ['breat', 'breay']]);
    assert.deepEqual(words.match('dr?n*', 4), ['dran', 'dranaas', 'dranboobougy', 'drancested']);
  });

  test('grid-fill batch is fast', () => {
    let found = 0;
    let letters = 0;
    const start = performance.now();
    for (let done = 1; done <= batch.length; done++) {
      const [pattern, limit] = batch[done - 1];
      const result = words.match(pattern, limit);
      found += result.length;
      for (const word of result) letters += word.length;
      const elapsed = performance.now() - start;
      if (elapsed > BATCH_MS) {
        assert.fail(`only ${done} of ${batch.length} queries finished in ${elapsed.toFixed(0)}ms; the whole batch must finish in under ${BATCH_MS}ms`);
      }
    }
    assert.deepEqual([found, letters], [5766, 41753], 'batch returned the wrong words');
  });
});
