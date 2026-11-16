// Splits note text into words, keeping each word's character offsets.
//
// The editor draws its red underline from the offsets reported here, so every
// token must point at exactly the characters it came from in the note.
//
// Rules
//   - A word is a run of letters. An apostrophe with a letter on both sides
//     belongs to the word, so contractions and possessives stay whole:
//     don't, o'clock, team's.
//   - Quotes, hyphens, dashes, slashes and other punctuation separate words.
//     "well-known" is checked as "well" and "known"; 'draft' is just draft.
//   - Runs that contain a digit (2024, 3rd, mp3, 10am) are not words and are
//     skipped entirely.

package spellcheck

import (
	"strings"
	"unicode"
)

const (
	apostrophe = '\''
	digits     = "0123456789"
)

// Token is a word as it appears in the note. Offsets count runes, not bytes.
type Token struct {
	Text  string // the word exactly as written in the note
	Start int    // offset of its first character
	End   int    // offset one past its last character
}

func isWordChar(r rune) bool {
	return unicode.IsLetter(r) || strings.ContainsRune(digits, r)
}

// joinsWord reports whether runes[i] is an apostrophe with a letter on each side.
func joinsWord(runes []rune, i int) bool {
	return runes[i] == apostrophe && i > 0 && i < len(runes)-1 &&
		unicode.IsLetter(runes[i-1]) && unicode.IsLetter(runes[i+1])
}

// Tokenize returns every checkable word in text, in order.
func Tokenize(text string) []Token {
	runes := []rune(text)
	var tokens []Token
	i := 0
	for i < len(runes) {
		if !isWordChar(runes[i]) {
			i++
			continue
		}
		start := i
		for i < len(runes) && (isWordChar(runes[i]) || joinsWord(runes, i)) {
			i++
		}
		word := string(runes[start:i])
		if !strings.ContainsAny(word, digits) {
			tokens = append(tokens, Token{Text: word, Start: start, End: i})
		}
	}
	return tokens
}
