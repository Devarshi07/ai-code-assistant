// Package oneofeach holds the puzzle desk tools for One of Each.
//
// Letter-set helpers shared by the whole package.
//
// A word's letters are stored as a 26-bit mask: bit 0 is 'a', bit 25 is 'z'.
// Masks make the puzzle rule cheap to check, because two words share a letter
// exactly when a&b != 0.
//
//	MaskLetters(LetterMask("tango")) // "agnot"
package oneofeach

import (
	"fmt"
	"sort"
	"strings"
)

const (
	Alphabet = "abcdefghijklmnopqrstuvwxyz"
	FullMask = uint32(1<<len(Alphabet)) - 1
)

// WordError is returned for text that cannot be used as a puzzle word.
type WordError struct {
	Message string
}

func (e *WordError) Error() string { return e.Message }

// NormalizeWord trims and lower-cases a word. Anything except the letters a-z is rejected.
func NormalizeWord(raw string) (string, error) {
	word := strings.ToLower(strings.TrimSpace(raw))
	if word == "" {
		return "", &WordError{"empty word"}
	}
	seen := map[rune]bool{}
	var bad []string
	for _, ch := range word {
		if !strings.ContainsRune(Alphabet, ch) && !seen[ch] {
			seen[ch] = true
			bad = append(bad, string(ch))
		}
	}
	if len(bad) > 0 {
		sort.Strings(bad)
		return "", &WordError{fmt.Sprintf("'%s' contains '%s'; only a-z are allowed", strings.TrimSpace(raw), strings.Join(bad, ""))}
	}
	return word, nil
}

// LetterBit is the mask bit for a single lower-case letter.
func LetterBit(ch byte) uint32 {
	return 1 << (ch - 'a')
}

// LetterMask is the bitmask of the distinct letters in a normalized word.
func LetterMask(word string) uint32 {
	var mask uint32
	for i := 0; i < len(word); i++ {
		mask |= LetterBit(word[i])
	}
	return mask
}

// Popcount is the number of letters in a mask.
func Popcount(mask uint32) int {
	count := 0
	for rest := mask; rest != 0; rest &= rest - 1 {
		count++
	}
	return count
}

// MaskLetters lists the letters in a mask, alphabetically: MaskLetters(LetterMask("otter")) == "eort".
func MaskLetters(mask uint32) string {
	var letters strings.Builder
	for i := 0; i < len(Alphabet); i++ {
		if mask&(1<<i) != 0 {
			letters.WriteByte(Alphabet[i])
		}
	}
	return letters.String()
}

// SharedLetters lists the letters present in both masks, alphabetically.
func SharedLetters(a, b uint32) string {
	return MaskLetters(a & b)
}
