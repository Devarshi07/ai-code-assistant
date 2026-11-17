package nonogram

// Answer checking: is a player's (or the solver's) grid a solution?

import (
	"errors"
	"fmt"
	"slices"
)

// Mismatch is one line whose cells do not produce its clue.
// Kind is "row" or "column", Index is 0-based, Expected is the puzzle's clue
// and Actual is the clue the grid's cells produce.
type Mismatch struct {
	Kind     string
	Index    int
	Expected []int
	Actual   []int
}

func (m Mismatch) String() string {
	return fmt.Sprintf("%s %d: clue is %s, grid gives %s", m.Kind, m.Index+1, FormatClue(m.Expected), FormatClue(m.Actual))
}

// CheckShape returns a *PuzzleError unless grid is Height x Width and every cell is Filled or Empty.
func CheckShape(p *Puzzle, grid Grid) error {
	ok := len(grid) == p.Height
	for _, row := range grid {
		if len(row) != p.Width {
			ok = false
		}
	}
	if !ok {
		return puzzleErrorf("%s: grid must be %dx%d", p.Title, p.Width, p.Height)
	}
	for r, row := range grid {
		for c, cell := range row {
			if cell != Filled && cell != Empty {
				return puzzleErrorf("%s: cell (%d, %d) is %d, not filled or empty", p.Title, r, c, cell)
			}
		}
	}
	return nil
}

// FindMismatches lists every row and column of grid that disagrees with p's clues.
func FindMismatches(p *Puzzle, grid Grid) ([]Mismatch, error) {
	if err := CheckShape(p, grid); err != nil {
		return nil, err
	}
	var problems []Mismatch
	for r, row := range grid {
		if actual := LineClue(row); !slices.Equal(actual, p.RowClues[r]) {
			problems = append(problems, Mismatch{"row", r, p.RowClues[r], actual})
		}
	}
	for c, col := range Columns(grid) {
		if actual := LineClue(col); !slices.Equal(actual, p.ColClues[c]) {
			problems = append(problems, Mismatch{"column", c, p.ColClues[c], actual})
		}
	}
	return problems, nil
}

// IsSolution is true when grid has the puzzle's shape and matches every clue.
func IsSolution(p *Puzzle, grid Grid) bool {
	problems, err := FindMismatches(p, grid)
	if err != nil {
		var puzzleErr *PuzzleError
		if errors.As(err, &puzzleErr) {
			return false
		}
		panic(err)
	}
	return len(problems) == 0
}
