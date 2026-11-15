const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Dictionary } = require('../src/dictionary');
const { SpellChecker } = require('../src/checker');
const { Suggester, editDistance } = require('../src/suggest');

const WORDS = Dictionary.load();

// Every word here except "damper" is one or two edits away from "lamp".
const RANKING = Dictionary.parse(`
lamp 40
lamb 40
limp 90
lump 10
lam 5
clamp 40
camp 300
ramp 40
lisp 70
clasp 500
lumps 999
damper 1000
`);

describe('editDistance', () => {
  test('identical and empty', () => {
    assert.equal(editDistance('note', 'note'), 0);
    assert.equal(editDistance('', ''), 0);
    assert.equal(editDistance('', 'abc'), 3);
    assert.equal(editDistance('abc', ''), 3);
  });

  test('single edits', () => {
    assert.equal(editDistance('note', 'notes'), 1, 'insertion');
    assert.equal(editDistance('notes', 'note'), 1, 'deletion');
    assert.equal(editDistance('note', 'nose'), 1, 'substitution');
    assert.equal(editDistance('calender', 'calendar'), 1);
    assert.equal(editDistance('tomorow', 'tomorrow'), 1);
  });

  test('swapped letters cost two', () => {
    assert.equal(editDistance('teh', 'the'), 2);
    assert.equal(editDistance('recieve', 'receive'), 2);
    assert.equal(editDistance('ab', 'ba'), 2);
  });

  test('longer distances', () => {
    assert.equal(editDistance('flaw', 'lawn'), 2);
    assert.equal(editDistance('receipt', 'recipe'), 2);
    assert.equal(editDistance('spelling', 'misspelled'), 6);
    assert.equal(editDistance('notebook', 'bookmark'), 6);
  });

  test('apostrophes and accents are characters', () => {
    assert.equal(editDistance('dont', "don't"), 1);
    assert.equal(editDistance('cafe', 'café'), 1);
  });
});

describe('ranking', () => {
  test('closest first, then most frequent, then alphabetical', () => {
    assert.deepEqual(new Suggester(RANKING).suggest('lamp', 20),
      ['lamp', 'camp', 'limp', 'clamp', 'lamb', 'ramp', 'lump', 'lam', 'lumps', 'clasp', 'lisp']);
  });

  test('misspelled word', () => {
    assert.deepEqual(new Suggester(RANKING).suggest('lmp', 20),
      ['limp', 'lamp', 'lump', 'lumps', 'camp', 'lisp', 'clamp', 'lamb', 'ramp', 'lam']);
  });

  test('limit', () => {
    const suggester = new Suggester(RANKING);
    assert.deepEqual(suggester.suggest('lmp', 4), ['limp', 'lamp', 'lump', 'lumps']);
    assert.deepEqual(suggester.suggest('lmp'), ['limp', 'lamp', 'lump', 'lumps', 'camp'], 'the default limit is 5');
  });

  test('input is normalized', () => {
    assert.deepEqual(new Suggester(RANKING).suggest('LAMP', 3), ['lamp', 'camp', 'limp']);
  });

  test('nothing close enough', () => {
    assert.deepEqual(new Suggester(RANKING).suggest('xyzzy'), []);
    assert.deepEqual(new Suggester(WORDS).suggest('xylophone'), []);
  });
});

describe('suggestions', () => {
  const suggester = new Suggester(WORDS);

  test('distance beats frequency', () => {
    assert.deepEqual(suggester.suggest('recieve'), ['relieve', 'receive', 'believe']);
  });

  test('common typos', () => {
    assert.deepEqual(suggester.suggest('tomorow'), ['tomorrow']);
    assert.deepEqual(suggester.suggest('havent'), ["haven't", 'have']);
    assert.deepEqual(suggester.suggest('freind'), ['friend', 'fiend', 'find', 'fried']);
    assert.deepEqual(suggester.suggest('occured'), ['occurred', 'occur']);
  });

  test('short words', () => {
    assert.deepEqual(suggester.suggest('teh'), ['tea', 'tech', 'ten', 'the', 'be']);
    assert.deepEqual(suggester.suggest('carr', 4), ['car', 'card', 'care', 'cart']);
  });

  test('frequency ties are alphabetical', () => {
    assert.deepEqual(suggester.suggest('wierd'), ['were', 'word', 'weird', 'wired', 'fiend']);
  });

  test('apostrophes and accents', () => {
    assert.deepEqual(suggester.suggest('dont', 3), ["don't", 'done', 'dot']);
    assert.deepEqual(suggester.suggest('cafe', 3), ['came', 'café', 'care']);
    assert.deepEqual(suggester.suggest('don’t', 4), ["don't", "won't", "can't", "doesn't"]);
  });
});

describe('checker suggestions', () => {
  test("suggestions follow the writer's capitalisation", () => {
    const checker = new SpellChecker(WORDS);
    assert.deepEqual(checker.suggest('Recieve'), ['Relieve', 'Receive', 'Believe']);
    assert.deepEqual(checker.suggest('TEH', 3), ['TEA', 'TECH', 'TEN']);
    assert.deepEqual(checker.suggest('Thier', 6), ['The', 'This', 'They', 'Her', 'There', 'Their']);
  });

  test('misspellings with suggestions', () => {
    const checker = new SpellChecker(WORDS);
    const found = checker.check('Teh calender is ready');
    assert.deepEqual(found.map(m => m.word), ['Teh', 'calender']);
    assert.deepEqual(found.map(m => checker.suggest(m.word, 2)), [['Tea', 'Tech'], ['calendar']]);
  });
});
