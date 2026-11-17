package oneofeach

// Loads the designers' candidate list.
//
// Format: one word per line, then its difficulty (1-3), then optional
// comma-separated theme tags. Blank lines and # comments are ignored.
//
//	# word      difficulty   tags
//	tango       2            music, dance
//	otter       1            animals

import (
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

// DefaultPath is the word list, relative to the project root.
const DefaultPath = "data/words.txt"

// WordListError is returned for a malformed line, with its line number.
type WordListError struct {
	Message string
}

func (e *WordListError) Error() string { return e.Message }

// ParseWordList parses word-list text into Words, in file order.
func ParseWordList(text string) ([]Word, error) {
	var words []Word
	for index, raw := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		number := index + 1
		line := strings.TrimSpace(strings.SplitN(raw, "#", 2)[0])
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			return nil, &WordListError{fmt.Sprintf("line %d: expected 'word difficulty [tags]', got '%s'", number, line)}
		}
		difficulty := fields[1]
		if difficulty != "1" && difficulty != "2" && difficulty != "3" {
			return nil, &WordListError{fmt.Sprintf("line %d: difficulty must be 1, 2 or 3, got '%s'", number, difficulty)}
		}
		var tags []string
		for _, tag := range strings.Split(strings.Join(fields[2:], " "), ",") {
			if tag = strings.ToLower(strings.TrimSpace(tag)); tag != "" {
				tags = append(tags, tag)
			}
		}
		level, _ := strconv.Atoi(difficulty)
		word, err := NewWord(fields[0], level, tags)
		if err != nil {
			var wordErr *WordError
			if errors.As(err, &wordErr) {
				return nil, &WordListError{fmt.Sprintf("line %d: %s", number, wordErr.Message)}
			}
			return nil, err
		}
		words = append(words, word)
	}
	return words, nil
}

// LoadWordList reads and parses a word-list file.
func LoadWordList(path string) ([]Word, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParseWordList(string(data))
}

// FilterOptions narrows a word list. The zero value keeps every word.
type FilterOptions struct {
	Theme         string // only words tagged with this theme; "" means any
	MaxDifficulty int    // only words no harder than this; 0 means any
}

// FilterWords returns the candidates that match the options, in order.
func FilterWords(words []Word, options FilterOptions) []Word {
	var kept []Word
	for _, word := range words {
		if options.Theme != "" && !word.HasTag(options.Theme) {
			continue
		}
		if options.MaxDifficulty != 0 && word.Difficulty > options.MaxDifficulty {
			continue
		}
		kept = append(kept, word)
	}
	return kept
}

// Themes lists every theme tag used in the list, alphabetically.
func Themes(words []Word) []string {
	seen := map[string]bool{}
	var all []string
	for _, word := range words {
		for _, tag := range word.Tags {
			if !seen[tag] {
				seen[tag] = true
				all = append(all, tag)
			}
		}
	}
	sort.Strings(all)
	return all
}
