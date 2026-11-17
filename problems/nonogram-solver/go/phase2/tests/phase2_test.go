package tests

import (
	"testing"

	"debuggym/nonogram-solver/nonogram"
)

const sailboatKey = `
....#.....
....##....
....###...
....####..
....#####.
....#.....
##########
.########.
..######..
.#.#.#.#.#
`

// Line-by-line logic stalls on this one almost immediately: a solver has to
// commit to a guess and back out of the wrong ones.
const starfieldKey = `
#.....#.#.
#..#..##..
...#.#.###
#..#.#.##.
...#..#.##
....####.#
#..#..#...
.#.#...#.#
.#..###..#
###.#....#
`

// runsOf is an independent run-length check, so these tests don't trust the verifier.
func runsOf(cells []int) []int {
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

func assertSatisfies(t *testing.T, puzzle *nonogram.Puzzle, grid nonogram.Grid) {
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
		if got := runsOf(row); !equalClues([][]int{got}, [][]int{puzzle.RowClues[r]}) {
			t.Fatalf("row %d does not match its clue: got %v, want %v", r, got, puzzle.RowClues[r])
		}
	}
	for c := 0; c < puzzle.Width; c++ {
		column := make([]int, puzzle.Height)
		for r := range grid {
			column[r] = grid[r][c]
		}
		if got := runsOf(column); !equalClues([][]int{got}, [][]int{puzzle.ColClues[c]}) {
			t.Fatalf("column %d does not match its clue: got %v, want %v", c, got, puzzle.ColClues[c])
		}
	}
}

func TestPhase2Solve(t *testing.T) {
	t.Run("heart", func(t *testing.T) {
		puzzle := mustPuzzle(t, [][]int{{1, 1}, {5}, {5}, {3}, {1}}, [][]int{{2}, {4}, {4}, {4}, {2}}, nonogram.Meta{Title: "Heart"})
		grid := nonogram.Solve(puzzle)
		assertSatisfies(t, puzzle, grid)
		if want := mustGrid(t, readSample(t, "heart.pic")); !equalGrid(grid, want) {
			t.Fatalf("got %v, want %v", grid, want)
		}
	})

	t.Run("sailboat answer key", func(t *testing.T) {
		puzzle := mustLoad(t, "sailboat.non")
		grid := nonogram.Solve(puzzle)
		assertSatisfies(t, puzzle, grid)
		if want := mustGrid(t, sailboatKey); !equalGrid(grid, want) {
			t.Fatalf("got %v, want %v", grid, want)
		}
	})

	t.Run("starfield needs more than line logic", func(t *testing.T) {
		puzzle := mustLoad(t, "starfield.non")
		grid := nonogram.Solve(puzzle)
		assertSatisfies(t, puzzle, grid)
		if want := mustGrid(t, starfieldKey); !equalGrid(grid, want) {
			t.Fatalf("got %v, want %v", grid, want)
		}
	})

	t.Run("published drawings solve back to the drawing", func(t *testing.T) {
		for _, name := range []string{"mug.pic", "lighthouse.pic"} {
			picture := mustGrid(t, readSample(t, name))
			puzzle := mustFromPicture(t, picture, nonogram.Meta{})
			grid := nonogram.Solve(puzzle)
			assertSatisfies(t, puzzle, grid)
			if !equalGrid(grid, picture) {
				t.Fatalf("%s should solve back to the drawing", name)
			}
		}
	})

	t.Run("single cell puzzles", func(t *testing.T) {
		one := nonogram.Solve(mustPuzzle(t, [][]int{{1}}, [][]int{{1}}, nonogram.Meta{}))
		if !equalGrid(one, nonogram.Grid{{1}}) {
			t.Fatalf("got %v, want [[1]]", one)
		}
		none := nonogram.Solve(mustPuzzle(t, [][]int{{}}, [][]int{{}}, nonogram.Meta{}))
		if !equalGrid(none, nonogram.Grid{{0}}) {
			t.Fatalf("got %v, want [[0]]", none)
		}
	})

	t.Run("full and empty lines", func(t *testing.T) {
		puzzle := mustPuzzle(t, [][]int{{4}, {}, {1, 1}, {4}}, [][]int{{1, 2}, {1, 1}, {1, 1}, {1, 2}}, nonogram.Meta{})
		grid := nonogram.Solve(puzzle)
		assertSatisfies(t, puzzle, grid)
		if want := (nonogram.Grid{{1, 1, 1, 1}, {0, 0, 0, 0}, {1, 0, 0, 1}, {1, 1, 1, 1}}); !equalGrid(grid, want) {
			t.Fatalf("got %v, want %v", grid, want)
		}
	})

	t.Run("ambiguous puzzle returns a valid grid", func(t *testing.T) {
		// Two diagonals both fit; either answer is acceptable.
		puzzle := mustPuzzle(t, [][]int{{1}, {1}}, [][]int{{1}, {1}}, nonogram.Meta{})
		assertSatisfies(t, puzzle, nonogram.Solve(puzzle))
	})

	t.Run("contradictory clues have no solution", func(t *testing.T) {
		// Totals agree, but each outer column needs two stacked cells while row 2 is empty.
		puzzle := mustPuzzle(t, [][]int{{1, 1}, {}, {1, 1}}, [][]int{{2}, {}, {2}}, nonogram.Meta{})
		if grid := nonogram.Solve(puzzle); grid != nil {
			t.Fatalf("got %v, want no solution", grid)
		}
	})

	t.Run("solving does not change the puzzle", func(t *testing.T) {
		puzzle := mustLoad(t, "sailboat.non")
		rowsBefore, colsBefore := cloneClues(puzzle.RowClues), cloneClues(puzzle.ColClues)
		nonogram.Solve(puzzle)
		if !equalClues(puzzle.RowClues, rowsBefore) || !equalClues(puzzle.ColClues, colsBefore) {
			t.Fatal("Solve changed the puzzle's clues")
		}
	})
}

func cloneClues(clues [][]int) [][]int {
	out := make([][]int, len(clues))
	for i, clue := range clues {
		out[i] = append([]int{}, clue...)
	}
	return out
}
