// Normalisation rules shared by everything that stores or looks up words.
//
// A crossword grid holds one plain letter per square, so the store keeps every
// entry in a single canonical form:
//
//  1. Surrounding whitespace is removed and letters are lowercased.
//  2. Accents are stripped: "Café" -> "cafe", "jalapeño" -> "jalapeno".
//  3. Spaces, hyphens and apostrophes inside an entry are dropped, the way grids
//     ignore them: "ice cream" -> "icecream", "o'clock" -> "oclock".
//  4. What is left must be letters a-z. Digits and other symbols make the entry
//     invalid ("r2d2", "24/7"), and so does an entry with no letters at all.
package wordstore

import (
	"fmt"
	"strings"
	"unicode"
)

// InvalidWord is the error for an entry that cannot be stored as a grid word.
type InvalidWord struct {
	Message string
}

func (e *InvalidWord) Error() string { return e.Message }

// IsLetter reports whether r is one of the squares a grid can hold, a-z.
func IsLetter(r rune) bool { return r >= 'a' && r <= 'z' }

// IsIgnored reports whether grids skip r: space, hyphen, straight and curly apostrophes.
func IsIgnored(r rune) bool { return r == ' ' || r == '-' || r == '\'' || r == '’' }

// accentFolds maps the accented letters we expect in word lists to their plain
// form. (Go's standard library has no Unicode decomposition.)
var accentFolds = map[rune]string{}

func init() {
	groups := map[string]string{
		"a": "àáâãäåāăą", "c": "çćĉċč", "d": "ď", "e": "èéêëēĕėęě", "g": "ĝğġģ",
		"h": "ĥ", "i": "ìíîïĩīĭįı", "j": "ĵ", "k": "ķ", "l": "ĺļľ", "n": "ñńņň",
		"o": "òóôõöōŏő", "r": "ŕŗř", "s": "śŝşš", "t": "ţť", "u": "ùúûüũūŭůűų",
		"w": "ŵ", "y": "ýÿŷ", "z": "źżž",
	}
	for plain, accented := range groups {
		for _, r := range accented {
			accentFolds[r] = plain
			accentFolds[unicode.ToUpper(r)] = strings.ToUpper(plain)
		}
	}
	accentFolds['İ'] = "I"
	accentFolds['ı'] = "i"
	accentFolds['ﬁ'] = "fi"
	accentFolds['ﬂ'] = "fl"
}

// StripAccents replaces accented letters with their plain form (é -> e, ﬁ -> fi)
// and drops combining marks.
func StripAccents(text string) string {
	var out strings.Builder
	for _, r := range text {
		if unicode.Is(unicode.M, r) {
			continue
		}
		if plain, ok := accentFolds[r]; ok {
			out.WriteString(plain)
		} else {
			out.WriteRune(r)
		}
	}
	return out.String()
}

func isPlainASCII(text string) bool {
	if text == "" {
		return false
	}
	for i := 0; i < len(text); i++ {
		c := text[i]
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z') {
			return false
		}
	}
	return true
}

// NormalizeWord returns the canonical form of an entry, or an *InvalidWord
// error when there is none.
func NormalizeWord(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	// Fast path: almost every line of a word list is a plain ASCII word.
	if isPlainASCII(text) {
		return strings.ToLower(text), nil
	}
	var letters strings.Builder
	for _, r := range strings.ToLower(StripAccents(text)) {
		if IsLetter(r) {
			letters.WriteRune(r)
		} else if !IsIgnored(r) {
			return "", &InvalidWord{fmt.Sprintf("'%s': '%c' is not a letter", raw, r)}
		}
	}
	if letters.Len() == 0 {
		return "", &InvalidWord{fmt.Sprintf("'%s': no letters", raw)}
	}
	return letters.String(), nil
}

// NormalizePrefix is like NormalizeWord, but an empty prefix is allowed and
// means "every word".
func NormalizePrefix(raw string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", nil
	}
	return NormalizeWord(raw)
}
