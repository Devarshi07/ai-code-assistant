// Deterministic synthetic theme packs for scale tests (xorshift32 PRNG).
//
// A pack mixes the things real candidate lists contain: fresh words, several
// spellings of the same letters (anagrams), capitalized entries, and words
// with a doubled letter. Every language's tests use the same generator, so
// equal seeds give equal packs everywhere.

// Letters weighted roughly like English text, so common letters collide often.
export const ENGLISH = 'eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnssssssrrrrrrhhhhhdddddllllcccuuummmwwffggyyppbbvkjxqz';
export const EVEN = 'abcdefghijklmnopqrstuvwxyz';

export interface Rng {
  below(n: number): number;
  shuffle<T>(items: T[]): T[];
}

export function xorshift(seed: number): Rng {
  let x = seed | 0 || 1;
  return {
    below(n: number): number {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) % n;
    },
    shuffle<T>(items: T[]): T[] {
      for (let j = items.length - 1; j > 0; j--) {
        const k = this.below(j + 1);
        [items[j], items[k]] = [items[k], items[j]];
      }
      return items;
    }
  };
}

interface PackOptions {
  minLength?: number;
  maxLength?: number;
  spellings?: number;
  bag?: string;
}

/** size candidate words; each letter set appears in 1..spellings spellings. */
export function themePack(seed: number, size: number, { minLength = 2, maxLength = 4, spellings = 1, bag = ENGLISH }: PackOptions = {}): string[] {
  const rng = xorshift(seed);
  const pack: string[] = [];
  while (pack.length < size) {
    const length = minLength + rng.below(maxLength - minLength + 1);
    const letters: string[] = [];
    while (letters.length < length) {
      const letter = bag[rng.below(bag.length)];
      if (!letters.includes(letter)) letters.push(letter);
    }
    const word = letters.join('');
    const roll = rng.below(10);
    if (roll === 0) pack.push(word + word[word.length - 1]); // doubled letter: never playable
    else if (roll === 1) pack.push(word[0].toUpperCase() + word.slice(1));
    const copies = 1 + rng.below(spellings);
    for (let i = 0; i < copies; i++) pack.push(rng.shuffle(letters).join(''));
  }
  pack.length = size;
  return rng.shuffle(pack);
}

/** Many 2-4 letter words: deep boards of eight or more words. */
export const shortWordPack = (seed: number, size: number): string[] => themePack(seed, size, { minLength: 2, maxLength: 4, spellings: 2, bag: ENGLISH });

/** 4-7 letter words, most letter sets in several spellings: shallow boards, many ties. */
export const longWordPack = (seed: number, size: number): string[] => themePack(seed, size, { minLength: 4, maxLength: 7, spellings: 8, bag: EVEN });
