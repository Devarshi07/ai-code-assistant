// Loads the designers' candidate list.
//
// Format: one word per line, then its difficulty (1-3), then optional
// comma-separated theme tags. Blank lines and # comments are ignored.
//
//   # word      difficulty   tags
//   tango       2            music, dance
//   otter       1            animals
const fs = require('node:fs');
const path = require('node:path');
const { WordError } = require('./letters');
const { Word } = require('./models');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'words.txt');

/** Thrown for a malformed line, with its line number. */
class WordListError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WordListError';
  }
}

/** Parse word-list text into an array of Words, in file order. */
function parseWordList(text) {
  const words = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const number = index + 1;
    const line = raw.split('#')[0].trim();
    if (!line) return;
    const [word, difficulty, ...rest] = line.split(/\s+/);
    if (difficulty === undefined) throw new WordListError(`line ${number}: expected 'word difficulty [tags]', got '${line}'`);
    if (!['1', '2', '3'].includes(difficulty)) throw new WordListError(`line ${number}: difficulty must be 1, 2 or 3, got '${difficulty}'`);
    const tags = rest.join(' ').split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
    try {
      words.push(new Word(word, Number(difficulty), tags));
    } catch (error) {
      if (error instanceof WordError) throw new WordListError(`line ${number}: ${error.message}`);
      throw error;
    }
  });
  return words;
}

function loadWordList(file = DEFAULT_PATH) {
  return parseWordList(fs.readFileSync(file, 'utf8'));
}

/** Candidates tagged with theme (if given) and no harder than maxDifficulty. */
function filterWords(words, { theme = null, maxDifficulty = null } = {}) {
  return words.filter(word => (theme === null || word.tags.has(theme)) && (maxDifficulty === null || word.difficulty <= maxDifficulty));
}

/** Every theme tag used in the list, alphabetically. */
function themes(words) {
  return [...new Set(words.flatMap(word => [...word.tags]))].sort();
}

module.exports = { DEFAULT_PATH, WordListError, parseWordList, loadWordList, filterWords, themes };
