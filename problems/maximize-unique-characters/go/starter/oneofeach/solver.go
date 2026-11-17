package oneofeach

// Suggests boards: the best set of candidate words for a puzzle.

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
func BestSelection(words []Word) Selection {
	panic("phase 2: BestSelection is not implemented")
}
