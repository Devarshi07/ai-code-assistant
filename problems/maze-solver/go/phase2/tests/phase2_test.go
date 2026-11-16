package tests

import (
	"fmt"
	"testing"

	"debuggym/maze-solver/maze"
)

// Nearest-gem-first walks left, then all the way right, then back: 22 moves.
// Going right first is shorter.
const corridor = `
#############
#E$..S.....$#
#############
`

// The gem is only reachable through the eastbound gate, and the only way back
// to the exit is the long loop through the westbound gate.
const oneWayLoop = `
#########
#S.>.$..#
#.#####.#
#E..<...#
#########
`

const sealedGem = `
#######
#S..E.#
#####.#
#$#...#
#######
`

const sealedExit = `
#######
#S.$#E#
#######
`

// assertValidRun checks that a run starts at S, ends at E, takes legal steps
// and visits every gem.
func assertValidRun(t *testing.T, level *maze.Level, run *maze.Run) {
	t.Helper()
	path := run.Path
	if run.Moves != len(path)-1 {
		t.Fatalf("moves = %d for a path of %d tiles; moves must equal len(path) - 1", run.Moves, len(path))
	}
	if len(path) == 0 || path[0] != level.Start {
		t.Fatalf("run must begin on the start tile %v", level.Start)
	}
	if path[len(path)-1] != level.Exit {
		t.Fatalf("run must end on the exit tile %v", level.Exit)
	}
	assertRoute(t, level, path)
	visited := map[maze.Position]bool{}
	for _, pos := range path {
		visited[pos] = true
	}
	for _, gem := range level.Gems {
		if !visited[gem] {
			t.Fatalf("gem at %v was never collected", gem)
		}
	}
}

// movesOf describes a run's length for failure messages.
func movesOf(run *maze.Run) string {
	if run == nil {
		return "no run"
	}
	return fmt.Sprintf("%d moves", run.Moves)
}

func TestPhase2LevelWithoutGemsMatchesPlainSolve(t *testing.T) {
	level := parseLevel(t, "tutorial", maze.Tutorial)
	run := maze.CollectAllGems(level)
	if run == nil {
		t.Fatal("CollectAllGems returned nil; the tutorial level has a route")
	}
	if want := maze.Solve(level).Moves; run.Moves != want {
		t.Fatalf("moves = %d, want %d, the same as Solve", run.Moves, want)
	}
	assertValidRun(t, level, run)
}

func TestPhase2SingleGemDetour(t *testing.T) {
	level := parseLevel(t, "tower", maze.Tower)
	run := maze.CollectAllGems(level)
	if run == nil || run.Moves != 13 {
		t.Fatalf("got %s, want 13 moves", movesOf(run))
	}
	assertValidRun(t, level, run)
}

func TestPhase2OrderMatters(t *testing.T) {
	level := parseLevel(t, "corridor", corridor)
	run := maze.CollectAllGems(level)
	if run == nil || run.Moves != 16 {
		t.Fatalf("got %s, want 16 moves: collect the far gem first", movesOf(run))
	}
	assertValidRun(t, level, run)
}

func TestPhase2LegsAreDirectional(t *testing.T) {
	level := parseLevel(t, "one-way loop", oneWayLoop)
	run := maze.CollectAllGems(level)
	if run == nil {
		t.Fatal("CollectAllGems returned nil; the one-way loop has a run")
	}
	if run.Moves != 14 {
		t.Fatalf("moves = %d, want 14", run.Moves)
	}
	assertValidRun(t, level, run)
}

func TestPhase2TreasuryThreeGems(t *testing.T) {
	level := parseLevel(t, "treasury", maze.Treasury)
	run := maze.CollectAllGems(level)
	if run == nil || run.Moves != 28 {
		t.Fatalf("got %s, want 28 moves", movesOf(run))
	}
	assertValidRun(t, level, run)
}

func TestPhase2UnreachableGemMeansNoRun(t *testing.T) {
	if run := maze.CollectAllGems(parseLevel(t, "sealed gem", sealedGem)); run != nil {
		t.Fatalf("got %s, want nil: one gem is walled off", movesOf(run))
	}
}

func TestPhase2UnreachableExitMeansNoRun(t *testing.T) {
	if run := maze.CollectAllGems(parseLevel(t, "sealed exit", sealedExit)); run != nil {
		t.Fatalf("got %s, want nil: the exit is walled off", movesOf(run))
	}
}
