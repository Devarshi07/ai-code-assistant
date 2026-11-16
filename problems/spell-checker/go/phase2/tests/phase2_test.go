package tests

import (
	"reflect"
	"slices"
	"testing"

	"debuggym/spell-checker/spellcheck"
)

// baseWords is defined in phase1_test.go.

// rankingWords is a small dictionary in which every word except "damper" is
// one or two edits away from "lamp".
func rankingWords(t *testing.T) *spellcheck.Dictionary {
	t.Helper()
	words, err := spellcheck.Parse(`
lamp 40
lamb 40
limp 90
lump 10
lam 5
clamp 40
camp 300
ramp 40
lisp 70
clasp 500
lumps 999
damper 1000
`)
	if err != nil {
		t.Fatal(err)
	}
	return words
}

func expectDistance(t *testing.T, a, b string, want int) {
	t.Helper()
	if got := spellcheck.EditDistance(a, b); got != want {
		t.Errorf("EditDistance(%q, %q) = %d, want %d", a, b, got, want)
	}
}

func expectSuggestions(t *testing.T, suggester *spellcheck.Suggester, word string, limit int, want ...string) {
	t.Helper()
	if got := suggester.Suggest(word, limit); !slices.Equal(got, want) {
		t.Errorf("Suggest(%q, %d)\n got %q\nwant %q", word, limit, got, want)
	}
}

// EditDistance

func TestPhase2IdenticalAndEmpty(t *testing.T) {
	expectDistance(t, "note", "note", 0)
	expectDistance(t, "", "", 0)
	expectDistance(t, "", "abc", 3)
	expectDistance(t, "abc", "", 3)
}

func TestPhase2SingleEdits(t *testing.T) {
	expectDistance(t, "note", "notes", 1) // insertion
	expectDistance(t, "notes", "note", 1) // deletion
	expectDistance(t, "note", "nose", 1)  // substitution
	expectDistance(t, "calender", "calendar", 1)
	expectDistance(t, "tomorow", "tomorrow", 1)
}

func TestPhase2SwappedLettersCostTwo(t *testing.T) {
	expectDistance(t, "teh", "the", 2)
	expectDistance(t, "recieve", "receive", 2)
	expectDistance(t, "ab", "ba", 2)
}

func TestPhase2LongerDistances(t *testing.T) {
	expectDistance(t, "flaw", "lawn", 2)
	expectDistance(t, "receipt", "recipe", 2)
	expectDistance(t, "spelling", "misspelled", 6)
	expectDistance(t, "notebook", "bookmark", 6)
}

func TestPhase2ApostrophesAndAccentsAreCharacters(t *testing.T) {
	expectDistance(t, "dont", "don't", 1)
	expectDistance(t, "cafe", "café", 1)
}

// Ranking

func TestPhase2ClosestFirstThenMostFrequentThenAlphabetical(t *testing.T) {
	expectSuggestions(t, spellcheck.NewSuggester(rankingWords(t)), "lamp", 20,
		"lamp", "camp", "limp", "clamp", "lamb", "ramp", "lump", "lam", "lumps", "clasp", "lisp")
}

func TestPhase2MisspelledWord(t *testing.T) {
	expectSuggestions(t, spellcheck.NewSuggester(rankingWords(t)), "lmp", 20,
		"limp", "lamp", "lump", "lumps", "camp", "lisp", "clamp", "lamb", "ramp", "lam")
}

func TestPhase2Limit(t *testing.T) {
	suggester := spellcheck.NewSuggester(rankingWords(t))
	expectSuggestions(t, suggester, "lmp", 4, "limp", "lamp", "lump", "lumps")
	if spellcheck.DefaultLimit != 5 {
		t.Errorf("DefaultLimit = %d; the default limit is 5", spellcheck.DefaultLimit)
	}
	expectSuggestions(t, suggester, "lmp", spellcheck.DefaultLimit, "limp", "lamp", "lump", "lumps", "camp")
}

