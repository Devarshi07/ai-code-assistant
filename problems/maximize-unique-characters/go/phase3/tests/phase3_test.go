package tests

import (
	"slices"
	"testing"
	"time"

	"debuggym/maximize-unique-characters/oneofeach"
)

func checkPack(t *testing.T, pack []string, words []string, total int) {
	t.Helper()
	check(t, mustWords(t, pack...), words, total, "pack")
}

func timed(t *testing.T, pack []string, words []string, total int, limit time.Duration) {
	t.Helper()
	candidates := mustWords(t, pack...)
	start := time.Now()
	result := oneofeach.BestSelection(candidates)
	elapsed := time.Since(start)
	assertValidSelection(t, candidates, result)
	assertEqual(t, result.Total, total, "total")
	if !slices.Equal(result.Words, words) {
		t.Fatalf("words: got %v, want %v", result.Words, words)
	}
	if elapsed >= limit {
		t.Fatalf("took %dms; a %d-word pack must solve in under %dms", elapsed.Milliseconds(), len(pack), limit.Milliseconds())
	}
}

func TestPhase3Scale(t *testing.T) {
	t.Run("anagram spellings keep the alphabetical tie-break", func(t *testing.T) {
		candidates := []string{"stop", "pots", "tops", "opts", "spot", "post", "Chew", "chew", "cheww", "pod", "tan", "and", "top"}
		checkPack(t, candidates, []string{"and", "chew", "opts"}, 11)
	})

	t.Run("small short-word pack", func(t *testing.T) {
		// 16 boards tie on 20 letters.
		checkPack(t, shortWordPack(5, 70), []string{"dqat", "ek", "fpsn", "hy", "ir", "jm", "zwlo"}, 20)
	})

	t.Run("medium short-word pack", func(t *testing.T) {
		// 52 boards over five different letter sets tie on 21 letters.
		checkPack(t, shortWordPack(21, 120), []string{"cq", "eb", "gn", "iay", "mh", "oz", "srx", "tdw", "vu"}, 21)
	})

	t.Run("small long-word pack", func(t *testing.T) {
		// 512 spellings of the same board tie on 20 letters.
		checkPack(t, longWordPack(6, 150), []string{"azlhmby", "cgoq", "iwju", "svdrt"}, 20)
	})

	t.Run("medium long-word pack", func(t *testing.T) {
		checkPack(t, longWordPack(8, 250), []string{"abktj", "cxuonyz", "dwep", "hvqlmr"}, 22)
	})

	t.Run("large short-word pack is fast", func(t *testing.T) {
		timed(t, shortWordPack(11, 240), []string{"ai", "bw", "cv", "ez", "fo", "kut", "lh", "pqs", "rm", "xgd", "yn"}, 25, 100*time.Millisecond)
	})

	t.Run("large long-word pack is fast", func(t *testing.T) {
		timed(t, longWordPack(13, 1000), []string{"abyqjn", "csme", "dxkw", "futp", "liozghv"}, 25, 100*time.Millisecond)
	})
}
