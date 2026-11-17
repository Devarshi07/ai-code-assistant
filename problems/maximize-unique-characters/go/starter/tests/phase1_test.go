package tests

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"debuggym/maximize-unique-characters/oneofeach"
)

// The helpers in this file are shared by every test file in the package.

const sampleList = `
# word     difficulty  themes
Tango      2           music, dance
otter      1           animals
fig        1           kitchen, garden
jam        1           kitchen, music
quiche     3           kitchen
`

// assertEqual stops the test when got and want differ.
func assertEqual(t *testing.T, got, want any, what string) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s: got %v, want %v", what, got, want)
	}
}

// mustWords builds Words from plain strings, normalizing them like the loader does.
func mustWords(t *testing.T, items ...string) []oneofeach.Word {
	t.Helper()
	words, err := oneofeach.AsWords(items)
	if err != nil {
		t.Fatal(err)
	}
	return words
}

func mustPuzzle(t *testing.T, day, theme string, items ...string) oneofeach.Puzzle {
	t.Helper()
	puzzle, err := oneofeach.NewPuzzle(day, theme, items)
	if err != nil {
		t.Fatal(err)
	}
	return puzzle
}

func mustParse(t *testing.T, text string) []oneofeach.Word {
	t.Helper()
	words, err := oneofeach.ParseWordList(text)
	if err != nil {
		t.Fatal(err)
	}
	return words
}

func texts(words []oneofeach.Word) []string {
	out := make([]string, len(words))
	for i, word := range words {
		out[i] = word.Text
	}
	return out
}

func TestPhase1Validator(t *testing.T) {
	t.Run("clean board has no problems", func(t *testing.T) {
		board := mustWords(t, "zebra", "lynx", "dog")
		assertEqual(t, len(oneofeach.SelectionProblems(board)), 0, "problem count")
		assertEqual(t, oneofeach.IsValidSelection(board), true, "valid")
	})

	t.Run("words sharing a letter are rejected", func(t *testing.T) {
		problems := oneofeach.SelectionProblems(mustWords(t, "drum", "harp"))
		assertEqual(t, len(problems), 1, "problem count")
		if !strings.Contains(problems[0], "'r'") {
			t.Fatalf("problem does not name 'r': %s", problems[0])
		}
	})

	t.Run("clash report names every earlier word", func(t *testing.T) {
		problems := oneofeach.SelectionProblems(mustWords(t, "drum", "harp", "tempo"))
		assertEqual(t, len(problems), 2, "problem count")
		if !strings.Contains(problems[1], "'drum'") || !strings.Contains(problems[1], "'harp'") {
			t.Fatalf("clash report misses an earlier word: %s", problems[1])
		}
	})

	t.Run("reported kitchen board is rejected", func(t *testing.T) {
		// Player report for 2026-10-12: "today's board has two Ts".
		assertEqual(t, oneofeach.IsValidSelection(mustWords(t, "butter", "fig", "jam", "wok")), false, "valid")
	})

	t.Run("double letter problem names the letter", func(t *testing.T) {
		problems := oneofeach.SelectionProblems(mustWords(t, "moss", "fern"))
		assertEqual(t, len(problems), 1, "problem count")
		if !strings.Contains(problems[0], "'moss'") || !strings.Contains(problems[0], "'s'") {
			t.Fatalf("problem does not name 'moss' and 's': %s", problems[0])
		}
	})

	t.Run("letter used three times in one word", func(t *testing.T) {
		assertEqual(t, oneofeach.IsValidSelection(mustWords(t, "bobbin")), false, "valid")
	})
}

func TestPhase1Puzzle(t *testing.T) {
	t.Run("tile count counts every tile", func(t *testing.T) {
		puzzle := mustPuzzle(t, "2026-10-12", "kitchen", "butter", "fig", "jam", "wok")
		assertEqual(t, puzzle.TileCount(), 15, "tile count")
		if rendered := oneofeach.Render(puzzle); !strings.Contains(rendered, "15 tiles") {
			t.Fatalf("header does not say 15 tiles: %s", rendered)
		}
	})

	t.Run("unused letters", func(t *testing.T) {
		puzzle := mustPuzzle(t, "2026-10-14", "animals", "zebra", "lynx", "dog")
		assertEqual(t, puzzle.TileCount(), 12, "tile count")
		assertEqual(t, puzzle.UnusedLetters(), "cfhijkmpqstuvw", "unused letters")
	})
}

func TestPhase1WordList(t *testing.T) {
	t.Run("parse reads difficulty and themes", func(t *testing.T) {
		words := mustParse(t, sampleList)
		assertEqual(t, texts(words), []string{"tango", "otter", "fig", "jam", "quiche"}, "words")
		assertEqual(t, words[0].Difficulty, 2, "difficulty")
		assertEqual(t, words[0].Tags, []string{"dance", "music"}, "tags")
	})

	t.Run("filter by theme and difficulty", func(t *testing.T) {
		words := mustParse(t, sampleList)
		assertEqual(t, texts(oneofeach.FilterWords(words, oneofeach.FilterOptions{Theme: "kitchen"})), []string{"fig", "jam", "quiche"}, "kitchen")
		assertEqual(t, texts(oneofeach.FilterWords(words, oneofeach.FilterOptions{Theme: "kitchen", MaxDifficulty: 2})), []string{"fig", "jam"}, "easy kitchen")
	})

	t.Run("bad word reports its line", func(t *testing.T) {
		_, err := oneofeach.ParseWordList("fig 1 kitchen\nrock'n'roll 2 music\n")
		var listErr *oneofeach.WordListError
		if !errors.As(err, &listErr) {
			t.Fatalf("want a WordListError, got %v", err)
		}
		if !strings.Contains(err.Error(), "line 2") {
			t.Fatalf("error does not name line 2: %v", err)
		}
	})

	t.Run("playable words skip double letters and duplicates", func(t *testing.T) {
		words := mustParse(t, sampleList+"fig 2 snacks\n")
		assertEqual(t, texts(oneofeach.PlayableWords(words)), []string{"tango", "fig", "jam", "quiche"}, "playable")
	})
}
