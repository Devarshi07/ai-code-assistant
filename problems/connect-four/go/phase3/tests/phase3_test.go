package tests

import (
	"slices"
	"testing"
	"time"

	"debuggym/connect-four/connect4"
)

// Puzzles as 1-based move strings. Answers are 0-based columns: every column
// that wins in the stated number of plies, checked offline by exhaustive search.
type puzzle struct {
	moves   string
	plies   int
	answers []int
}

var winIn7 = []puzzle{
	{"164773774571", 7, []int{3, 4, 5}},
	{"6361444236654215", 7, []int{3, 4}},
}

const (
	slowWinsFirst = "2575261113446722" // columns 4 and 5 win in 7; only column 1 wins in 5
	winIn9        = "6161344754142623353"
	defender      = "1647737745714" // Yellow to move after Red's winning first move
)

// Today's batch from the puzzle generator, easiest first.
var batch = []puzzle{
	{"657657347227", 9, []int{3}},
	{"7145742714611", 11, []int{4}},
	{"45321456414517", 11, []int{2}},
	{"7677526775225755", 11, []int{5}},
}

const batchBudget = 120 * time.Millisecond

func TestPhase3DeepSolve(t *testing.T) {
	t.Run("win in seven reports the exact distance", func(t *testing.T) {
		for _, p := range winIn7 {
			board := mustBoard(t, p.moves)
			win, ok := connect4.Solve(board, 7)
			if !ok {
				t.Fatalf("%s: expected a win in 7", p.moves)
			}
			if win.Plies != 7 {
				t.Fatalf("%s: wrong distance: got %d, want 7", p.moves, win.Plies)
			}
			if !slices.Contains(p.answers, win.Move) {
				t.Fatalf("%s: column %d does not win in 7", p.moves, win.Move+1)
			}
			if !moveForcesWin(board.Copy(), win.Move, 7) {
				t.Fatalf("%s: the reported move does not force a win", p.moves)
			}
			if canForceWin(board.Copy(), 5) {
				t.Fatal("fixture check: no faster win exists")
			}
		}
	})

	t.Run("longer horizon still finds the fastest win", func(t *testing.T) {
		win, ok := connect4.Solve(mustBoard(t, slowWinsFirst), 9)
		if !ok {
			t.Fatal("expected a forced win")
		}
		assertEqual(t, []int{win.Move, win.Plies}, []int{0, 5}, "move and plies")
	})

	t.Run("deeper win is not reported inside a shorter horizon", func(t *testing.T) {
		if win, ok := connect4.Solve(mustBoard(t, winIn9), 7); ok {
			t.Fatalf("got %+v, want no win", win)
		}
	})

	t.Run("defender has no forced win", func(t *testing.T) {
		if win, ok := connect4.Solve(mustBoard(t, defender), 8); ok {
			t.Fatalf("got %+v, want no win", win)
		}
	})

	t.Run("puzzle batch is checked within budget", func(t *testing.T) {
		var elapsed time.Duration
		for index, p := range batch {
			board := mustBoard(t, p.moves)
			start := time.Now()
			win, ok := connect4.Solve(board, p.plies)
			elapsed += time.Since(start)
			if elapsed >= batchBudget {
				t.Fatalf("%dms after %d of %d puzzles; the batch must be checked in under %dms",
					elapsed.Milliseconds(), index+1, len(batch), batchBudget.Milliseconds())
			}
			if !ok {
				t.Fatalf("%s: expected a win in %d", p.moves, p.plies)
			}
			if win.Plies != p.plies {
				t.Fatalf("%s: wrong distance: got %d, want %d", p.moves, win.Plies, p.plies)
			}
			if !slices.Contains(p.answers, win.Move) {
				t.Fatalf("%s: column %d does not win in %d", p.moves, win.Move+1, p.plies)
			}
			assertEqual(t, board.ToMoves(), p.moves, "solve must not change the board")
		}
	})
}
