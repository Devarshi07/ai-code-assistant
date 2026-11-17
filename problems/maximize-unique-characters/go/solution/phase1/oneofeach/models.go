package oneofeach

// Data model: candidate words, solver selections and dated puzzles.

import "sort"

// Word is one candidate from the designers' word list.
//
// Text is always normalized (lower-case a-z). Mask holds the word's letters as
// a bitmask (see letters.go). Difficulty runs from 1 (easy) to 3 (hard) and
// Tags names the themes the word belongs to.
type Word struct {
	Text       string
	Difficulty int
	Tags       []string
	Mask       uint32
}

// NewWord normalizes text and builds its mask. Tags are kept sorted and unique.
func NewWord(text string, difficulty int, tags []string) (Word, error) {
	normalized, err := NormalizeWord(text)
	if err != nil {
		return Word{}, err
	}
	unique := map[string]bool{}
	var kept []string
	for _, tag := range tags {
		if !unique[tag] {
			unique[tag] = true
			kept = append(kept, tag)
		}
	}
	sort.Strings(kept)
	return Word{Text: normalized, Difficulty: difficulty, Tags: kept, Mask: LetterMask(normalized)}, nil
}

// Letters returns the word's distinct letters in alphabetical order ("otter" -> "eort").
func (w Word) Letters() string {
	return MaskLetters(w.Mask)
}

// Length is how many tiles the word puts on the board.
func (w Word) Length() int {
	return len(w.Text)
}

// HasRepeats reports whether some letter appears more than once in the word.
func (w Word) HasRepeats() bool {
	return Popcount(w.Mask) != w.Length()
}

// HasTag reports whether the word belongs to the theme.
func (w Word) HasTag(tag string) bool {
	for _, t := range w.Tags {
		if t == tag {
			return true
		}
	}
	return false
}

func (w Word) String() string {
	return "Word(" + w.Text + ")"
}

// AsWords builds a Word for every plain string.
func AsWords(items []string) ([]Word, error) {
	words := make([]Word, 0, len(items))
	for _, item := range items {
		word, err := NewWord(item, 1, nil)
		if err != nil {
			return nil, err
		}
		words = append(words, word)
	}
	return words, nil
}

// Selection is a solver answer: the chosen words in alphabetical order, and
// Total, the number of letters they cover.
type Selection struct {
	Words []string
	Total int
}

// Puzzle is a dated, themed board. Every letter may appear on it at most once.
type Puzzle struct {
	Day   string
	Theme string
	Words []Word
}

// NewPuzzle builds a puzzle from plain words.
func NewPuzzle(day, theme string, words []string) (Puzzle, error) {
	built, err := AsWords(words)
	if err != nil {
		return Puzzle{}, err
	}
	return Puzzle{Day: day, Theme: theme, Words: built}, nil
}

// Covered is the mask of every letter that appears on the board.
func (p Puzzle) Covered() uint32 {
	var mask uint32
	for _, word := range p.Words {
		mask |= word.Mask
	}
	return mask
}

// TileCount is the number of tiles shown on the board; the header and the score use this.
func (p Puzzle) TileCount() int {
	sum := 0
	for _, word := range p.Words {
		sum += word.Length()
	}
	return sum
}

// UnusedLetters lists the letters of the alphabet that are not on the board.
func (p Puzzle) UnusedLetters() string {
	return MaskLetters(FullMask &^ p.Covered())
}
