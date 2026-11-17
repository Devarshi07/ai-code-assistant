package oneofeach

// Suggests boards: the best set of candidate words for a puzzle.

import (
	"slices"
	"sort"
)

// PlayableWords returns the candidates that could appear on a board at all, one per spelling.
//
// Words that repeat a letter are dropped, and so are exact duplicates (the
// same word often appears in several themes). Order is preserved.
func PlayableWords(words []Word) []Word {
	seen := map[string]bool{}
	var playable []Word
	for _, word := range words {
		if word.HasRepeats() || seen[word.Text] {
			continue
		}
		seen[word.Text] = true
		playable = append(playable, word)
	}
	return playable
}

// BestSelection returns the board that covers the most letters without repeating any.
//
// The result holds the chosen words in alphabetical order and the number of
// letters they cover. Ties go to the alphabetically first word list.
//
// Backtracking: try every set of mutually compatible words, extending a board
// only with words that come later alphabetically and share no letter with it,
// and keep the best board seen.
func BestSelection(words []Word) Selection {
	pool := PlayableWords(words)
	sort.Slice(pool, func(i, j int) bool { return pool[i].Text < pool[j].Text })
	bestTotal := 0
	bestWords := []string{}
	var chosen []string

	var search func(start int, used uint32, total int)
	search = func(start int, used uint32, total int) {
		// slices.Compare orders word lists word by word, like a dictionary.
		if total > bestTotal || (total == bestTotal && slices.Compare(chosen, bestWords) < 0) {
			bestTotal = total
			bestWords = slices.Clone(chosen)
		}
		for i := start; i < len(pool); i++ {
			word := pool[i]
			if word.Mask&used != 0 {
				continue
			}
			chosen = append(chosen, word.Text)
			search(i+1, used|word.Mask, total+word.Length())
			chosen = chosen[:len(chosen)-1]
		}
	}

	search(0, 0, 0)
	return Selection{Words: bestWords, Total: bestTotal}
}
