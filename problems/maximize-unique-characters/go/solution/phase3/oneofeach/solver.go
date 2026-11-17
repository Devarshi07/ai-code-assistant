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
//  1. Keep one spelling per letter set (anagrams are interchangeable), and keep
//     the alphabetically first one so the tie-break is unaffected.
//  2. Branch and bound, longest words first, finds the best total.
//  3. A second search in alphabetical order stops at the first board that
//     reaches that total. Alphabetical depth-first order visits boards in
//     tie-break order, so that board is the answer.
func BestSelection(words []Word) Selection {
	firstSpelling := map[uint32]Word{}
	for _, word := range PlayableWords(words) {
		current, found := firstSpelling[word.Mask]
		if !found || word.Text < current.Text {
			firstSpelling[word.Mask] = word
		}
	}
	entries := make([]Word, 0, len(firstSpelling))
	for _, word := range firstSpelling {
		entries = append(entries, word)
	}

	longestFirst := slices.Clone(entries)
	sort.Slice(longestFirst, func(i, j int) bool {
		a, b := longestFirst[i], longestFirst[j]
		if len(a.Text) != len(b.Text) {
			return len(a.Text) > len(b.Text)
		}
		return a.Text < b.Text
	})
	target := bestTotal(longestFirst)

	alphabetical := slices.Clone(entries)
	sort.Slice(alphabetical, func(i, j int) bool { return alphabetical[i].Text < alphabetical[j].Text })
	return Selection{Words: firstBoard(alphabetical, target), Total: target}
}

// reachOf returns reach, where reach[p] is every letter that candidates[p:] could still add to the board.
func reachOf(masks []uint32, candidates []int) []uint32 {
	reach := make([]uint32, len(candidates)+1)
	for p := len(candidates) - 1; p >= 0; p-- {
		reach[p] = reach[p+1] | masks[candidates[p]]
	}
	return reach
}

// compatible returns the candidates after position p that share no letter with mask.
func compatible(masks []uint32, candidates []int, p int, mask uint32) []int {
	var rest []int
	for _, q := range candidates[p+1:] {
		if masks[q]&mask == 0 {
			rest = append(rest, q)
		}
	}
	return rest
}

func everyIndex(size int) []int {
	all := make([]int, size)
	for i := range all {
		all[i] = i
	}
	return all
}

// bestTotal is the most letters any board can cover, using entries in the given search order.
func bestTotal(entries []Word) int {
	masks := make([]uint32, len(entries))
	sizes := make([]int, len(entries))
	for i, word := range entries {
		masks[i] = word.Mask
		sizes[i] = len(word.Text)
	}
	best := 0

	// candidates: indexes of words that fit the current board, in search order.
	var grow func(candidates []int, total int)
	grow = func(candidates []int, total int) {
		if total > best {
			best = total
		}
		reach := reachOf(masks, candidates)
		for p, i := range candidates {
			if total+Popcount(reach[p]) <= best {
				return // even every remaining letter could not beat the best board
			}
			grow(compatible(masks, candidates, p, masks[i]), total+sizes[i])
		}
	}

	grow(everyIndex(len(entries)), 0)
	return best
}

// firstBoard is the first board, in alphabetical depth-first order, that covers target letters.
func firstBoard(entries []Word, target int) []string {
	masks := make([]uint32, len(entries))
	for i, word := range entries {
		masks[i] = word.Mask
	}
	chosen := []string{}

	var extend func(candidates []int, total int) bool
	extend = func(candidates []int, total int) bool {
		if total == target {
			return true
		}
		reach := reachOf(masks, candidates)
		for p, i := range candidates {
			if total+Popcount(reach[p]) < target {
				return false
			}
			word := entries[i]
			chosen = append(chosen, word.Text)
			if extend(compatible(masks, candidates, p, word.Mask), total+len(word.Text)) {
				return true
			}
			chosen = chosen[:len(chosen)-1]
		}
		return false
	}

	extend(everyIndex(len(entries)), 0)
	return chosen
}
