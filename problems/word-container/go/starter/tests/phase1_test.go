package tests

import (
	"errors"
	"reflect"
	"slices"
	"testing"

	"debuggym/word-container/wordstore"
)

// The helpers in this file are shared by every test file in the package.

// dataDir is where the bundled lists live; go test runs inside tests/.
const dataDir = "../data"

// Every bundled list, normalised and de-duplicated, holds this many words.
const bundledTotal = 447

var bundledFirstLetters = map[string]int{
	"a": 27, "b": 48, "c": 50, "d": 18, "e": 9, "f": 23, "g": 20, "h": 14, "i": 6,
	"j": 14, "k": 10, "l": 15, "m": 18, "n": 10, "o": 9, "p": 31, "q": 3, "r": 24,
	"s": 45, "t": 21, "u": 4, "v": 6, "w": 15, "y": 4, "z": 3,
}

// assertEqual stops the test when got and want differ.
func assertEqual(t *testing.T, got, want any, what string) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s: got %v, want %v", what, got, want)
	}
}

// assertWords stops the test when two word lists differ (nil and empty are the same list).
func assertWords(t *testing.T, got, want []string, what string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Fatalf("%s: got %v, want %v", what, got, want)
	}
}

// storeOf builds a container holding words.
func storeOf(t *testing.T, words ...string) *wordstore.WordContainer {
	t.Helper()
	store := wordstore.New()
	if _, err := store.AddAll(words); err != nil {
		t.Fatalf("AddAll(%v): %v", words, err)
	}
	return store
}

func sample(t *testing.T) *wordstore.WordContainer {
	t.Helper()
	return storeOf(t, "cat", "cart", "cot")
}

func bundledStore(t *testing.T) *wordstore.WordContainer {
	t.Helper()
	store := wordstore.New()
	if _, err := wordstore.LoadBundled(store, dataDir); err != nil {
		t.Fatalf("LoadBundled: %v", err)
	}
	return store
}

// add stores one entry that must be valid and returns whether it was new.
func add(t *testing.T, store *wordstore.WordContainer, word string) bool {
	t.Helper()
	isNew, err := store.Add(word)
	if err != nil {
		t.Fatalf("Add(%q): %v", word, err)
	}
	return isNew
}

func count(t *testing.T, store *wordstore.WordContainer, prefix string) int {
	t.Helper()
	total, err := store.Count(prefix)
	if err != nil {
		t.Fatalf("Count(%q): %v", prefix, err)
	}
	return total
}

func withPrefix(t *testing.T, store *wordstore.WordContainer, prefix string) []string {
	t.Helper()
	words, err := store.WithPrefix(prefix)
	if err != nil {
		t.Fatalf("WithPrefix(%q): %v", prefix, err)
	}
	return words
}

func normalize(t *testing.T, raw string) string {
	t.Helper()
	key, err := wordstore.NormalizeWord(raw)
	if err != nil {
		t.Fatalf("NormalizeWord(%q): %v", raw, err)
	}
	return key
}

func TestPhase1NormalizeWord(t *testing.T) {
	t.Run("lowercases and strips accents", func(t *testing.T) {
		assertEqual(t, normalize(t, "Café"), "cafe", "Café")
		assertEqual(t, normalize(t, "  NAÏVE "), "naive", "NAÏVE")
		assertEqual(t, normalize(t, "Jalapeño"), "jalapeno", "Jalapeño")
	})

	t.Run("drops spaces, hyphens and apostrophes", func(t *testing.T) {
		assertEqual(t, normalize(t, "ice cream"), "icecream", "ice cream")
		assertEqual(t, normalize(t, "Jiu-Jitsu"), "jiujitsu", "Jiu-Jitsu")
		assertEqual(t, normalize(t, "o'clock"), "oclock", "o'clock")
		assertEqual(t, normalize(t, "rock ’n’ roll"), "rocknroll", "rock ’n’ roll")
	})

	t.Run("rejects entries that are not words", func(t *testing.T) {
		for _, raw := range []string{"r2d2", "24/7", "c++", "", "   ", "-"} {
			_, err := wordstore.NormalizeWord(raw)
			var invalid *wordstore.InvalidWord
			if !errors.As(err, &invalid) {
				t.Fatalf("%q should be rejected with an InvalidWord error, got %v", raw, err)
			}
		}
	})
}

