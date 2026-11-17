package oneofeach

// Checks a board against the puzzle rules before it is published.
//
// The rules of One of Each:
//  1. a word may not use any letter twice ('otter' is out);
//  2. no letter may appear in more than one word on the board.

import (
	"fmt"
	"strings"
)

// SelectionProblems lists the rule violations for a board; empty when it is valid.
func SelectionProblems(words []Word) []string {
	var problems []string
	var placed []Word
	var used uint32
	for _, word := range words {
		if word.HasRepeats() {
			var doubled strings.Builder
			for _, ch := range word.Letters() {
				if strings.Count(word.Text, string(ch)) > 1 {
					doubled.WriteRune(ch)
				}
			}
			problems = append(problems, fmt.Sprintf("'%s' uses '%s' more than once", word.Text, doubled.String()))
		}
		if clash := used & word.Mask; clash != 0 {
			var others []string
			for _, other := range placed {
				if other.Mask&clash != 0 {
					others = append(others, "'"+other.Text+"'")
				}
			}
			problems = append(problems, fmt.Sprintf("'%s' shares '%s' with %s", word.Text, MaskLetters(clash), strings.Join(others, ", ")))
		}
		used |= word.Mask
		placed = append(placed, word)
	}
	return problems
}

// IsValidSelection reports whether the board breaks no rule.
func IsValidSelection(words []Word) bool {
	return len(SelectionProblems(words)) == 0
}
