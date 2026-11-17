package tests

import (
	"errors"
	"slices"
	"testing"

	"debuggym/word-container/wordstore"
)

var sampleWords = []string{"cat", "cot", "cut", "cute", "cuts", "coat", "cart", "chart", "comet",
	"act", "at", "a", "scat", "tact", "cactus"}

func fits(t *testing.T, pattern, word string) bool {
	t.Helper()
	parsed, err := wordstore.ParsePattern(pattern)
	if err != nil {
		t.Fatalf("ParsePattern(%q): %v", pattern, err)
	}
	return parsed.Matches(word)
}

func phase2Sample(t *testing.T) *wordstore.WordContainer {
	t.Helper()
	return storeOf(t, sampleWords...)
}

// match runs a pattern search that must succeed.
func match(t *testing.T, words *wordstore.WordContainer, pattern string, limit int) []string {
	t.Helper()
	found, err := words.Match(pattern, limit)
	if err != nil {
		t.Fatalf("Match(%q): %v", pattern, err)
	}
	return found
}

func TestPhase2PatternMatches(t *testing.T) {
	t.Run("question mark is exactly one letter", func(t *testing.T) {
		assertEqual(t, fits(t, "c?t", "cat"), true, "c?t cat")
		assertEqual(t, fits(t, "c?t", "cot"), true, "c?t cot")
		for _, word := range []string{"ct", "coat", "scat", "cats"} {
			assertEqual(t, fits(t, "c?t", word), false, "c?t should not match "+word)
		}
	})

	t.Run("star matches any run including none", func(t *testing.T) {
		for _, word := range []string{"ct", "cat", "chart"} {
			assertEqual(t, fits(t, "c*t", word), true, "c*t should match "+word)
		}
		assertEqual(t, fits(t, "c*t", "cats"), false, "c*t cats")
		assertEqual(t, fits(t, "c*t", "act"), false, "c*t act")
		assertEqual(t, fits(t, "*", "a"), true, "* a")
		assertEqual(t, fits(t, "cat*", "cat"), true, "cat* cat")
	})

	t.Run("stars can give letters back", func(t *testing.T) {
		assertEqual(t, fits(t, "*ab", "aab"), true, "*ab aab")
		assertEqual(t, fits(t, "*ab", "abab"), true, "*ab abab")
		assertEqual(t, fits(t, "*ab", "aba"), false, "*ab aba")
		assertEqual(t, fits(t, "a*b*c", "aabbcc"), true, "a*b*c aabbcc")
		assertEqual(t, fits(t, "a*b*c", "acb"), false, "a*b*c acb")
		assertEqual(t, fits(t, "*a*a", "banana"), true, "*a*a banana")
		assertEqual(t, fits(t, "*s*s*s*", "mississippi"), true, "*s*s*s* mississippi")
	})

	t.Run("question marks and stars together", func(t *testing.T) {
		assertEqual(t, fits(t, "?*?", "a"), false, "?*? a")
		assertEqual(t, fits(t, "?*?", "ab"), true, "?*? ab")
		assertEqual(t, fits(t, "?*?", "abc"), true, "?*? abc")
		assertEqual(t, fits(t, "ba??na*", "banana"), true, "ba??na* banana")
		assertEqual(t, fits(t, "ba??na*", "bandana"), false, "ba??na* bandana")
		assertEqual(t, fits(t, "*a*a", "a"), false, "*a*a a")
	})
}

