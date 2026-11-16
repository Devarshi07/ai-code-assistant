package tests

import (
	"testing"
	"time"

	"debuggym/maze-solver/maze"
)

// These tests also use parseLevel (phase1_test.go), assertValidRun and
// movesOf (phase2_test.go), and generate (generator_test.go).

const vault = `
###############
#S..#...$...>.#
#.#.#.#####.#.#
#.#$..#...#.#.#
#.#####.#.#.#.#
#...$...#..$#E#
#####v#######.#
#.....$.......#
###############
`

func TestPhase3VaultWithGatesAndFiveGems(t *testing.T) {
	level := parseLevel(t, "vault", vault)
	run := maze.CollectAllGems(level)
	if run == nil || run.Moves != 42 {
		t.Fatalf("got %s, want 42 moves", movesOf(run))
	}
	assertValidRun(t, level, run)
}

func TestPhase3GeneratedLevelWithEightGems(t *testing.T) {
	level := parseLevel(t, "generated", generate(21, 31, 8))
	run := maze.CollectAllGems(level)
	if run == nil || run.Moves != 121 {
		t.Fatalf("got %s, want 121 moves", movesOf(run))
	}
	assertValidRun(t, level, run)
}

func TestPhase3ElevenGemsOnALargeLevelIsFast(t *testing.T) {
	level := parseLevel(t, "generated", generate(7, 61, 11))
	start := time.Now()
	run := maze.CollectAllGems(level)
	elapsed := time.Since(start)
	if run == nil {
		t.Fatal("CollectAllGems returned nil; the generated level has a run")
	}
	if run.Moves != 450 {
		t.Fatalf("moves = %d, want 450", run.Moves)
	}
	assertValidRun(t, level, run)
	if limit := 200 * time.Millisecond; elapsed >= limit {
		t.Fatalf("took %dms; an 11-gem level must solve in under %dms", elapsed.Milliseconds(), limit.Milliseconds())
	}
}
