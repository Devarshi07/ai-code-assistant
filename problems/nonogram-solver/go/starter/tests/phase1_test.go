package tests

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"debuggym/nonogram-solver/nonogram"
)

const samplesDir = "../samples"

func readSample(t *testing.T, name string) string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(samplesDir, name))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func mustGrid(t *testing.T, text string) nonogram.Grid {
	t.Helper()
	grid, err := nonogram.ParseGrid(text)
	if err != nil {
		t.Fatal(err)
	}
	return grid
}

func mustPuzzle(t *testing.T, rowClues, colClues [][]int, meta nonogram.Meta) *nonogram.Puzzle {
	t.Helper()
	puzzle, err := nonogram.NewPuzzle(rowClues, colClues, meta)
	if err != nil {
		t.Fatal(err)
	}
	return puzzle
}

func mustLoad(t *testing.T, name string) *nonogram.Puzzle {
	t.Helper()
	puzzle, err := nonogram.LoadPuzzle(filepath.Join(samplesDir, name))
	if err != nil {
		t.Fatal(err)
	}
	return puzzle
}

func mustFromPicture(t *testing.T, picture nonogram.Grid, meta nonogram.Meta) *nonogram.Puzzle {
	t.Helper()
	puzzle, err := nonogram.PuzzleFromPicture(picture, meta)
	if err != nil {
		t.Fatal(err)
	}
	return puzzle
}

func equalClues(a, b [][]int) bool { return slices.EqualFunc(a, b, slices.Equal[[]int]) }

func equalGrid(a, b nonogram.Grid) bool { return equalClues(a, b) }

