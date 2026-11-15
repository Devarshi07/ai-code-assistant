const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { Suggester } = require('../src/suggest');
const { largeDictionary, typoBatch } = require('./corpus');

const SIZE = 20000; // entries in the full dictionary
const BATCH = 1000; // right-click lookups in the timed test
const LIMIT_MS = 1500; // allowed for the whole batch

let shared = null;

/** The large dictionary and one Suggester over it, built once per run. */
function setup() {
  if (!shared) {
    const dictionary = largeDictionary(SIZE);
    const suggester = new Suggester(dictionary);
    suggester.suggest('warm'); // let lazy indexes finish building
    shared = { dictionary, suggester };
  }
  return shared;
}

describe('large dictionary', () => {
  test('dictionary size', () => {
    assert.equal(setup().dictionary.size, SIZE);
  });

  test('typos of real words', () => {
    const { suggester } = setup();
    assert.deepEqual(suggester.suggest('recieve'), ['relieve', 'receive', 'believe']);
    assert.deepEqual(suggester.suggest('teh', 8), ['tea', 'tel', 'te', 'ted', 'tee', 'tech', 'ten', 'the']);
    assert.deepEqual(suggester.suggest('unfortunatelly'), ['unfortunately']);
  });

  test('apostrophes and accents', () => {
    const { suggester } = setup();
    assert.deepEqual(suggester.suggest('dont', 7), ["don't", 'done', 'don', 'dout', 'dond', 'dong', 'dot']);
    assert.deepEqual(suggester.suggest('cafe', 6), ['came', 'pafe', 'ceafe', 'cale', 'eafe', 'café']);
  });

  test('very short words', () => {
    const { suggester } = setup();
    assert.deepEqual(suggester.suggest('e', 12), ['e', 'be', 'a', 'i', 'he', 'we', 'me', 'pe', 'em', 'je', 'fe', 'ne']);
    assert.deepEqual(suggester.suggest('ab', 12), ['a', 'as', 'at', 'an', 'ad', 'ar', 'am', 'al', 'ai', 'be', 'to', 'of']);
  });

  test('generated words', () => {
    const { suggester } = setup();
    assert.deepEqual(suggester.suggest('siling', 12), ['siling', 'kiling', 'miling', 'riling', 'tiling', 'iling',
      'liling', 'niling', 'saling', 'griling', 'soing', 'sudiling']);
    assert.deepEqual(suggester.suggest('leck', 12), ['leck', 'neck', 'weck', 'lecks', 'deck', 'peck', 'beck',
      'leeck', 'cleck', 'jeck', 'seck', 'fleck']);
    assert.deepEqual(suggester.suggest('thnd', 12), ['tond', 'thad', 'thand', 'tand', 'tynd', 'thond', 'thind',
      'thed', 'tind', 'the', 'and', 'that']);
    assert.deepEqual(suggester.suggest('tad', 12), ['tad', 'had', 'bad', 'lad', 'thad', 'zad', 'ad', 'tas',
      'tand', 'dad', 'tat', 'tal']);
  });

  test('long and unmatched words', () => {
    const { suggester } = setup();
    assert.deepEqual(suggester.suggest('plumtobued'), ['plumtobued']);
    assert.deepEqual(suggester.suggest('xqzvbnm'), []);
  });

  test('batch of lookups is fast', () => {
    const { dictionary, suggester } = setup();
    const batch = typoBatch(dictionary, BATCH);
    const results = [];
    const start = performance.now();
    for (const word of batch) {
      results.push(suggester.suggest(word));
      if (performance.now() - start > 3 * LIMIT_MS) break; // far too slow already; stop early
    }
    const elapsed = performance.now() - start;
    assert.equal(results.length, BATCH,
      `only ${results.length} of ${BATCH} lookups finished in ${elapsed.toFixed(0)}ms; all ${BATCH} must finish in under ${LIMIT_MS}ms`);
    assert.deepEqual(results[0], ['view', 'voai', 'vis', 'vist', 'viga']);
    assert.deepEqual(results[2], ['zond', 'foud', 'zou', 'loud', 'noud']);
    assert.deepEqual(results[49], []);
    assert.deepEqual(results[500], ['valing', 'vanding', 'tanging', 'vatreing', 'nanging']);
    assert.deepEqual(results[999], ['lon', 'lose', 'lost', 'los', 'on']);
    assert.equal(results.reduce((sum, r) => sum + r.length, 0), 2306, 'total suggestions across the batch');
    assert.ok(elapsed < LIMIT_MS, `${BATCH} lookups took ${elapsed.toFixed(0)}ms; they must finish in under ${LIMIT_MS}ms`);
  });
});
