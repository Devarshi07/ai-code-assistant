// The word list behind the spell checker, with usage frequencies.
//
// File format: one entry per line, a word and how often it appeared in the
// notes corpus, separated by whitespace. A missing count means 1. Blank lines
// and lines starting with # are ignored.
//
//	receive   215
//	don't     3020

package spellcheck

import (
	_ "embed"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
)

// baseWords is the base dictionary, data/words.txt, compiled into the package.
//
//go:embed data/words.txt
var baseWords string

// Normalize returns the lookup key for a word: lower case, typographic
// apostrophes as '.
func Normalize(word string) string {
	return strings.ToLower(strings.ReplaceAll(word, "’", "'"))
}

// Dictionary holds known words and their frequencies, keyed by Normalize(word).
type Dictionary struct {
	counts map[string]int
	order  []string // keys in the order they were added
}

// NewDictionary returns an empty dictionary.
func NewDictionary() *Dictionary {
	return &Dictionary{counts: make(map[string]int)}
}

// Parse reads a word list in the format above.
func Parse(text string) (*Dictionary, error) {
	d := NewDictionary()
	for i, raw := range strings.Split(text, "\n") {
		raw = strings.TrimSuffix(raw, "\r")
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.Fields(line)
		count, err := uint64(1), error(nil)
		if len(parts) == 2 {
			count, err = strconv.ParseUint(parts[1], 10, 31)
		}
		if len(parts) > 2 || err != nil {
			return nil, fmt.Errorf("line %d: expected 'word count', got '%s'", i+1, raw)
		}
		d.Add(parts[0], int(count))
	}
	return d, nil
}

// Load reads the word list in the file at path.
func Load(path string) (*Dictionary, error) {
	text, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(string(text))
}

// LoadDefault returns the base dictionary that ships with the package.
func LoadDefault() (*Dictionary, error) {
	return Parse(baseWords)
}

// Add adds word, or adds count to it if it is already known.
func (d *Dictionary) Add(word string, count int) {
	key := Normalize(word)
	if _, known := d.counts[key]; !known {
		d.order = append(d.order, key)
	}
	d.counts[key] += count
}

// Contains reports whether word is in the dictionary.
func (d *Dictionary) Contains(word string) bool {
	_, known := d.counts[Normalize(word)]
	return known
}

// Frequency returns how common word is; 0 when it isn't in the dictionary.
func (d *Dictionary) Frequency(word string) int {
	return d.counts[Normalize(word)]
}

// Words returns every entry's lookup key, in the order they were added.
func (d *Dictionary) Words() []string {
	return slices.Clone(d.order)
}

// Len returns the number of entries.
func (d *Dictionary) Len() int {
	return len(d.order)
}
