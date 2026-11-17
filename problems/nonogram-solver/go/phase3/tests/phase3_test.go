package tests

import (
	"testing"
	"time"

	"debuggym/nonogram-solver/nonogram"
)

const limit = 100 * time.Millisecond // per large puzzle

// clueOf is an independent run-length check, so these tests don't trust the verifier.
func clueOf(cells []int) []int {
	out := []int{}
	length := 0
	for _, cell := range append(append([]int{}, cells...), 0) {
		if cell == 1 {
			length++
		} else if length > 0 {
			out = append(out, length)
			length = 0
		}
	}
	return out
}

func assertSolved(t *testing.T, puzzle *nonogram.Puzzle, grid nonogram.Grid) {
	t.Helper()
	if grid == nil {
		t.Fatal("expected a solution")
	}
	if len(grid) != puzzle.Height {
		t.Fatalf("wrong number of rows: %d, want %d", len(grid), puzzle.Height)
	}
	for r, row := range grid {
		if len(row) != puzzle.Width {
			t.Fatalf("row %d has the wrong length", r)
		}
		for _, cell := range row {
			if cell != 0 && cell != 1 {
				t.Fatalf("row %d has cells that are not Filled/Empty", r)
			}
		}
		if got := clueOf(row); !equalClues([][]int{got}, [][]int{puzzle.RowClues[r]}) {
			t.Fatalf("row %d does not match its clue: got %v, want %v", r, got, puzzle.RowClues[r])
		}
	}
	for c := 0; c < puzzle.Width; c++ {
		column := make([]int, puzzle.Height)
		for r := range grid {
			column[r] = grid[r][c]
		}
		if got := clueOf(column); !equalClues([][]int{got}, [][]int{puzzle.ColClues[c]}) {
			t.Fatalf("column %d does not match its clue: got %v, want %v", c, got, puzzle.ColClues[c])
		}
	}
}

func timedSolve(puzzle *nonogram.Puzzle) (nonogram.Grid, time.Duration) {
	started := time.Now()
	grid := nonogram.Solve(puzzle)
	return grid, time.Since(started)
}

func TestPhase3Correctness(t *testing.T) {
	t.Run("contributor samples still solve", func(t *testing.T) {
		for _, name := range []string{"sailboat.non", "starfield.non"} {
			puzzle := mustLoad(t, name)
			assertSolved(t, puzzle, nonogram.Solve(puzzle))
		}
	})

	t.Run("puzzle where line logic stalls", func(t *testing.T) {
		// Row-and-column deduction alone leaves most of this board unknown.
		picture := randomPicture(66, 20, 20, 0.55)
		puzzle := mustFromPicture(t, picture, nonogram.Meta{})
		grid := nonogram.Solve(puzzle)
		assertSolved(t, puzzle, grid)
		if !equalGrid(grid, picture) {
			t.Fatal("solution differs from the unique picture")
		}
	})

	t.Run("contradiction found deep in the search", func(t *testing.T) {
		// Two row clues swapped by a contributor: the totals still agree, but no grid fits.
		puzzle := mustFromPicture(t, randomPicture(66, 20, 20, 0.55), nonogram.Meta{})
		rows := copyClues(puzzle.RowClues)
		rows[6], rows[7] = rows[7], rows[6]
		swapped := mustPuzzle(t, rows, puzzle.ColClues, nonogram.Meta{})
		if grid := nonogram.Solve(swapped); grid != nil {
			t.Fatalf("got %v, want no solution", grid)
		}
	})

	t.Run("ambiguous puzzle returns a valid grid", func(t *testing.T) {
		puzzle := mustPuzzle(t, [][]int{{1, 1}, {1, 1}, {1, 1}, {1, 1}}, [][]int{{2}, {2}, {2}, {2}}, nonogram.Meta{})
		assertSolved(t, puzzle, nonogram.Solve(puzzle))
	})
}

func TestPhase3Scale(t *testing.T) {
	t.Run("25x25 community puzzle is fast", func(t *testing.T) {
		picture := randomPicture(11, 25, 25, 0.58)
		puzzle := mustFromPicture(t, picture, nonogram.Meta{})
		grid, elapsed := timedSolve(puzzle)
		assertSolved(t, puzzle, grid)
		if !equalGrid(grid, picture) {
			t.Fatal("solution differs from the unique picture")
		}
		if elapsed >= limit {
			t.Fatalf("took %dms; a 25x25 puzzle must solve in under %dms", elapsed.Milliseconds(), limit.Milliseconds())
		}
	})

	t.Run("30x30 community puzzle is fast", func(t *testing.T) {
		picture := randomPicture(53, 30, 30, 0.6)
		puzzle := mustFromPicture(t, picture, nonogram.Meta{})
		grid, elapsed := timedSolve(puzzle)
		assertSolved(t, puzzle, grid)
		if !equalGrid(grid, picture) {
			t.Fatal("solution differs from the unique picture")
		}
		if elapsed >= limit {
			t.Fatalf("took %dms; a 30x30 puzzle must solve in under %dms", elapsed.Milliseconds(), limit.Milliseconds())
		}
	})
}

func copyClues(clues [][]int) [][]int {
	out := make([][]int, len(clues))
	for i, clue := range clues {
		out[i] = append([]int{}, clue...)
	}
	return out
}