func TestPhase2WordContainerMatch(t *testing.T) {
	t.Run("crossword clue", func(t *testing.T) {
		assertWords(t, match(t, phase2Sample(t), "c?t", wordstore.NoLimit), []string{"cat", "cot", "cut"}, "c?t")
	})

	t.Run("trailing star keeps alphabetical order", func(t *testing.T) {
		assertWords(t, match(t, phase2Sample(t), "c?t*", wordstore.NoLimit), []string{"cat", "cot", "cut", "cute", "cuts"}, "c?t*")
	})

	t.Run("stars anywhere", func(t *testing.T) {
		words := phase2Sample(t)
		assertWords(t, match(t, words, "c*t", wordstore.NoLimit), []string{"cart", "cat", "chart", "coat", "comet", "cot", "cut"}, "c*t")
		assertWords(t, match(t, words, "*at", wordstore.NoLimit), []string{"at", "cat", "coat", "scat"}, "*at")
		assertWords(t, match(t, words, "*a*t*", wordstore.NoLimit), []string{"act", "at", "cactus", "cart", "cat", "chart", "coat", "scat", "tact"}, "*a*t*")
		assertWords(t, match(t, words, "*c*c*", wordstore.NoLimit), []string{"cactus"}, "*c*c*")
	})

	t.Run("whole store and fixed lengths", func(t *testing.T) {
		words := phase2Sample(t)
		everything := slices.Clone(sampleWords)
		slices.Sort(everything)
		assertWords(t, match(t, words, "*", wordstore.NoLimit), everything, "*")
		assertWords(t, match(t, words, "????", wordstore.NoLimit), []string{"cart", "coat", "cute", "cuts", "scat", "tact"}, "????")
		assertWords(t, match(t, words, "?", wordstore.NoLimit), []string{"a"}, "?")
		assertWords(t, match(t, words, "*t?", wordstore.NoLimit), []string{"cute", "cuts"}, "*t?")
	})

	t.Run("no matches", func(t *testing.T) {
		words := phase2Sample(t)
		assertWords(t, match(t, words, "q??", wordstore.NoLimit), nil, "q??")
		assertWords(t, match(t, words, "??????????", wordstore.NoLimit), nil, "??????????")
	})

	t.Run("limit returns the alphabetically first matches", func(t *testing.T) {
		words := phase2Sample(t)
		assertWords(t, match(t, words, "c*", 3), []string{"cactus", "cart", "cat"}, "c* limit 3")
		assertWords(t, match(t, words, "*t", 2), []string{"act", "at"}, "*t limit 2")
		assertWords(t, match(t, words, "c?t", 0), nil, "c?t limit 0")
		assertWords(t, match(t, words, "c?t", 50), []string{"cat", "cot", "cut"}, "c?t limit 50")
	})

	t.Run("negative limit is rejected", func(t *testing.T) {
		_, err := phase2Sample(t).Match("c?t", -1)
		if !errors.Is(err, wordstore.ErrNegativeLimit) {
			t.Fatalf("a negative limit should return ErrNegativeLimit, got %v", err)
		}
	})

	t.Run("patterns are normalised", func(t *testing.T) {
		words := phase2Sample(t)
		want := []string{"cat", "cot", "cut"}
		assertWords(t, match(t, words, "C.T", wordstore.NoLimit), want, "C.T")
		assertWords(t, match(t, words, "c_t", wordstore.NoLimit), want, "c_t")
		parsed, err := wordstore.ParsePattern("C?T")
		if err != nil {
			t.Fatal(err)
		}
		found, err := words.MatchPattern(parsed, wordstore.NoLimit)
		if err != nil {
			t.Fatal(err)
		}
		assertWords(t, found, want, "parsed C?T")
		add(t, words, "Café")
		assertWords(t, match(t, words, "CAF?", wordstore.NoLimit), []string{"cafe"}, "CAF?")
	})

	t.Run("invalid patterns throw", func(t *testing.T) {
		words := phase2Sample(t)
		for _, raw := range []string{"c4t", "", "c+t"} {
			_, err := words.Match(raw, wordstore.NoLimit)
			var invalid *wordstore.PatternError
			if !errors.As(err, &invalid) {
				t.Fatalf("%q is not a pattern; got error %v", raw, err)
			}
		}
	})

	t.Run("results follow additions and removals", func(t *testing.T) {
		words := phase2Sample(t)
		words.Remove("cot")
		add(t, words, "KIT")
		add(t, words, "Cat")
		assertWords(t, match(t, words, "c?t", wordstore.NoLimit), []string{"cat", "cut"}, "c?t")
		assertWords(t, match(t, words, "?it", wordstore.NoLimit), []string{"kit"}, "?it")
	})
}

func TestPhase2BundledLists(t *testing.T) {
	t.Run("solver panel searches", func(t *testing.T) {
		words := bundledStore(t)
		assertWords(t, match(t, words, "b??l", wordstore.NoLimit), []string{"ball", "bell", "boil", "bowl"}, "b??l")
		assertWords(t, match(t, words, "*ball", wordstore.NoLimit),
			[]string{"ball", "baseball", "basketball", "football", "netball", "tball", "volleyball"}, "*ball")
		assertWords(t, match(t, words, "*ing", wordstore.NoLimit),
			[]string{"bowling", "boxing", "curling", "cycling", "diving", "fencing", "king", "rowing", "wing"}, "*ing")
		assertWords(t, match(t, words, "c*e", 6), []string{"cafe", "cake", "candle", "canoe", "castle", "cave"}, "c*e")
	})

	t.Run("five letter slot", func(t *testing.T) {
		found := match(t, bundledStore(t), "??a??", wordstore.NoLimit)
		assertEqual(t, len(found), 28, "number of matches")
		assertWords(t, found[:4], []string{"alarm", "beach", "blade", "brain"}, "first four")
		assertWords(t, found[len(found)-3:], []string{"toast", "train", "whale"}, "last three")
	})
}
