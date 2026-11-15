"""Deterministic synthetic theme packs for scale tests (xorshift32 PRNG).

A pack mixes the things real candidate lists contain: fresh words, several
spellings of the same letters (anagrams), capitalized entries, and words with
a doubled letter. The JavaScript tests use the same generator, so equal seeds
give equal packs in both languages.
"""

# Letters weighted roughly like English text, so common letters collide often.
ENGLISH = "eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnssssssrrrrrrhhhhhdddddllllcccuuummmwwffggyyppbbvkjxqz"
EVEN = "abcdefghijklmnopqrstuvwxyz"
_MASK32 = 0xFFFFFFFF


class XorShift:
    def __init__(self, seed):
        self.x = (seed & _MASK32) or 1

    def below(self, n):
        x = self.x
        x ^= (x << 13) & _MASK32
        x ^= x >> 17
        x ^= (x << 5) & _MASK32
        self.x = x
        return x % n

    def shuffle(self, items):
        for j in range(len(items) - 1, 0, -1):
            k = self.below(j + 1)
            items[j], items[k] = items[k], items[j]
        return items


def theme_pack(seed, size, min_length=2, max_length=4, spellings=1, bag=ENGLISH):
    """size candidate words; each letter set appears in 1..spellings spellings."""
    rng = XorShift(seed)
    pack = []
    while len(pack) < size:
        length = min_length + rng.below(max_length - min_length + 1)
        letters = []
        while len(letters) < length:
            letter = bag[rng.below(len(bag))]
            if letter not in letters:
                letters.append(letter)
        word = "".join(letters)
        roll = rng.below(10)
        if roll == 0:
            pack.append(word + word[-1])  # doubled letter: never playable
        elif roll == 1:
            pack.append(word[0].upper() + word[1:])
        for _ in range(1 + rng.below(spellings)):
            pack.append("".join(rng.shuffle(letters)))
    del pack[size:]
    return rng.shuffle(pack)


def short_word_pack(seed, size):
    """Many 2-4 letter words: deep boards of eight or more words."""
    return theme_pack(seed, size, 2, 4, spellings=2, bag=ENGLISH)


def long_word_pack(seed, size):
    """4-7 letter words, most letter sets in several spellings: shallow boards, many ties."""
    return theme_pack(seed, size, 4, 7, spellings=8, bag=EVEN)
