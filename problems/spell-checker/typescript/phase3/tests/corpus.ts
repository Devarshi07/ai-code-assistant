// Deterministic large dictionaries and typo batches for the scale tests.
//
// The tests in the other languages use the same generator, so every version
// sees exactly the same words, frequencies and queries.
import { Dictionary } from '../src/dictionary.ts';

const ONSETS = ['', '', 'b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's',
  't', 'v', 'w', 'z', 'br', 'ch', 'cl', 'dr', 'fl', 'gr', 'pl', 'sh', 'st', 'th', 'tr'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'o', 'y', 'ai', 'ea', 'ee', 'oo', 'ou'];
const CODAS = ['', '', '', '', '', 'n', 'r', 's', 't', 'l', 'm', 'd', 'ck', 'nd', 'st', 'ng'];
const SUFFIXES = ['', '', '', '', '', '', 's', 's', 'ed', 'er', 'ing', 'ly'];
const SYLLABLES = [1, 1, 2, 2, 2, 3];
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Small 32-bit linear congruential generator. */
export class Lcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A pseudo-random integer in [0, n). */
  below(n: number): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return Math.floor((this.state * n) / 4294967296);
  }

  pick<T>(items: ArrayLike<T>): T {
    return items[this.below(items.length)];
  }
}

function pseudoWord(rng: Lcg): string {
  const syllables = rng.pick(SYLLABLES);
  let word = '';
  for (let s = 0; s < syllables; s++) word += rng.pick(ONSETS) + rng.pick(VOWELS) + rng.pick(CODAS);
  return word + rng.pick(SUFFIXES);
}

/** The base word list plus generated words: `size` entries in total. */
export function largeDictionary(size: number, seed = 1): Dictionary {
  const dictionary = Dictionary.load();
  const rng = new Lcg(seed);
  while (dictionary.size < size) {
    const word = pseudoWord(rng);
    const count = 1 + rng.below(400);
    if (!dictionary.has(word)) dictionary.add(word, count);
  }
  return dictionary;
}

/** word with one random insertion, deletion, substitution or swap. */
function typo(rng: Lcg, word: string): string {
  const kind = rng.below(4);
  if (kind === 0 || word.length < 2) {
    const i = rng.below(word.length + 1);
    return word.slice(0, i) + rng.pick(LETTERS) + word.slice(i);
  }
  if (kind === 1) {
    const i = rng.below(word.length);
    return word.slice(0, i) + word.slice(i + 1);
  }
  if (kind === 2) {
    const i = rng.below(word.length);
    return word.slice(0, i) + rng.pick(LETTERS) + word.slice(i + 1);
  }
  const i = rng.below(word.length - 1);
  return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
}

/** `count` misspellings, each a dictionary word with one or two typos. */
export function typoBatch(dictionary: Dictionary, count: number, seed = 7): string[] {
  const rng = new Lcg(seed);
  const words = dictionary.words();
  const batch: string[] = [];
  for (let n = 0; n < count; n++) {
    let word = words[rng.below(words.length)];
    const typos = 1 + rng.below(2);
    for (let t = 0; t < typos; t++) word = typo(rng, word);
    batch.push(word);
  }
  return batch;
}
