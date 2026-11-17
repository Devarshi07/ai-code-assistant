package tests

import (
	"slices"
	"testing"

	"debuggym/connect-four/connect4"
)

// Positions as 1-based move strings (Red first). Columns in assertions are 0-based.
const (
	winOrBlock      = "171717"        // Red wins in column 1 (index 0); Yellow threatens column 7
	diagonalThreat  = "4534213322"    // Yellow threatens column 2 (index 1) along a falling diagonal
	poisonedCentre  = "6613572513"    // a disc in the centre lets Yellow win on top of it
	fork            = "216646"        // Red forks with column 5 (index 4): win in 3
	winIn3          = "3211275371645" // Yellow wins in 3, only with column 1 (index 0)
	winIn5          = "36566312253"   // Red wins in 5 with column 3 (index 2); column 5 only wins in 7
	winIn5TwoWays   = "4711574655"    // Red wins in 5 with either column 2 or 3 (index 1 or 2)
	centreIsSlower  = "431654242273522" // the centre wins in 5, column 3 (index 2) wins in 3
	doubleThreat    = "131475"        // Yellow threatens columns 2 and 6; Red cannot stop both
)

func assertForcedWin(t *testing.T, moves string, maxPlies, plies int, answers []int) {
	t.Helper()
	board := mustBoard(t, moves)
	win, ok := connect4.Solve(board, maxPlies)
	if !ok {
		t.Fatalf("%s: expected a win in %d", moves, plies)
	}
	if win.Plies != plies {
		t.Fatalf("%s: wrong distance: got %d, want %d", moves, win.Plies, plies)
	}
	if !slices.Contains(answers, win.Move) {
		t.Fatalf("%s: column %d does not win in %d", moves, win.Move+1, plies)
	}
	if !moveForcesWin(board.Copy(), win.Move, plies) {
		t.Fatal("the reported move does not force a win")
	}
	assertEqual(t, board.ToMoves(), moves, "solve must not change the board")
}

func mustChoose(t *testing.T, board *connect4.Board, depth int) int {
	t.Helper()
	col, err := connect4.ChooseMove(board, depth)
	if err != nil {
		t.Fatalf("ChooseMove: %v", err)
	}
	return col
}

func TestPhase2ChooseMove(t *testing.T) {
	t.Run("takes a win before blocking", func(t *testing.T) {
		assertEqual(t, mustChoose(t, mustBoard(t, winOrBlock), connect4.DefaultDepth), 0, "chosen column")
	})

	t.Run("blocks the only threat", func(t *testing.T) {
		assertEqual(t, mustChoose(t, mustBoard(t, diagonalThreat), connect4.DefaultDepth), 1, "chosen column")
	})

	t.Run("does not drop under an opponent threat", func(t *testing.T) {
		board := mustBoard(t, poisonedCentre)
		move := mustChoose(t, board, connect4.DefaultDepth)
		if !slices.Contains(board.LegalMoves(), move) {
			t.Fatalf("column %d is not a legal move", move+1)
		}
		if move == 3 {
			t.Fatal("column 4 lets Yellow complete four on top of it")
		}
	})

	t.Run("depth two already sees the reply", func(t *testing.T) {
		if move := mustChoose(t, mustBoard(t, poisonedCentre), 2); move == 3 {
			t.Fatal("column 4 lets Yellow complete four on top of it")
		}
	})

	t.Run("finds the fork", func(t *testing.T) {
		assertEqual(t, mustChoose(t, mustBoard(t, fork), connect4.DefaultDepth), 4, "column 5 makes two threats at once")
	})

	t.Run("opens in the centre", func(t *testing.T) {
		assertEqual(t, mustChoose(t, connect4.NewBoard(), connect4.DefaultDepth), 3, "chosen column")
	})

	t.Run("leaves the board unchanged", func(t *testing.T) {
		board := mustBoard(t, fork)
		grid := board.ToGrid()
		mustChoose(t, board, connect4.DefaultDepth)
		assertEqual(t, board.ToGrid(), grid, "grid")
		assertEqual(t, board.ToMoves(), fork, "move string")
	})

	t.Run("full board throws", func(t *testing.T) {
		if _, err := connect4.ChooseMove(mustBoard(t, drawn), connect4.DefaultDepth); err == nil {
			t.Fatal("ChooseMove on a full board: expected an error")
		}
	})
}

func TestPhase2Solve(t *testing.T) {
	t.Run("immediate win is one ply", func(t *testing.T) {
		assertForcedWin(t, winOrBlock, 5, 1, []int{0})
	})

	t.Run("win in three", func(t *testing.T) {
		assertForcedWin(t, winIn3, 3, 3, []int{0})
	})

	t.Run("fork is a win in three", func(t *testing.T) {
		assertForcedWin(t, fork, 5, 3, []int{4})
	})

	t.Run("prefers the fastest win", func(t *testing.T) {
		assertForcedWin(t, centreIsSlower, 5, 3, []int{2})
	})

	t.Run("win in five", func(t *testing.T) {
		assertForcedWin(t, winIn5, 5, 5, []int{2})
	})

	t.Run("win in five with two answers", func(t *testing.T) {
		assertForcedWin(t, winIn5TwoWays, 5, 5, []int{1, 2})
	})

	t.Run("horizon too short means no win", func(t *testing.T) {
		if win, ok := connect4.Solve(mustBoard(t, winIn5), 3); ok {
			t.Fatalf("win in five, horizon 3: got %+v, want no win", win)
		}
		if win, ok := connect4.Solve(mustBoard(t, winIn3), 1); ok {
			t.Fatalf("win in three, horizon 1: got %+v, want no win", win)
		}
	})

	t.Run("losing side has no forced win", func(t *testing.T) {
		board := mustBoard(t, doubleThreat)
		assertEqual(t, canForceWin(board, 5), false, "brute force")
		if win, ok := connect4.Solve(board, 5); ok {
			t.Fatalf("got %+v, want no win", win)
		}
	})

	t.Run("quiet opening has no forced win", func(t *testing.T) {
		if win, ok := connect4.Solve(connect4.NewBoard(), 5); ok {
			t.Fatalf("got %+v, want no win", win)
		}
	})

	t.Run("full board has no forced win", func(t *testing.T) {
		if win, ok := connect4.Solve(mustBoard(t, drawn), 5); ok {
			t.Fatalf("got %+v, want no win", win)
		}
	})
}
