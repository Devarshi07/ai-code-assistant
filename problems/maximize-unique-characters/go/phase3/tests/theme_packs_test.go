package tests

// Deterministic synthetic theme packs for scale tests (xorshift32 PRNG).
//
// A pack mixes the things real candidate lists contain: fresh words, several
// spellings of the same letters (anagrams), capitalized entries, and words
// with a doubled letter. Every language's tests use the same generator, so
// equal seeds give equal packs everywhere.

import "strings"

// Letters weighted roughly like English text, so common letters collide often.
const (
	english = "eeeeeeeeeeeettttttttaaaaaaaaoooooooiiiiiiinnnnnnnssssssrrrrrrhhhhhdddddllllcccuuummmwwffggyyppbbvkjxqz"
	even    = "abcdefghijklmnopqrstuvwxyz"
)

type rng struct{ x uint32 }

func newRng(seed uint32) *rng {
	if seed == 0 {
		seed = 1
	}
	return &rng{x: seed}
}

func (r *rng) below(n int) int {
	r.x ^= r.x << 13
	r.x ^= r.x >> 17
	r.x ^= r.x << 5
	return int(r.x % uint32(n))
}

func shuffle[T any](r *rng, items []T) {
	for j := len(items) - 1; j > 0; j-- {
		k := r.below(j + 1)
		items[j], items[k] = items[k], items[j]
	}
}

// themePack returns size candidate words; each letter set appears in 1..spellings spellings.
func themePack(seed uint32, size, minLength, maxLength, spellings int, bag string) []string {
	r := newRng(seed)
	var pack []string
	for len(pack) < size {
		length := minLength + r.below(maxLength-minLength+1)
		var letters []byte
		for len(letters) < length {
			letter := bag[r.below(len(bag))]
			if !strings.Contains(string(letters), string(letter)) {
				letters = append(letters, letter)
			}
		}
		word := string(letters)
		switch r.below(10) {
		case 0:
			pack = append(pack, word+word[len(word)-1:]) // doubled letter: never playable
		case 1:
			pack = append(pack, strings.ToUpper(word[:1])+word[1:])
		}
		copies := 1 + r.below(spellings)
		for i := 0; i < copies; i++ {
			shuffle(r, letters)
			pack = append(pack, string(letters))
		}
	}
	pack = pack[:size]
	shuffle(r, pack)
	return pack
}

// shortWordPack has many 2-4 letter words: deep boards of eight or more words.
func shortWordPack(seed uint32, size int) []string {
	return themePack(seed, size, 2, 4, 2, english)
}

// longWordPack has 4-7 letter words, most letter sets in several spellings: shallow boards, many ties.
func longWordPack(seed uint32, size int) []string {
	return themePack(seed, size, 4, 7, 8, even)
}
