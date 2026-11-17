package tests

// Deterministic pseudo-English dictionaries and queries for the scale tests.
// Every language edition has the same generator, so a seed produces the same
// words everywhere.

import "strings"

var (
	onsets = strings.Fields("_ _ b b br c c ch cl d d dr f fl g gr h h j k l l m m n n p p pl r r s s sh sl sp st t t th tr v w w y z")
	vowels = strings.Fields("a a e e i o u ai au ea ee ie oa oo ou y")
	codas  = strings.Fields("_ _ _ _ _ _ _ _ b ck d g l ll m n n nd ng nt p r r s st t t x")
	// the empty string is spelled "_" above so that strings.Fields can split the lists.
	suffixes = strings.Fields("_ _ _ _ _ _ _ _ _ _ s s s ed er ing ly y")
)

// lcg is a 32-bit linear congruential generator, identical in every edition.
type lcg uint32

// below returns a number in [0, n).
func (s *lcg) below(n int) int {
	*s = *s*1664525 + 1013904223
	return int(uint32(*s)>>16) % n
}

func pick(list []string, below func(int) int) string {
	item := list[below(len(list))]
	if item == "_" {
		return ""
	}
	return item
}

func makeWord(s *lcg) string {
	var word strings.Builder
	syllables := 1
	syllables += s.below(2)
	syllables += s.below(2)
	for i := 0; i < syllables; i++ {
		word.WriteString(pick(onsets, s.below))
		word.WriteString(pick(vowels, s.below))
		word.WriteString(pick(codas, s.below))
	}
	word.WriteString(pick(suffixes, s.below))
	return word.String()
}

// generateWords returns count pseudo-words; expect some repeats.
func generateWords(seed uint32, count int) []string {
	below := lcg(seed)
	words := make([]string, 0, count)
	for i := 0; i < count; i++ {
		words = append(words, makeWord(&below))
	}
	return words
}

// slotPatterns are grid-fill queries: stored words with some squares still
// blank, e.g. "?ra??le".
func slotPatterns(words []string, seed uint32, count, blankPercent int) []string {
	below := lcg(seed)
	var patterns []string
	for len(patterns) < count {
		word := words[below.below(len(words))]
		if len(word) < 4 {
			continue
		}
		squares := []byte(word)
		fixed := 0
		for i := range squares {
			if below.below(100) < blankPercent {
				squares[i] = '?'
			} else {
				fixed++
			}
		}
		if fixed >= 2 {
			patterns = append(patterns, string(squares))
		}
	}
	return patterns
}

// searchPatterns are solver-panel queries: the start of a word with a few
// blanks, then a star, e.g. "dr?n*".
func searchPatterns(words []string, seed uint32, count int) []string {
	below := lcg(seed)
	var patterns []string
	for len(patterns) < count {
		word := words[below.below(len(words))]
		if len(word) < 6 {
			continue
		}
		start := []byte(word[:3+below.below(len(word)-4)])
		fixed := 0
		for i := range start {
			if below.below(100) < 35 {
				start[i] = '?'
			} else {
				fixed++
			}
		}
		if fixed >= 2 {
			patterns = append(patterns, string(start)+"*")
		}
	}
	return patterns
}