// A correct answer to samples/sailboat.non, checked by hand against every clue.
const sailboatAnswer = `
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

func TestPhase1LineClue(t *testing.T) {
	t.Run("blocks separated by gaps", func(t *testing.T) {
		got := nonogram.LineClue([]int{0, 1, 1, 0, 1, 0, 0})
		if !slices.Equal(got, []int{2, 1}) {
			t.Fatalf("got %v, want [2 1]", got)
		}
	})

	t.Run("empty line has empty clue", func(t *testing.T) {
		got := nonogram.LineClue([]int{0, 0, 0, 0})
		if len(got) != 0 {
			t.Fatalf("got %v, want []", got)
		}
	})

	t.Run("long and short blocks", func(t *testing.T) {
		got := nonogram.LineClue([]int{0, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0})
		if !slices.Equal(got, []int{5, 1, 2}) {
			t.Fatalf("got %v, want [5 1 2]", got)
		}
	})
}

func TestPhase1Publishing(t *testing.T) {
	t.Run("mug drawing clues", func(t *testing.T) {
		puzzle, err := nonogram.PuzzleFromPictureText(readSample(t, "mug.pic"), nonogram.Meta{Title: "Mug"})
		if err != nil {
			t.Fatal(err)
		}
		if puzzle.Width != 10 || puzzle.Height != 10 {
			t.Fatalf("size %dx%d, want 10x10", puzzle.Width, puzzle.Height)
		}
		wantRows := [][]int{{1, 1}, {1, 1}, {1, 1}, {}, {7}, {1, 3}, {1, 1, 1}, {1, 3}, {5}, {}}
		wantCols := [][]int{{4}, {1, 1, 1}, {1, 1, 1, 1}, {1, 1}, {1, 1, 1}, {1, 1, 1, 1}, {4}, {1, 1}, {3}, {}}
		if !equalClues(puzzle.RowClues, wantRows) {
			t.Fatalf("row clues %v, want %v", puzzle.RowClues, wantRows)
		}
		if !equalClues(puzzle.ColClues, wantCols) {
			t.Fatalf("column clues %v, want %v", puzzle.ColClues, wantCols)
		}
	})

	t.Run("heart drawing publishes", func(t *testing.T) {
		puzzle, err := nonogram.PuzzleFromPictureText(readSample(t, "heart.pic"), nonogram.Meta{Title: "Heart"})
		if err != nil {
			t.Fatal(err)
		}
		wantRows := [][]int{{1, 1}, {5}, {5}, {3}, {1}}
		wantCols := [][]int{{2}, {4}, {4}, {4}, {2}}
		if !equalClues(puzzle.RowClues, wantRows) {
			t.Fatalf("row clues %v, want %v", puzzle.RowClues, wantRows)
		}
		if !equalClues(puzzle.ColClues, wantCols) {
			t.Fatalf("column clues %v, want %v", puzzle.ColClues, wantCols)
		}
	})

	t.Run("lighthouse drawing publishes", func(t *testing.T) {
		puzzle, err := nonogram.PuzzleFromPictureText(readSample(t, "lighthouse.pic"), nonogram.Meta{Title: "Lighthouse"})
		if err != nil {
			t.Fatal(err)
		}
		if puzzle.Width != 12 || puzzle.Height != 13 {
			t.Fatalf("size %dx%d, want 12x13", puzzle.Width, puzzle.Height)
		}
		wantRows := [][]int{{2}, {4, 3}, {1, 2}, {4, 3}, {2}, {4}, {1, 1}, {4}, {1, 1}, {4}, {6}, {1, 8, 1}, {12}}
		wantCols := [][]int{{2}, {1}, {2}, {3}, {3, 8}, {2, 3, 1, 4}, {2, 3, 1, 4}, {3, 8}, {1, 3}, {1, 1, 2}, {1, 1, 1}, {1, 1, 2}}
		if !equalClues(puzzle.RowClues, wantRows) {
			t.Fatalf("row clues %v, want %v", puzzle.RowClues, wantRows)
		}
		if !equalClues(puzzle.ColClues, wantCols) {
			t.Fatalf("column clues %v, want %v", puzzle.ColClues, wantCols)
		}
		if puzzle.FilledCells() != 65 {
			t.Fatalf("filled cells %d, want 65", puzzle.FilledCells())
		}
	})
}

func TestPhase1Verifier(t *testing.T) {
	t.Run("accepts correct sailboat answer", func(t *testing.T) {
		puzzle := mustLoad(t, "sailboat.non")
		answer := mustGrid(t, sailboatAnswer)
		problems, err := nonogram.FindMismatches(puzzle, answer)
		if err != nil {
			t.Fatal(err)
		}
		if len(problems) != 0 {
			t.Fatalf("unexpected mismatches: %v", problems)
		}
		if !nonogram.IsSolution(puzzle, answer) {
			t.Fatal("IsSolution rejected a correct answer")
		}
	})

	t.Run("drawing solves its own puzzle", func(t *testing.T) {
		picture := mustGrid(t, readSample(t, "mug.pic"))
		if !nonogram.IsSolution(mustFromPicture(t, picture, nonogram.Meta{}), picture) {
			t.Fatal("the mug drawing should solve its own puzzle")
		}
	})

	t.Run("reports exactly the wrong lines", func(t *testing.T) {
		picture := mustGrid(t, readSample(t, "mug.pic"))
		puzzle := mustFromPicture(t, picture, nonogram.Meta{})
		picture[5][3] = 1
		problems, err := nonogram.FindMismatches(puzzle, picture)
		if err != nil {
			t.Fatal(err)
		}
		type line struct {
			kind  string
			index int
		}
		var got []line
		for _, p := range problems {
			got = append(got, line{p.Kind, p.Index})
		}
		want := []line{{"row", 5}, {"column", 3}}
		if !slices.Equal(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
		if nonogram.IsSolution(puzzle, picture) {
			t.Fatal("a changed grid should not be a solution")
		}
	})

	t.Run("rejects grid of the wrong shape", func(t *testing.T) {
		puzzle := mustFromPicture(t, mustGrid(t, readSample(t, "mug.pic")), nonogram.Meta{})
		full := mustGrid(t, readSample(t, "mug.pic"))
		if nonogram.IsSolution(puzzle, full[:len(full)-1]) {
			t.Fatal("a grid with a missing row should be rejected")
		}
	})
}

func TestPhase1PuzzleFile(t *testing.T) {
	t.Run("reads contributor file", func(t *testing.T) {
		puzzle := mustLoad(t, "sailboat.non")
		if puzzle.Title != "Sailboat" || puzzle.Author != "R. Okafor" {
			t.Fatalf("got %q by %q", puzzle.Title, puzzle.Author)
		}
		if puzzle.Width != 10 || puzzle.Height != 10 {
			t.Fatalf("size %dx%d, want 10x10", puzzle.Width, puzzle.Height)
		}
		if !slices.Equal(puzzle.RowClues[6], []int{10}) {
			t.Fatalf("row 7 clue %v", puzzle.RowClues[6])
		}
		if !slices.Equal(puzzle.RowClues[9], []int{1, 1, 1, 1, 1}) {
			t.Fatalf("row 10 clue %v", puzzle.RowClues[9])
		}
		if !slices.Equal(puzzle.ColClues[5], []int{4, 4}) {
			t.Fatalf("column 6 clue %v", puzzle.ColClues[5])
		}
	})

	t.Run("zero marks an empty line", func(t *testing.T) {
		puzzle, err := nonogram.ParsePuzzle("rows: 3 | 0 | 1 1\ncols: 2 | 1 | 2")
		if err != nil {
			t.Fatal(err)
		}
		if want := [][]int{{3}, {}, {1, 1}}; !equalClues(puzzle.RowClues, want) {
			t.Fatalf("row clues %v, want %v", puzzle.RowClues, want)
		}
	})

	t.Run("format round trip", func(t *testing.T) {
		original, err := nonogram.ParsePuzzle("# draft\ntitle: Steps\nrows: 1 | 2 | 0\ncols: 2 | 1 | 0")
		if err != nil {
			t.Fatal(err)
		}
		again, err := nonogram.ParsePuzzle(nonogram.FormatPuzzle(original))
		if err != nil {
			t.Fatal(err)
		}
		if again.Title != "Steps" || !equalClues(again.RowClues, [][]int{{1}, {2}, {}}) || !equalClues(again.ColClues, [][]int{{2}, {1}, {}}) {
			t.Fatalf("round trip changed the puzzle: %q %v %v", again.Title, again.RowClues, again.ColClues)
		}
	})

	t.Run("clue totals must agree", func(t *testing.T) {
		_, err := nonogram.ParsePuzzle("rows: 2 | 1\ncols: 1 | 1")
		var puzzleErr *nonogram.PuzzleError
		if !errors.As(err, &puzzleErr) {
			t.Fatalf("got %v, want a PuzzleError", err)
		}
	})

	t.Run("clue longer than its line is rejected", func(t *testing.T) {
		_, err := nonogram.NewPuzzle([][]int{{2, 1}}, [][]int{{1}, {1}, {1}}, nonogram.Meta{})
		var puzzleErr *nonogram.PuzzleError
		if !errors.As(err, &puzzleErr) {
			t.Fatalf("got %v, want a PuzzleError", err)
		}
	})
}

func TestPhase1Render(t *testing.T) {
	t.Run("board with clues", func(t *testing.T) {
		puzzle := mustPuzzle(t, [][]int{{1, 1}, {1}, {1, 1}}, [][]int{{1, 1}, {}, {3}}, nonogram.Meta{Title: "Tiny"})
		grid := nonogram.Grid{{1, 0, 1}, {0, 0, 1}, {1, 0, 1}}
		want := "    1\n" +
			"    1 0 3\n" +
			"1 1 # . #\n" +
			"  1 . . #\n" +
			"1 1 # . #"
		if got := nonogram.Render(puzzle, grid); got != want {
			t.Fatalf("got:\n%s\nwant:\n%s", got, want)
		}
	})

	t.Run("unsolved board shows question marks", func(t *testing.T) {
		puzzle := mustPuzzle(t, [][]int{{1}, {}}, [][]int{{}, {1}}, nonogram.Meta{})
		lines := splitLines(nonogram.Render(puzzle, nil))
		if want := []string{"1 ? ?", "0 ? ?"}; !slices.Equal(lines[1:], want) {
			t.Fatalf("got %q, want %q", lines[1:], want)
		}
	})
}

func splitLines(text string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(text); i++ {
		if text[i] == '\n' {
			lines = append(lines, text[start:i])
			start = i + 1
		}
	}
	return append(lines, text[start:])
}
