// Data model: candidate words, solver selections and dated puzzles.
import { FULL_MASK, letterMask, maskLetters, normalizeWord, popcount } from './letters.ts';

/**
 * One candidate from the designers' word list.
 *
 * `text` is always normalized (lower-case a-z). `mask` holds the word's
 * letters as a bitmask (see letters.ts). `difficulty` runs from 1 (easy) to
 * 3 (hard) and `tags` names the themes the word belongs to.
 */
export class Word {
  readonly text: string;
  readonly difficulty: number;
  readonly tags: Set<string>;
  readonly mask: number;

  constructor(text: string, difficulty: number = 1, tags: Iterable<string> = []) {
    this.text = normalizeWord(text);
    this.difficulty = difficulty;
    this.tags = new Set(tags);
    this.mask = letterMask(this.text);
  }

  /** The word's distinct letters in alphabetical order ('otter' -> 'eort'). */
  get letters(): string {
    return maskLetters(this.mask);
  }

  /** How many tiles the word puts on the board. */
  get length(): number {
    return this.letters.length;
  }

  /** True when some letter appears more than once in the word. */
  get hasRepeats(): boolean {
    return popcount(this.mask) !== this.length;
  }

  toString(): string {
    return `Word(${this.text})`;
  }
}

/** Accept Word objects or plain strings; return an array of Words. */
export function asWords(items: Iterable<Word | string>): Word[] {
  return [...items].map(item => (item instanceof Word ? item : new Word(item)));
}

/**
 * A solver answer: the chosen words in alphabetical order and the number of
 * letters they cover.
 */
export interface Selection {
  words: string[];
  total: number;
}

/** A dated, themed board. Every letter may appear on it at most once. */
export class Puzzle {
  readonly day: string;
  readonly theme: string;
  readonly words: Word[];

  constructor(day: string, theme: string, words: Iterable<Word | string>) {
    this.day = day;
    this.theme = theme;
    this.words = asWords(words);
  }

  /** Mask of every letter that appears on the board. */
  get covered(): number {
    return this.words.reduce((mask, word) => mask | word.mask, 0);
  }

  /** Tiles shown on the board; the header and the score use this. */
  get tileCount(): number {
    return this.words.reduce((sum, word) => sum + word.length, 0);
  }

  /** Letters of the alphabet that are not on the board. */
  get unusedLetters(): string {
    return maskLetters(FULL_MASK & ~this.covered);
  }
}
