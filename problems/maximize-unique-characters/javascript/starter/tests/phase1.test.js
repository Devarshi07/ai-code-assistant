const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Puzzle } = require('../src/models');
const { WordListError, filterWords, parseWordList } = require('../src/wordlist');
const { isValidSelection, selectionProblems } = require('../src/validator');
const { playableWords } = require('../src/solver');
const { render } = require('../src/board');

const SAMPLE_LIST = `
# word     difficulty  themes
Tango      2           music, dance
otter      1           animals
fig        1           kitchen, garden
jam        1           kitchen, music
quiche     3           kitchen
`;

const texts = words => words.map(word => word.text);

describe('validator', () => {
  test('clean board has no problems', () => {
    assert.deepEqual(selectionProblems(['zebra', 'lynx', 'dog']), []);
    assert.equal(isValidSelection(['zebra', 'lynx', 'dog']), true);
  });

  test('words sharing a letter are rejected', () => {
    const problems = selectionProblems(['drum', 'harp']);
    assert.equal(problems.length, 1);
    assert.ok(problems[0].includes("'r'"), problems[0]);
  });

  test('clash report names every earlier word', () => {
    const problems = selectionProblems(['drum', 'harp', 'tempo']);
    assert.equal(problems.length, 2);
    assert.ok(problems[1].includes("'drum'") && problems[1].includes("'harp'"), problems[1]);
  });

  test('reported kitchen board is rejected', () => {
    // Player report for 2026-10-12: "today's board has two Ts".
    assert.equal(isValidSelection(['butter', 'fig', 'jam', 'wok']), false);
  });

  test('double letter problem names the letter', () => {
    const problems = selectionProblems(['moss', 'fern']);
    assert.equal(problems.length, 1);
    assert.ok(problems[0].includes("'moss'") && problems[0].includes("'s'"), String(problems[0]));
  });

  test('letter used three times in one word', () => {
    assert.equal(isValidSelection(['bobbin']), false);
  });
});

describe('puzzle', () => {
  test('tile count counts every tile', () => {
    const puzzle = new Puzzle('2026-10-12', 'kitchen', ['butter', 'fig', 'jam', 'wok']);
    assert.equal(puzzle.tileCount, 15);
    assert.ok(render(puzzle).includes('15 tiles'), render(puzzle));
  });

  test('unused letters', () => {
    const puzzle = new Puzzle('2026-10-14', 'animals', ['zebra', 'lynx', 'dog']);
    assert.equal(puzzle.tileCount, 12);
    assert.equal(puzzle.unusedLetters, 'cfhijkmpqstuvw');
  });
});

describe('word list', () => {
  test('parse reads difficulty and themes', () => {
    const words = parseWordList(SAMPLE_LIST);
    assert.deepEqual(texts(words), ['tango', 'otter', 'fig', 'jam', 'quiche']);
    assert.equal(words[0].difficulty, 2);
    assert.deepEqual([...words[0].tags].sort(), ['dance', 'music']);
  });

  test('filter by theme and difficulty', () => {
    const words = parseWordList(SAMPLE_LIST);
    assert.deepEqual(texts(filterWords(words, { theme: 'kitchen' })), ['fig', 'jam', 'quiche']);
    assert.deepEqual(texts(filterWords(words, { theme: 'kitchen', maxDifficulty: 2 })), ['fig', 'jam']);
  });

  test('bad word reports its line', () => {
    assert.throws(() => parseWordList("fig 1 kitchen\nrock'n'roll 2 music\n"), error => error instanceof WordListError && error.message.includes('line 2'));
  });

  test('playable words skip double letters and duplicates', () => {
    const words = parseWordList(SAMPLE_LIST + 'fig 2 snacks\n');
    assert.deepEqual(texts(playableWords(words)), ['tango', 'fig', 'jam', 'quiche']);
  });
});
