package tests

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"debuggym/word-container/wordstore"
)

// The whole grid-fill batch (500 queries on a 130k-word dictionary) must finish in this time.
const batchBudget = 250 * time.Millisecond

// Awkward shapes: leading stars, several stars, stars between blanks.
var tricky = []string{"*ing", "*a*a*", "?*?*?", "*oo*", "b*b", "*x", "???*???", "*e?e*", "s*s*s", "?"}

// bruteForce is an independent check: the pattern as a regular expression, tried on every word.
func bruteForce(words []string, pattern string, limit int) []string {
	text := strings.ReplaceAll(strings.ReplaceAll(pattern, "?", "[a-z]"), "*", "[a-z]*")
	regex := regexp.MustCompile("^" + text + "$")
	found := []string{}
	for _, word := range words {
		if regex.MatchString(word) {
			found = append(found, word)
			if len(found) == limit {
				break
			}
		}
	}
	return found
}

// summary is the number of matches plus the first and last three.
func summary(found []string) string {
	first := found[:min(3, len(found))]
	last := found[max(0, len(found)-3):]
	return fmt.Sprintf("%d %v %v", len(found), first, last)
}

func newStore(t *testing.T, words []string) *wordstore.WordContainer {
	t.Helper()
	return storeOf(t, words...)
}

var (
	mediumOnce  sync.Once
	mediumWords *wordstore.WordContainer
	mediumList  []string
)

func medium(t *testing.T) (*wordstore.WordContainer, []string) {
	t.Helper()
	mediumOnce.Do(func() {
		mediumWords = newStore(t, generateWords(11, 20000))
		mediumList = mediumWords.Words()
	})
	return mediumWords, mediumList
}

func TestPhase3MediumDictionary(t *testing.T) {
	t.Run("dictionary size", func(t *testing.T) {
		words, _ := medium(t)
		assertEqual(t, words.Size(), 19084, "size")
	})

	t.Run("known answers", func(t *testing.T) {
		words, _ := medium(t)
		assertWords(t, match(t, words, "br??k*", wordstore.NoLimit), []string{
			"brack", "brarkeetroun", "brecksilbrats", "breekour", "briekoal",
			"briekoulls", "briekout", "brookoonts", "broxkais", "brudkaiing"}, "br??k*")
		assertWords(t, match(t, words, "s?a?e", wordstore.NoLimit), []string{"seaze", "slabe"}, "s?a?e")
		assertWords(t, match(t, words, "*ooo*", wordstore.NoLimit), []string{"boooodthoob", "liebroooop", "nooostciex", "yoooy"}, "*ooo*")
		assertWords(t, match(t, words, "?*z", wordstore.NoLimit), nil, "?*z")
		assertWords(t, match(t, words, "q*", wordstore.NoLimit), nil, "q*")
	})

	t.Run("broad patterns", func(t *testing.T) {
		words, listed := medium(t)
		cases := []struct {
			pattern string
			want    string
		}{
			{"?oo?", "72 [boog bool boom] [zoop zoos zoot]"},
			{"*ing", "1153 [ailling airing aisleating] [zydnaing zyllthiexing zyting]"},
			{"??????", "1833 [aibtai aichee ailler] [zynpie zyting zytwos]"},
			{"*a*e*i*", "218 [aisleating aitmeaing aitveeting] [zasitweasing zauntslenwai zeaketmid]"},
			{"??????????????????*", "13 [braindstougjending braingshaunclecking deantchoondclinter] [speentploolconging stierfloackbriered stoungspeantpleast]"},
		}
		for _, c := range cases {
			assertEqual(t, summary(match(t, words, c.pattern, wordstore.NoLimit)), c.want, "pattern "+c.pattern)
		}
		assertWords(t, match(t, words, "*", wordstore.NoLimit), listed, "*")
	})

	t.Run("limits", func(t *testing.T) {
		words, _ := medium(t)
		assertWords(t, match(t, words, "s*", 5), []string{"sa", "sab", "sabbat", "sabot", "sabraclour"}, "s* limit 5")
		assertWords(t, match(t, words, "*ing", 4), []string{"ailling", "airing", "aisleating", "aitmeaing"}, "*ing limit 4")
		assertWords(t, match(t, words, "?e?e*", 6), []string{"bedeadbrall", "beeed", "beeeed", "behextecker", "bekeed", "bereater"}, "?e?e* limit 6")
	})

	t.Run("generated queries agree with brute force", func(t *testing.T) {
		words, listed := medium(t)
		patterns := slices.Concat(slotPatterns(listed, 5, 30, 40), searchPatterns(listed, 6, 20), tricky)
		for _, pattern := range patterns {
			assertWords(t, match(t, words, pattern, wordstore.NoLimit), bruteForce(listed, pattern, wordstore.NoLimit), "pattern "+pattern)
		}
		for _, pattern := range tricky {
			assertWords(t, match(t, words, pattern, 7), bruteForce(listed, pattern, 7), "pattern "+pattern+", limit 7")
		}
	})
}

