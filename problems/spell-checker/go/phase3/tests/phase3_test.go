package tests

import (
	"slices"
	"sync"
	"testing"
	"time"

	"debuggym/spell-checker/spellcheck"
)

// largeDictionary and typoBatch are in corpus.go; expectSuggestions is in
// phase2_test.go.

const (
	fullSize   = 20_000                 // entries in the full dictionary
	batchSize  = 1_000                  // right-click lookups in the timed test
	batchLimit = 500 * time.Millisecond // allowed for the whole batch
)

var (
	largeOnce      sync.Once
	largeWords     *spellcheck.Dictionary
	largeSuggester *spellcheck.Suggester
	largeErr       error
)

// large returns the large dictionary and one Suggester over it, built once
// per run.
func large(t *testing.T) (*spellcheck.Dictionary, *spellcheck.Suggester) {
	t.Helper()
	largeOnce.Do(func() {
		largeWords, largeErr = largeDictionary(fullSize, 1)
		if largeErr == nil {
			largeSuggester = spellcheck.NewSuggester(largeWords)
			largeSuggester.Suggest("warm", spellcheck.DefaultLimit) // let lazy indexes finish building
		}
	})
	if largeErr != nil {
		t.Fatalf("building the large dictionary: %v", largeErr)
	}
	return largeWords, largeSuggester
}

func TestPhase3DictionarySize(t *testing.T) {
	if words, _ := large(t); words.Len() != fullSize {
		t.Errorf("large dictionary has %d entries, want %d", words.Len(), fullSize)
	}
}

func TestPhase3TyposOfRealWords(t *testing.T) {
	_, suggester := large(t)
	expectSuggestions(t, suggester, "recieve", spellcheck.DefaultLimit, "relieve", "receive", "believe")
	expectSuggestions(t, suggester, "teh", 8, "tea", "tel", "te", "ted", "tee", "tech", "ten", "the")
	expectSuggestions(t, suggester, "unfortunatelly", spellcheck.DefaultLimit, "unfortunately")
}

func TestPhase3ApostrophesAndAccents(t *testing.T) {
	_, suggester := large(t)
	expectSuggestions(t, suggester, "dont", 7, "don't", "done", "don", "dout", "dond", "dong", "dot")
	expectSuggestions(t, suggester, "cafe", 6, "came", "pafe", "ceafe", "cale", "eafe", "café")
}

func TestPhase3VeryShortWords(t *testing.T) {
	_, suggester := large(t)
	expectSuggestions(t, suggester, "e", 12, "e", "be", "a", "i", "he", "we", "me", "pe", "em", "je", "fe", "ne")
	expectSuggestions(t, suggester, "ab", 12, "a", "as", "at", "an", "ad", "ar", "am", "al", "ai", "be", "to", "of")
}

func TestPhase3GeneratedWords(t *testing.T) {
	_, suggester := large(t)
	expectSuggestions(t, suggester, "siling", 12, "siling", "kiling", "miling", "riling", "tiling", "iling",
		"liling", "niling", "saling", "griling", "soing", "sudiling")
	expectSuggestions(t, suggester, "leck", 12, "leck", "neck", "weck", "lecks", "deck", "peck", "beck",
		"leeck", "cleck", "jeck", "seck", "fleck")
	expectSuggestions(t, suggester, "thnd", 12, "tond", "thad", "thand", "tand", "tynd", "thond", "thind",
		"thed", "tind", "the", "and", "that")
	expectSuggestions(t, suggester, "tad", 12, "tad", "had", "bad", "lad", "thad", "zad", "ad", "tas",
		"tand", "dad", "tat", "tal")
}

func TestPhase3LongAndUnmatchedWords(t *testing.T) {
	_, suggester := large(t)
	expectSuggestions(t, suggester, "plumtobued", spellcheck.DefaultLimit, "plumtobued")
	expectSuggestions(t, suggester, "xqzvbnm", spellcheck.DefaultLimit)
}

func TestPhase3BatchOfLookupsIsFast(t *testing.T) {
	words, suggester := large(t)
	batch := typoBatch(words, batchSize, 7)
	var results [][]string
	start := time.Now()
	for _, word := range batch {
		results = append(results, suggester.Suggest(word, spellcheck.DefaultLimit))
		if time.Since(start) > 3*batchLimit {
			break // far too slow already; stop early
		}
	}
	elapsed := time.Since(start)
	if len(results) != batchSize {
		t.Fatalf("only %d of %d lookups finished in %v; all %d must finish in under %v",
			len(results), batchSize, elapsed.Round(time.Millisecond), batchSize, batchLimit)
	}
	for _, c := range []struct {
		index int
		want  []string
	}{
		{0, []string{"view", "voai", "vis", "vist", "viga"}},
		{2, []string{"zond", "foud", "zou", "loud", "noud"}},
		{49, nil},
		{500, []string{"valing", "vanding", "tanging", "vatreing", "nanging"}},
		{999, []string{"lon", "lose", "lost", "los", "on"}},
	} {
		if got := results[c.index]; !slices.Equal(got, c.want) {
			t.Errorf("lookup %d (%q)\n got %q\nwant %q", c.index, batch[c.index], got, c.want)
		}
	}
	total := 0
	for _, r := range results {
		total += len(r)
	}
	if total != 2306 {
		t.Errorf("total suggestions across the batch = %d, want 2306", total)
	}
	if elapsed >= batchLimit {
		t.Errorf("%d lookups took %v; they must finish in under %v", batchSize, elapsed.Round(time.Millisecond), batchLimit)
	}
}
