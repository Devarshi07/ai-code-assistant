// Deterministic synthetic theme packs for scale tests (xorshift32 PRNG).
//
// A pack mixes the things real candidate lists contain: fresh words, several
// spellings of the same letters (anagrams), capitalized entries, and words
// with a doubled letter. The Python tests use the same generator, so equal
// seeds give equal packs in both languages.

// Letters weighted roughly like English text, so common letters collide often.
const ENGLISH = 'eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnssssssrrrrrrhhhhhdddddllllcccuuummmwwffggyyppbbvkjxqz';
const EVEN = 'abcdefghijklmnopqrstuvwxyz';

function xorshift(seed) {
  let x = seed | 0 || 1;
  return {
    below(n) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) % n;
    },
    shuffle(items) {
      for (let j = items.length - 1; j > 0; j--) {
        const k = this.below(j + 1);
        [items[j], items[k]] = [items[k], items[j]];
      }
      return items;
    }
  };
}

/** size candidate words; each letter set appears in 1..spellings spellings. */
function themePack(seed, size, { minLength = 2, maxLength = 4, spellings = 1, bag = ENGLISH } = {}) {
  const rng = xorshift(seed);
  const pack = [];
  while (pack.length < size) {
    const length = minLength + rng.below(maxLength - minLength + 1);
    const letters = [];
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
const shortWordPack = (seed, size) => themePack(seed, size, { minLength: 2, maxLength: 4, spellings: 2, bag: ENGLISH });

/** 4-7 letter words, most letter sets in several spellings: shallow boards, many ties. */
const longWordPack = (seed, size) => themePack(seed, size, { minLength: 4, maxLength: 7, spellings: 8, bag: EVEN });

module.exports = { themePack, shortWordPack, longWordPack, xorshift, ENGLISH, EVEN };