func TestPhase3Mutation(t *testing.T) {
	t.Run("results track additions and removals", func(t *testing.T) {
		words := newStore(t, generateWords(3, 6000))
		listed := words.Words()
		queries := slices.Concat(slotPatterns(listed, 8, 15, 40), searchPatterns(listed, 9, 10), tricky, []string{"*", "????????????*"})
		for _, pattern := range queries {
			match(t, words, pattern, wordstore.NoLimit) // warm up anything an implementation caches
		}
		gone := map[string]bool{}
		for i, word := range listed {
			if i%3 == 0 || len(word) > 11 {
				gone[word] = true
				if !words.Remove(word) {
					t.Fatalf("remove %s: not stored", word)
				}
			}
		}
		newcomers := generateWords(4, 3000)
		if _, err := words.AddAll(newcomers); err != nil {
			t.Fatal(err)
		}
		keep := map[string]bool{}
		for _, word := range listed {
			if !gone[word] {
				keep[word] = true
			}
		}
		for _, word := range newcomers {
			keep[word] = true
		}
		current := make([]string, 0, len(keep))
		for word := range keep {
			current = append(current, word)
		}
		slices.Sort(current)
		assertWords(t, words.Words(), current, "words after changes")
		for _, pattern := range queries {
			assertWords(t, match(t, words, pattern, wordstore.NoLimit), bruteForce(current, pattern, wordstore.NoLimit), "pattern "+pattern)
		}
		assertWords(t, match(t, words, "*ing", 5), bruteForce(current, "*ing", 5), "*ing limit 5")
	})
}

type query struct {
	pattern string
	limit   int
}

var (
	scaleOnce  sync.Once
	scaleWords *wordstore.WordContainer
	scaleBatch []query
)

func scale(t *testing.T) (*wordstore.WordContainer, []query) {
	t.Helper()
	scaleOnce.Do(func() {
		scaleWords = newStore(t, generateWords(2024, 150000))
		listed := scaleWords.Words()
		// A grid-fill pass: slots with crossing letters known, plus solver-panel searches.
		for _, pattern := range slotPatterns(listed, 77, 400, 40) {
			scaleBatch = append(scaleBatch, query{pattern, wordstore.NoLimit})
		}
		for _, pattern := range searchPatterns(listed, 78, 100) {
			scaleBatch = append(scaleBatch, query{pattern, 20})
		}
	})
	return scaleWords, scaleBatch
}

func TestPhase3Scale(t *testing.T) {
	t.Run("large dictionary spot checks", func(t *testing.T) {
		words, _ := scale(t)
		assertEqual(t, words.Size(), 130128, "size")
		assertWords(t, match(t, words, "th??n", wordstore.NoLimit), []string{"thaun", "thean", "theen", "thien", "thoan", "thoon"}, "th??n")
		found := match(t, words, "b?ea?", wordstore.NoLimit)
		assertEqual(t, len(found), 13, "number of b?ea? matches")
		assertWords(t, found[:4], []string{"beeai", "biead", "bieai", "bieas"}, "b?ea? first four")
		assertWords(t, found[len(found)-2:], []string{"breat", "breay"}, "b?ea? last two")
		assertWords(t, match(t, words, "dr?n*", 4), []string{"dran", "dranaas", "dranboobougy", "drancested"}, "dr?n* limit 4")
	})

	t.Run("grid-fill batch is fast", func(t *testing.T) {
		words, batch := scale(t)
		found, letters := 0, 0
		start := time.Now()
		for done, q := range batch {
			result, err := words.Match(q.pattern, q.limit)
			if err != nil {
				t.Fatalf("Match(%q): %v", q.pattern, err)
			}
			found += len(result)
			for _, word := range result {
				letters += len(word)
			}
			if elapsed := time.Since(start); elapsed > batchBudget {
				t.Fatalf("only %d of %d queries finished in %dms; the whole batch must finish in under %dms",
					done+1, len(batch), elapsed.Milliseconds(), batchBudget.Milliseconds())
			}
		}
		assertEqual(t, []int{found, letters}, []int{5766, 41753}, "batch returned the wrong words")
	})
}
