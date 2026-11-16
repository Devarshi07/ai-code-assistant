// Deterministic large dictionaries and typo batches for the scale tests.
//
// The tests in the other languages use the same generator, so every version
// sees exactly the same words, frequencies and queries.

package tests

import "debuggym/spell-checker/spellcheck"

var (
	onsets = []string{"", "", "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s",
		"t", "v", "w", "z", "br", "ch", "cl", "dr", "fl", "gr", "pl", "sh", "st", "th", "tr"}
	vowels    = []string{"a", "e", "i", "o", "u", "a", "e", "i", "o", "y", "ai", "ea", "ee", "oo", "ou"}
	codas     = []string{"", "", "", "", "", "n", "r", "s", "t", "l", "m", "d", "ck", "nd", "st", "ng"}
	suffixes  = []string{"", "", "", "", "", "", "s", "s", "ed", "er", "ing", "ly"}
	syllables = []int{1, 1, 2, 2, 2, 3}
)

const letters = "abcdefghijklmnopqrstuvwxyz"

// lcg is a small 32-bit linear congruential generator.
type lcg struct {
	state uint32
}

// below returns a pseudo-random integer in [0, n).
func (g *lcg) below(n int) int {
	g.state = g.state*1664525 + 1013904223
	return int(uint64(g.state) * uint64(n) >> 32)
}

func pick[T any](g *lcg, items []T) T {
	return items[g.below(len(items))]
}

func pickLetter(g *lcg) string {
	i := g.below(len(letters))
	return letters[i : i+1]
}

func pseudoWord(g *lcg) string {
	word := ""
	for n := pick(g, syllables); n > 0; n-- {
		word += pick(g, onsets)
		word += pick(g, vowels)
		word += pick(g, codas)
	}
	return word + pick(g, suffixes)
}

// largeDictionary returns the base word list plus generated words: size
// entries in total.
func largeDictionary(size int, seed uint32) (*spellcheck.Dictionary, error) {
	dictionary, err := spellcheck.LoadDefault()
	if err != nil {
		return nil, err
	}
	g := &lcg{state: seed}
	for dictionary.Len() < size {
		word := pseudoWord(g)
		count := 1 + g.below(400)
		if !dictionary.Contains(word) {
			dictionary.Add(word, count)
		}
	}
	return dictionary, nil
}

// typo returns word with one random insertion, deletion, substitution or
// swap. Positions count runes, so accented words get whole-character typos.
func typo(g *lcg, word string) string {
	r := []rune(word)
	kind := g.below(4)
	if kind == 0 || len(r) < 2 {
		i := g.below(len(r) + 1)
		return string(r[:i]) + pickLetter(g) + string(r[i:])
	}
	if kind == 1 {
		i := g.below(len(r))
		return string(r[:i]) + string(r[i+1:])
	}
	if kind == 2 {
		i := g.below(len(r))
		return string(r[:i]) + pickLetter(g) + string(r[i+1:])
	}
	i := g.below(len(r) - 1)
	r[i], r[i+1] = r[i+1], r[i]
	return string(r)
}

// typoBatch returns count misspellings, each a dictionary word with one or
// two typos.
func typoBatch(dictionary *spellcheck.Dictionary, count int, seed uint32) []string {
	g := &lcg{state: seed}
	words := dictionary.Words()
	batch := make([]string, 0, count)
	for n := 0; n < count; n++ {
		word := words[g.below(len(words))]
		for typos := 1 + g.below(2); typos > 0; typos-- {
			word = typo(g, word)
		}
		batch = append(batch, word)
	}
	return batch
}