func TestPhase2InputIsNormalized(t *testing.T) {
	expectSuggestions(t, spellcheck.NewSuggester(rankingWords(t)), "LAMP", 3, "lamp", "camp", "limp")
}

func TestPhase2NothingCloseEnough(t *testing.T) {
	expectSuggestions(t, spellcheck.NewSuggester(rankingWords(t)), "xyzzy", spellcheck.DefaultLimit)
	expectSuggestions(t, spellcheck.NewSuggester(baseWords(t)), "xylophone", spellcheck.DefaultLimit)
}

// Suggestions from the base dictionary

func TestPhase2DistanceBeatsFrequency(t *testing.T) {
	suggester := spellcheck.NewSuggester(baseWords(t))
	expectSuggestions(t, suggester, "recieve", spellcheck.DefaultLimit, "relieve", "receive", "believe")
}

func TestPhase2CommonTypos(t *testing.T) {
	suggester := spellcheck.NewSuggester(baseWords(t))
	expectSuggestions(t, suggester, "tomorow", spellcheck.DefaultLimit, "tomorrow")
	expectSuggestions(t, suggester, "havent", spellcheck.DefaultLimit, "haven't", "have")
	expectSuggestions(t, suggester, "freind", spellcheck.DefaultLimit, "friend", "fiend", "find", "fried")
	expectSuggestions(t, suggester, "occured", spellcheck.DefaultLimit, "occurred", "occur")
}

func TestPhase2ShortWords(t *testing.T) {
	suggester := spellcheck.NewSuggester(baseWords(t))
	expectSuggestions(t, suggester, "teh", spellcheck.DefaultLimit, "tea", "tech", "ten", "the", "be")
	expectSuggestions(t, suggester, "carr", 4, "car", "card", "care", "cart")
}

func TestPhase2FrequencyTiesAreAlphabetical(t *testing.T) {
	suggester := spellcheck.NewSuggester(baseWords(t))
	expectSuggestions(t, suggester, "wierd", spellcheck.DefaultLimit, "were", "word", "weird", "wired", "fiend")
}

func TestPhase2ApostrophesAndAccents(t *testing.T) {
	suggester := spellcheck.NewSuggester(baseWords(t))
	expectSuggestions(t, suggester, "dont", 3, "don't", "done", "dot")
	expectSuggestions(t, suggester, "cafe", 3, "came", "café", "care")
	expectSuggestions(t, suggester, "don’t", 4, "don't", "won't", "can't", "doesn't")
}

// SpellChecker suggestions

func TestPhase2SuggestionsFollowTheWritersCapitalisation(t *testing.T) {
	checker := spellcheck.NewSpellChecker(baseWords(t))
	for _, c := range []struct {
		word  string
		limit int
		want  []string
	}{
		{"Recieve", spellcheck.DefaultLimit, []string{"Relieve", "Receive", "Believe"}},
		{"TEH", 3, []string{"TEA", "TECH", "TEN"}},
		{"Thier", 6, []string{"The", "This", "They", "Her", "There", "Their"}},
	} {
		if got := checker.Suggest(c.word, c.limit); !slices.Equal(got, c.want) {
			t.Errorf("SpellChecker.Suggest(%q, %d)\n got %q\nwant %q", c.word, c.limit, got, c.want)
		}
	}
}

func TestPhase2MisspellingsWithSuggestions(t *testing.T) {
	checker := spellcheck.NewSpellChecker(baseWords(t))
	found := checker.Check("Teh calender is ready")
	var words []string
	var suggestions [][]string
	for _, m := range found {
		words = append(words, m.Word)
		suggestions = append(suggestions, checker.Suggest(m.Word, 2))
	}
	if want := []string{"Teh", "calender"}; !slices.Equal(words, want) {
		t.Fatalf("Check found %q, want %q", words, want)
	}
	if want := [][]string{{"Tea", "Tech"}, {"calendar"}}; !reflect.DeepEqual(suggestions, want) {
		t.Errorf("suggestions %q, want %q", suggestions, want)
	}
}
