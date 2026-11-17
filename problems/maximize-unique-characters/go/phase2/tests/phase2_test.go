package tests

import (
	"slices"
	"testing"

	"debuggym/maximize-unique-characters/oneofeach"
)

// assertValidSelection is an independent check: a real board built from the
// candidates, honestly scored. It is shared with the phase 3 tests.
func assertValidSelection(t *testing.T, candidates []oneofeach.Word, result oneofeach.Selection) {
	t.Helper()
	pool := map[string]bool{}
	for _, c := range candidates {
		pool[c.Text] = true
	}
	if !slices.IsSorted(result.Words) {
		t.Fatalf("words must be in alphabetical order: %v", result.Words)
	}
	seen := map[rune]bool{}
	tiles := 0
	for _, word := range result.Words {
		if !pool[word] {
			t.Fatalf("'%s' is not one of the candidates", word)
		}
		own := map[rune]bool{}
		for _, ch := range word {
			if own[ch] {
				t.Fatalf("'%s' repeats a letter", word)
			}
			own[ch] = true
			if seen[ch] {
				t.Fatalf("'%s' reuses '%c', which is already on the board", word, ch)
			}
			seen[ch] = true
		}
		tiles += len(word)
	}
	if result.Total != tiles {
		t.Fatalf("total must count every tile: got %d, board has %d", result.Total, tiles)
	}
}

func check(t *testing.T, candidates []oneofeach.Word, words []string, total int, message string) {
	t.Helper()
	result := oneofeach.BestSelection(candidates)
	assertValidSelection(t, candidates, result)
	if result.Total != total {
		t.Fatalf("%s total: got %d, want %d (%v)", message, result.Total, total, result.Words)
	}
	if !slices.Equal(result.Words, words) {
		t.Fatalf("%s words: got %v, want %v", message, result.Words, words)
	}
}

func TestPhase2BestSelection(t *testing.T) {
	t.Run("three animals fit together", func(t *testing.T) {
		check(t, mustWords(t, "cat", "dog", "bird", "fish"), []string{"cat", "dog", "fish"}, 10, "animals")
	})

	t.Run("words with repeated letters are never used", func(t *testing.T) {
		check(t, mustWords(t, "letter", "otter", "cab", "dim"), []string{"cab", "dim"}, 6, "repeats")
	})

	t.Run("longest word first is not optimal", func(t *testing.T) {
		check(t, mustWords(t, "blanket", "trophy", "jumbled", "fix"), []string{"fix", "jumbled", "trophy"}, 16,
			"two medium words beat the longest word")
	})

	t.Run("tie goes to the alphabetically first word list", func(t *testing.T) {
		// 'pod tan' and 'and top' both cover the same six letters.
		check(t, mustWords(t, "tan", "pod", "top", "and"), []string{"and", "top"}, 6, "tie")
	})

	t.Run("anagram tie picks the first spelling", func(t *testing.T) {
		check(t, mustWords(t, "pot", "top", "opt", "and"), []string{"and", "opt"}, 6, "anagrams")
	})

	t.Run("words are normalized and deduplicated", func(t *testing.T) {
		check(t, mustWords(t, "Tango", "tango", " FLY ", "jinx"), []string{"fly", "tango"}, 8, "normalized")
	})

	t.Run("nothing playable gives an empty board", func(t *testing.T) {
		check(t, nil, []string{}, 0, "no candidates")
		check(t, mustWords(t, "otter", "llama", "kiwi"), []string{}, 0, "nothing playable")
	})

	t.Run("sixteen candidates with five tied boards", func(t *testing.T) {
		candidates := mustWords(t, "quiz", "jumpy", "vex", "fjord", "glyph", "brick", "wealth", "stomp", "dwarf", "nymph",
			"sculpt", "garden", "volcano", "kiosk", "whisky", "zebra")
		check(t, candidates, []string{"dwarf", "glyph", "quiz", "vex"}, 17, "sixteen candidates")
	})

	t.Run("accepts words from the loader", func(t *testing.T) {
		words := mustParse(t, "Banjo 2 music\nharp 1 music\nsax 2 music\nflute 1 music\n")
		check(t, words, []string{"banjo", "flute"}, 10, "loader")
	})

	t.Run("music theme from the word list", func(t *testing.T) {
		words, err := oneofeach.LoadWordList("../data/words.txt")
		if err != nil {
			t.Fatal(err)
		}
		check(t, oneofeach.FilterWords(words, oneofeach.FilterOptions{Theme: "music", MaxDifficulty: 2}), []string{"chord", "flute", "jam"}, 13, "music")
	})

	t.Run("kitchen theme from the word list", func(t *testing.T) {
		words, err := oneofeach.LoadWordList("../data/words.txt")
		if err != nil {
			t.Fatal(err)
		}
		check(t, oneofeach.FilterWords(words, oneofeach.FilterOptions{Theme: "kitchen", MaxDifficulty: 2}), []string{"bread", "fig", "plum", "wok"}, 15, "kitchen")
	})
}
