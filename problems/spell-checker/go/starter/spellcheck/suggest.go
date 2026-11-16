// Spelling suggestions: the dictionary words closest to a misspelling.
//
// Closeness is Levenshtein edit distance, the fewest single-character
// insertions, deletions and substitutions that turn one word into the other.
// Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").

package spellcheck

const (
	MaxDistance  = 2 // anything further away is not a useful suggestion
	DefaultLimit = 5 // entries shown in the editor's right-click menu
)

// EditDistance returns the Levenshtein distance between a and b.
func EditDistance(a, b string) int {
	panic("phase 2: EditDistance is not implemented yet")
}

// Suggester ranks dictionary words as replacements for a misspelled word.
type Suggester struct {
	dictionary *Dictionary
}

// NewSuggester returns a suggester over dictionary.
func NewSuggester(dictionary *Dictionary) *Suggester {
	return &Suggester{dictionary: dictionary}
}

// Suggest returns up to limit dictionary words within MaxDistance edits of
// word.
//
// The word is compared in its normalized (lower-case) form and the results
// are dictionary keys. Closest words come first; ties go to the more frequent
// word, then to the alphabetically smaller one.
func (s *Suggester) Suggest(word string, limit int) []string {
	panic("phase 2: Suggester.Suggest is not implemented yet")
}
