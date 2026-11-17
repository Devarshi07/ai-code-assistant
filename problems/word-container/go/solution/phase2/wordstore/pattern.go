// Crossword patterns: the syntax used by the solver panel and the grid filler.
//
// A pattern describes a whole entry, one symbol per square:
//
//	letter   that exact letter                    c?t   -> cat, cot, cut
//	?        exactly one letter, any letter       ???   -> every 3-letter word
//	*        any run of letters, including none   c*t   -> cat, chart, cut, ...
//	                                              cat*  -> cat, cats, catalog, ...
//
// A pattern must match the *whole* word: "c?t" matches neither "scat" nor "cats".
//
// Setters often type blanks as "." or "_", so both are read as "?". Letters get
// the same clean-up as stored words (case, accents, spaces, hyphens and
// apostrophes are ignored), so "C.T", "ç?t" and "c-?-t" all mean "c?t".
// Runs of stars collapse: "c**t" is the same pattern as "c*t".
package wordstore

import (
	"fmt"
	"strings"
)

const (
	AnyLetter = '?'
	AnyRun    = '*'
	// Our largest grid is 25x25, so anything longer is almost certainly a paste mistake.
	MaxSymbols = 25
	// NoMaxLength is the Pattern.MaxLength of a pattern that contains a star.
	NoMaxLength = -1
)

// PatternError is the error for text that is not a valid crossword pattern.
type PatternError struct {
	Message string
}

func (e *PatternError) Error() string { return e.Message }

// Pattern is a parsed crossword pattern. Create one with ParsePattern.
type Pattern struct {
	Text      string // canonical form: letters a-z, "?" and "*", e.g. "c?t*"
	MinLength int
	MaxLength int // NoMaxLength when the pattern contains a star and so has no upper bound
}

func newPattern(text string) *Pattern {
	p := &Pattern{Text: text, MaxLength: len(text)}
	for i := 0; i < len(text); i++ {
		if text[i] != AnyRun {
			p.MinLength++
		} else {
			p.MaxLength = NoMaxLength
		}
	}
	return p
}

// Matches reports whether word (already normalised, as stored) fits this pattern.
func (p *Pattern) Matches(word string) bool {
	if len(word) < p.MinLength {
		return false
	}
	symbols := p.Text
	if p.MaxLength != NoMaxLength {
		if len(word) != p.MaxLength {
			return false
		}
		for i := 0; i < len(word); i++ {
			if symbols[i] != AnyLetter && symbols[i] != word[i] {
				return false
			}
		}
		return true
	}
	// Greedy scan. When the next symbol can't take the next letter, go back
	// to the most recent star and let it swallow one more letter.
	at, w := 0, 0
	star, resume := -1, 0
	for w < len(word) {
		switch {
		case at < len(symbols) && (symbols[at] == AnyLetter || symbols[at] == word[w]):
			at++
			w++
		case at < len(symbols) && symbols[at] == AnyRun:
			star, resume = at, w
			at++
		case star >= 0:
			resume++
			at, w = star+1, resume
		default:
			return false
		}
	}
	// Only stars may be left over; they match the empty run.
	for at < len(symbols) && symbols[at] == AnyRun {
		at++
	}
	return at == len(symbols)
}

func (p *Pattern) String() string { return p.Text }

// ParsePattern turns user input into a Pattern.
func ParsePattern(raw string) (*Pattern, error) {
	var symbols []rune
	for _, r := range strings.ToLower(StripAccents(strings.TrimSpace(raw))) {
		switch {
		case IsLetter(r):
			symbols = append(symbols, r)
		case r == '?' || r == '.' || r == '_':
			symbols = append(symbols, AnyLetter)
		case r == AnyRun:
			if len(symbols) == 0 || symbols[len(symbols)-1] != AnyRun {
				symbols = append(symbols, AnyRun)
			}
		case IsIgnored(r):
			// grids skip these
		default:
			return nil, &PatternError{fmt.Sprintf("'%s': '%c' is not allowed in a pattern", raw, r)}
		}
	}
	if len(symbols) == 0 {
		return nil, &PatternError{fmt.Sprintf("'%s': pattern is empty", raw)}
	}
	if len(symbols) > MaxSymbols {
		return nil, &PatternError{fmt.Sprintf("'%s': patterns are limited to %d symbols", raw, MaxSymbols)}
	}
	return newPattern(string(symbols)), nil
}
