// Loads the designers' candidate list.
//
// Format: one word per line, then its difficulty (1-3), then optional
// comma-separated theme tags. Blank lines and # comments are ignored.
//
//   # word      difficulty   tags
//   tango       2            music, dance
//   otter       1            animals
import { readFileSync } from 'node:fs';
import { WordError } from './letters.ts';
import { Word } from './models.ts';

export const DEFAULT_PATH = new URL('../data/words.txt', import.meta.url);

/** Thrown for a malformed line, with its line number. */
export class WordListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordListError';
  }
}

/** Parse word-list text into an array of Words, in file order. */
export function parseWordList(text: string): Word[] {
  const words: Word[] = [];
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

export function loadWordList(file: string | URL = DEFAULT_PATH): Word[] {
  return parseWordList(readFileSync(file, 'utf8'));
}

export interface WordFilter {
  theme?: string | null;
  maxDifficulty?: number | null;
}

/** Candidates tagged with theme (if given) and no harder than maxDifficulty. */
export function filterWords(words: Word[], { theme = null, maxDifficulty = null }: WordFilter = {}): Word[] {
  return words.filter(word => (theme === null || word.tags.has(theme)) && (maxDifficulty === null || word.difficulty <= maxDifficulty));
}

/** Every theme tag used in the list, alphabetically. */
export function themes(words: Word[]): string[] {
  return [...new Set(words.flatMap(word => [...word.tags]))].sort();
}