func TestPhase1WordContainer(t *testing.T) {
	t.Run("add reports new and repeated words", func(t *testing.T) {
		words := sample(t)
		assertEqual(t, add(t, words, "coat"), true, "add coat")
		assertEqual(t, add(t, words, "Cat"), false, "add Cat")
		assertEqual(t, words.Size(), 4, "size")
	})

	t.Run("lookups ignore case and accents", func(t *testing.T) {
		words := sample(t)
		if !words.Has("CAT") {
			t.Fatal("Has(CAT) should be true")
		}
		add(t, words, "Café")
		if !words.Has("cafe") || !words.Has(" CAFÉ ") {
			t.Fatal("Has should ignore case, accents and padding")
		}
		if words.Has("r2d2") {
			t.Fatal("Has(r2d2) should be false")
		}
	})

	t.Run("a prefix is not a word", func(t *testing.T) {
		words := sample(t)
		for _, prefix := range []string{"car", "ca", "carts"} {
			if words.Has(prefix) {
				t.Fatalf("Has(%q) should be false", prefix)
			}
		}
	})

	t.Run("iterates in alphabetical order", func(t *testing.T) {
		words := sample(t)
		if _, err := words.AddAll([]string{"act", "cut", "a", "coat"}); err != nil {
			t.Fatal(err)
		}
		assertWords(t, words.Words(), []string{"a", "act", "cart", "cat", "coat", "cot", "cut"}, "Words")
	})

	t.Run("withPrefix lists completions", func(t *testing.T) {
		words := sample(t)
		assertWords(t, withPrefix(t, words, "CA"), []string{"cart", "cat"}, "CA")
		assertWords(t, withPrefix(t, words, "dog"), nil, "dog")
	})

	t.Run("count by prefix", func(t *testing.T) {
		words := sample(t)
		assertEqual(t, count(t, words, "ca"), 2, "ca")
		assertEqual(t, count(t, words, "cot"), 1, "cot")
		assertEqual(t, count(t, words, "x"), 0, "x")
		assertEqual(t, count(t, words, ""), 3, "every word")
	})

	t.Run("remove forgets the word", func(t *testing.T) {
		words := sample(t)
		assertEqual(t, words.Remove("cart"), true, "remove cart")
		assertEqual(t, words.Has("cart"), false, "has cart")
		assertEqual(t, words.Remove("cart"), false, "remove cart again")
		assertEqual(t, count(t, words, "car"), 0, "count car")
		assertWords(t, words.Words(), []string{"cat", "cot"}, "Words")
	})

	t.Run("re-adding a word leaves counts alone", func(t *testing.T) {
		words := sample(t)
		add(t, words, "Cat")
		add(t, words, "cat ")
		assertEqual(t, words.Size(), 3, "size")
		assertEqual(t, count(t, words, ""), 3, "Count must agree with Size")
		assertEqual(t, count(t, words, "ca"), 2, "only cat and cart start with 'ca'")
	})

	t.Run("retiring a word that was imported twice", func(t *testing.T) {
		words := sample(t)
		add(t, words, "squash")
		add(t, words, "Squash")
		assertEqual(t, words.Remove("squash"), true, "remove squash")
		assertEqual(t, words.Has("squash"), false, "has squash")
		assertWords(t, withPrefix(t, words, "squ"), nil, "squ completions")
		assertEqual(t, count(t, words, "squ"), 0, "no stored word starts with 'squ' any more")
	})
}

func TestPhase1Loader(t *testing.T) {
	t.Run("loadText reports duplicates and rejects", func(t *testing.T) {
		words := wordstore.New()
		report := wordstore.LoadText(words, "# fruit\napple\nApple\n\n24/7\nbanana;40\n  pear  \n", "fruit.txt")
		assertEqual(t, []int{report.Added, report.Duplicates}, []int{3, 1}, "added and duplicates")
		assertEqual(t, len(report.Rejected), 1, "rejected entries")
		assertEqual(t, report.Rejected[0].Line, 5, "rejected line")
		assertEqual(t, report.Rejected[0].Entry, "24/7", "rejected entry")
		assertWords(t, words.Words(), []string{"apple", "banana", "pear"}, "Words")
	})

	t.Run("bundled lists import summary", func(t *testing.T) {
		words := wordstore.New()
		reports, err := wordstore.LoadBundled(words, dataDir)
		if err != nil {
			t.Fatal(err)
		}
		got := [][]int{}
		for _, r := range reports {
			got = append(got, []int{r.Added, r.Duplicates, len(r.Rejected)})
		}
		assertEqual(t, got, [][]int{{339, 1, 2}, {67, 10, 0}, {41, 18, 0}}, "import summaries")
		assertEqual(t, words.Size(), bundledTotal, "size")
	})

	t.Run("letter breakdown adds up to the total", func(t *testing.T) {
		words := bundledStore(t)
		breakdown := map[string]int{}
		sum := 0
		for _, row := range wordstore.LetterBreakdown(words) {
			breakdown[row.Letter] = row.Total
			sum += row.Total
		}
		assertEqual(t, sum, words.Size(), "the A-Z rows must add up to the headline total")
		assertEqual(t, breakdown, bundledFirstLetters, "first-letter breakdown")
	})

	t.Run("prefix badges match the listed completions", func(t *testing.T) {
		words := bundledStore(t)
		for _, prefix := range []string{"bowl", "squ", "ba", "ca", "s"} {
			assertEqual(t, count(t, words, prefix), len(withPrefix(t, words, prefix)), "badge for '"+prefix+"'")
		}
	})
}
