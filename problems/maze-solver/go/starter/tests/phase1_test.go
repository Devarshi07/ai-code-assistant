package tests

import (
	"errors"
	"testing"

	"debuggym/maze-solver/maze"
)

const gatedSquare = `
#######
#S..>E#
#.###.#
#.....#
#.###.#
#.....#
#######
`

const walledOff = `
#####
#S#E#
#.#.#
#.#.#
#####
`

// gateDeltas is the only step, as (row delta, col delta), that may enter or
// leave each gate.
var gateDeltas = map[byte][2]int{'>': {0, 1}, '<': {0, -1}, '^': {-1, 0}, 'v': {1, 0}}

// parseLevel reads a level layout and stops the test if it is rejected.
func parseLevel(t *testing.T, name, text string) *maze.Level {
	t.Helper()
	level, err := maze.Parse(name, text)
	if err != nil {
		t.Fatalf("parse %s: %v", name, err)
	}
	return level
}

// assertRoute checks that every step stays on the map, avoids walls and
// respects gates.
func assertRoute(t *testing.T, level *maze.Level, path []maze.Position) {
	t.Helper()
	for i := 1; i < len(path); i++ {
		a, b := path[i-1], path[i]
		delta := [2]int{b.Row - a.Row, b.Col - a.Col}
		if abs(delta[0])+abs(delta[1]) != 1 {
			t.Fatalf("%v -> %v is not a single step", a, b)
		}
		if b.Row < 0 || b.Row >= level.Height || b.Col < 0 || b.Col >= level.Width {
			t.Fatalf("%v is off the map", b)
		}
		here, there := level.Rows[a.Row][a.Col], level.Rows[b.Row][b.Col]
		if there == '#' {
			t.Fatalf("%v is a wall", b)
		}
		if want, ok := gateDeltas[here]; ok && delta != want {
			t.Fatalf("left gate %c at %v the wrong way", here, a)
		}
		if want, ok := gateDeltas[there]; ok && delta != want {
			t.Fatalf("entered gate %c at %v the wrong way", there, b)
		}
	}
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}

func TestPhase1ParseReadsDimensionsAndMarkers(t *testing.T) {
	level := parseLevel(t, "tutorial", maze.Tutorial)
	if level.Width != 9 || level.Height != 5 {
		t.Fatalf("size = %dx%d, want 9x5", level.Width, level.Height)
	}
	if want := (maze.Position{Row: 1, Col: 1}); level.Start != want {
		t.Fatalf("start = %v, want %v", level.Start, want)
	}
	if want := (maze.Position{Row: 3, Col: 7}); level.Exit != want {
		t.Fatalf("exit = %v, want %v", level.Exit, want)
	}
}

func TestPhase1RaggedRowsAreRejected(t *testing.T) {
	_, err := maze.Parse("ragged", "#####\n#S.E#\n###")
	var levelErr *maze.LevelError
	if !errors.As(err, &levelErr) {
		t.Fatalf("Parse returned %v, want a *maze.LevelError", err)
	}
}

func TestPhase1ExactlyOneStartRequired(t *testing.T) {
	_, err := maze.Parse("two starts", "######\n#SS.E#\n######")
	var levelErr *maze.LevelError
	if !errors.As(err, &levelErr) {
		t.Fatalf("Parse returned %v, want a *maze.LevelError", err)
	}
}

func TestPhase1SquareLevelShortestRoute(t *testing.T) {
	run := maze.Solve(parseLevel(t, "gated square", gatedSquare))
	if run == nil {
		t.Fatal("Solve returned nil; the gated square has a route")
	}
	if run.Moves != 4 {
		t.Fatalf("moves = %d, want 4", run.Moves)
	}
	if got := maze.ToMoves(run.Path); got != "EEEE" {
		t.Fatalf("route = %q, want %q", got, "EEEE")
	}
}

func TestPhase1GatesOnlyOpenOneWay(t *testing.T) {
	level := parseLevel(t, "gated square", gatedSquare)
	back := maze.ShortestPath(level, level.Exit, level.Start)
	if back == nil {
		t.Fatal("ShortestPath returned nil; the way back goes around the gate")
	}
	if len(back)-1 != 8 {
		t.Fatalf("the way back took %d moves, want 8: it must go around the gate", len(back)-1)
	}
	assertRoute(t, level, back)
}

func TestPhase1UnreachableExitReturnsNil(t *testing.T) {
	if run := maze.Solve(parseLevel(t, "walled off", walledOff)); run != nil {
		t.Fatalf("Solve returned a run of %d moves, want nil", run.Moves)
	}
}

func TestPhase1WideLevelIsSolvable(t *testing.T) {
	level := parseLevel(t, "tutorial", maze.Tutorial)
	run := maze.Solve(level)
	if run == nil {
		t.Fatal("Solve returned nil; the tutorial level has a route to the exit")
	}
	if run.Moves != 12 {
		t.Fatalf("moves = %d, want 12", run.Moves)
	}
	assertRoute(t, level, run.Path)
}

func TestPhase1WideCanyonRoute(t *testing.T) {
	level := parseLevel(t, "canyon", maze.Canyon)
	run := maze.Solve(level)
	if run == nil {
		t.Fatal("Solve returned nil; the canyon level has a route to the exit")
	}
	if run.Moves != 20 {
		t.Fatalf("moves = %d, want 20", run.Moves)
	}
	assertRoute(t, level, run.Path)
}

// This test runs last: a panic stops the rest of go test, and the spire level
// is the one reported to crash.
func TestPhase1TallLevelStaysOnTheMap(t *testing.T) {
	level := parseLevel(t, "spire", maze.Spire)
	run := maze.Solve(level)
	if run == nil {
		t.Fatal("Solve returned nil; the spire level has a route to the exit")
	}
	assertRoute(t, level, run.Path)
	if run.Moves != 22 {
		t.Fatalf("moves = %d, want 22", run.Moves)
	}
}
