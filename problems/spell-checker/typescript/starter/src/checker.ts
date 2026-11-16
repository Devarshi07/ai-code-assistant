// Finds the misspelled words in a note.
//
// The editor calls check() on every keystroke pause, so it only reports where
// the problems are. Suggestions are fetched separately, when the user opens
// the right-click menu on an underlined word.
import { normalize } from './dictionary.ts';
import type { Dictionary } from './dictionary.ts';
import { DEFAULT_LIMIT, Suggester } from './suggest.ts';
import { tokenize } from './tokenizer.ts';

/** A word the dictionary doesn't know, with offsets like a Token's. */
export interface Misspelling {
  /** As written in the note. */
  word: string;
  start: number;
  end: number;
}

export interface CheckerOptions {
  /** Skip words in ALL CAPS, such as acronyms. Defaults to true. */
  ignoreUppercase?: boolean;
}

/** All capitals and longer than one letter: NASA, TODO, DON'T. */
function isShouting(word: string): boolean {
  return word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
}

/** Give a suggestion the capitalisation of the word it would replace. */
export function matchCase(template: string, word: string): string {
  if (isShouting(template)) return word.toUpperCase();
  const first = template.charAt(0);
  if (first !== first.toLowerCase()) return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
}

export class SpellChecker {
  readonly dictionary: Dictionary;
  ignoreUppercase: boolean; // skip acronyms such as NASA
  private readonly ignored = new Set<string>();
  private suggester: Suggester | null = null;

  constructor(dictionary: Dictionary, { ignoreUppercase = true }: CheckerOptions = {}) {
    this.dictionary = dictionary;
    this.ignoreUppercase = ignoreUppercase;
  }

  /** 'Ignore all' from the context menu: accept word for this session. */
  ignore(word: string): void {
    this.ignored.add(normalize(word));
  }

  isKnown(word: string): boolean {
    const key = normalize(word);
    if (this.ignored.has(key) || this.dictionary.has(key)) return true;
    // Possessives aren't listed separately: "team's" is fine if "team" is.
    return key.endsWith("'s") && this.dictionary.has(key.slice(0, -2));
  }

  /** Every misspelled word in text, in order of appearance. */
  check(text: string): Misspelling[] {
    const found: Misspelling[] = [];
    for (const token of tokenize(text)) {
      if (this.ignoreUppercase && isShouting(token.text)) continue;
      if (!this.isKnown(token.text)) found.push({ word: token.text, start: token.start, end: token.end });
    }
    return found;
  }

  /** Replacements for word, capitalised the way the user wrote it. */
  suggest(word: string, limit = DEFAULT_LIMIT): string[] {
    this.suggester ??= new Suggester(this.dictionary);
    return this.suggester.suggest(word, limit).map(s => matchCase(word, s));
  }
}
