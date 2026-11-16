// Package spellcheck is the spell-check service behind the Marginalia note
// editor: it finds the misspelled words in a note, with their offsets, and
// suggests replacements for them.
//
// The editor calls Check on every keystroke pause, so it only reports where
// the problems are. Suggestions are fetched separately, when the user opens
// the right-click menu on an underlined word.
package spellcheck

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// Misspelling is a word the dictionary doesn't know, with offsets like a Token's.
type Misspelling struct {
	Word  string // as written in the note
	Start int
	End   int
}

// SpellChecker finds misspellings using a dictionary and the session's
// "Ignore all" list.
type SpellChecker struct {
	Dictionary      *Dictionary
	IgnoreUppercase bool // skip acronyms such as NASA; true by default

	ignored   map[string]bool
	suggester *Suggester
}

// NewSpellChecker returns a checker over dictionary that skips acronyms.
func NewSpellChecker(dictionary *Dictionary) *SpellChecker {
	return &SpellChecker{Dictionary: dictionary, IgnoreUppercase: true, ignored: make(map[string]bool)}
}

// isShouting reports whether word is all capitals and longer than one
// letter: NASA, TODO, DON'T.
func isShouting(word string) bool {
	return utf8.RuneCountInString(word) > 1 && word == strings.ToUpper(word) && word != strings.ToLower(word)
}

// MatchCase gives a suggestion the capitalisation of the word it would replace.
func MatchCase(template, word string) string {
	if isShouting(template) {
		return strings.ToUpper(word)
	}
	first, _ := utf8.DecodeRuneInString(template)
	if unicode.IsUpper(first) && word != "" {
		r, size := utf8.DecodeRuneInString(word)
		return string(unicode.ToUpper(r)) + word[size:]
	}
	return word
}

// Ignore is "Ignore all" from the context menu: accept word for this session.
func (c *SpellChecker) Ignore(word string) {
	c.ignored[Normalize(word)] = true
}

// IsKnown reports whether word is in the dictionary, ignored, or the
// possessive of a known word.
func (c *SpellChecker) IsKnown(word string) bool {
	key := Normalize(word)
	if c.ignored[key] || c.Dictionary.Contains(key) {
		return true
	}
	// Possessives aren't listed separately: "team's" is fine if "team" is.
	return strings.HasSuffix(key, "'s") && c.Dictionary.Contains(strings.TrimSuffix(key, "'s"))
}

// Check returns every misspelled word in text, in order of appearance.
func (c *SpellChecker) Check(text string) []Misspelling {
	var found []Misspelling
	for _, token := range Tokenize(text) {
		if c.IgnoreUppercase && isShouting(token.Text) {
			continue
		}
		if !c.IsKnown(token.Text) {
			found = append(found, Misspelling{Word: token.Text, Start: token.Start, End: token.End})
		}
	}
	return found
}

// Suggest returns up to limit replacements for word, capitalised the way the
// user wrote it.
func (c *SpellChecker) Suggest(word string, limit int) []string {
	if c.suggester == nil {
		c.suggester = NewSuggester(c.Dictionary)
	}
	suggestions := c.suggester.Suggest(word, limit)
	matched := make([]string, len(suggestions))
	for i, s := range suggestions {
		matched[i] = MatchCase(word, s)
	}
	return matched
}
