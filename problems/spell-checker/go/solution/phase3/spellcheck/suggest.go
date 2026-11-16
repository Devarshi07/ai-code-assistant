// Spelling suggestions: the dictionary words closest to a misspelling.
//
// Closeness is Levenshtein edit distance, the fewest single-character
// insertions, deletions and substitutions that turn one word into the other.
// Swapping two neighbouring letters therefore costs 2 ("teh" -> "the").

package spellcheck

import (
	"cmp"
	"slices"
	"strings"
)

const (
	MaxDistance  = 2 // anything further away is not a useful suggestion
	DefaultLimit = 5 // entries shown in the editor's right-click menu
)

// EditDistance returns the Levenshtein distance between a and b. It counts
// runes, so an accented letter or a typographic apostrophe is one character.
//
// Classic dynamic program, keeping one row of the table at a time: row[j] is
// the distance between the current prefix of a and the first j runes of b.
func EditDistance(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	row := make([]int, len(rb)+1)
	for j := range row {
		row[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		previous := row[0]
		row[0] = i
		for j := 1; j <= len(rb); j++ {
			substitute := previous
			if ra[i-1] != rb[j-1] {
				substitute++
			}
			current := min(row[j]+1, row[j-1]+1, substitute) // delete, insert, substitute
			previous, row[j] = row[j], current
		}
	}
	return row[len(rb)]
}

// deletes returns word plus every string made by deleting up to depth of its
// runes.
func deletes(word string, depth int) []string {
	seen := map[string]bool{word: true}
	variants := []string{word}
	frontier := []string{word}
	for level := 0; level < depth; level++ {
		var next []string
		for _, w := range frontier {
			runes := []rune(w)
			for i := range runes {
				shorter := string(runes[:i]) + string(runes[i+1:])
				if !seen[shorter] {
					seen[shorter] = true
					variants = append(variants, shorter)
					next = append(next, shorter)
				}
			}
		}
		frontier = next
	}
	return variants
}

// ranked is a dictionary word with what it is ranked by.
type ranked struct {
	word      string
	distance  int
	frequency int
}

// byRank orders closest first, then most frequent, then alphabetical (plain
// string order).
func byRank(x, y ranked) int {
	return cmp.Or(
		cmp.Compare(x.distance, y.distance),
		cmp.Compare(y.frequency, x.frequency),
		strings.Compare(x.word, y.word),
	)
}

// Suggester ranks dictionary words as replacements for a misspelled word.
//
// Symmetric-delete index: if two words are within MaxDistance edits, then
// deleting at most MaxDistance runes from each yields a common string (a
// substitution is one deletion on each side, an insertion is a deletion on
// the other side). The index maps every such deletion variant of every
// dictionary word to the words that produce it, so a lookup only verifies the
// handful of words that share a variant with the misspelling.
//
// The index is built once, from the dictionary as it is when the suggester is
// created.
type Suggester struct {
	dictionary *Dictionary
	index      map[string][]string
}

// NewSuggester returns a suggester over dictionary, with its index built.
func NewSuggester(dictionary *Dictionary) *Suggester {
	s := &Suggester{dictionary: dictionary, index: make(map[string][]string)}
	for _, entry := range dictionary.Words() {
		for _, variant := range deletes(entry, MaxDistance) {
			s.index[variant] = append(s.index[variant], entry)
		}
	}
	return s
}

// Suggest returns up to limit dictionary words within MaxDistance edits of
// word.
//
// The word is compared in its normalized (lower-case) form and the results
// are dictionary keys. Closest words come first; ties go to the more frequent
// word, then to the alphabetically smaller one.
func (s *Suggester) Suggest(word string, limit int) []string {
	key := Normalize(word)
	candidates := make(map[string]bool)
	for _, variant := range deletes(key, MaxDistance) {
		for _, candidate := range s.index[variant] {
			candidates[candidate] = true
		}
	}
	var matches []ranked
	for candidate := range candidates {
		if distance := EditDistance(key, candidate); distance <= MaxDistance {
			matches = append(matches, ranked{candidate, distance, s.dictionary.Frequency(candidate)})
		}
	}
	slices.SortFunc(matches, byRank)
	suggestions := []string{}
	for _, m := range matches[:min(max(limit, 0), len(matches))] {
		suggestions = append(suggestions, m.word)
	}
	return suggestions
}
