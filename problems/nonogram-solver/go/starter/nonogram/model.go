// Package nonogram is the back-office toolkit behind Pixelwise, a picture-logic app.
//
// Core data model: puzzles, clues and grids.
//
// A grid is a slice of rows, each a slice of cells, where every cell is
// Filled or Empty. A clue lists the lengths of the filled blocks in one line,
// in order (left to right for rows, top to bottom for columns). A line with
// no filled cells has the empty clue, written `0` in puzzle files.
package nonogram

import (
	"fmt"
	"slices"
	"strings"
)

// Grid is a slice of rows; each cell is Filled or Empty.
type Grid = [][]int

// Cell values.
const (
	Empty  = 0
	Filled = 1
)

// CellChar is the character used for a cell in picture files and previews,
// or '?' for any other value.
func CellChar(cell int) string {
	switch cell {
	case Filled:
		return "#"
	case Empty:
		return "."
	}
	return "?"
}

// PuzzleError reports a malformed puzzle, picture or puzzle file.
type PuzzleError struct {
	Message string
}

func (e *PuzzleError) Error() string { return e.Message }

func puzzleErrorf(format string, args ...any) error {
	return &PuzzleError{Message: fmt.Sprintf(format, args...)}
}

// Sum is the total of a clue's blocks.
func Sum(numbers []int) int {
	total := 0
	for _, n := range numbers {
		total += n
	}
	return total
}

// MinLength is the fewest cells that can hold clue: every block plus one gap
// between blocks.
func MinLength(clue []int) int {
	return Sum(clue) + max(len(clue)-1, 0)
}

// FormatClue writes a clue as designers do: "3 1 2", or "0" for an empty line.
func FormatClue(clue []int) string {
	if len(clue) == 0 {
		return "0"
	}
	parts := make([]string, len(clue))
	for i, n := range clue {
		parts[i] = fmt.Sprint(n)
	}
	return strings.Join(parts, " ")
}

// Meta holds the optional descriptive fields of a puzzle.
type Meta struct {
	Title  string // "Untitled" when empty
	Author string // empty when unknown
}

// Puzzle holds the row and column clues for one nonogram, validated on construction.
type Puzzle struct {
	Title    string
	Author   string
	RowClues [][]int
	ColClues [][]int
	Height   int
	Width    int
}

// NewPuzzle validates the clues and builds a puzzle. It copies the clues.
func NewPuzzle(rowClues, colClues [][]int, meta Meta) (*Puzzle, error) {
	p := &Puzzle{Title: meta.Title, Author: meta.Author}
	if p.Title == "" {
		p.Title = "Untitled"
	}
	for _, clue := range rowClues {
		p.RowClues = append(p.RowClues, slices.Clone(clue))
	}
	for _, clue := range colClues {
		p.ColClues = append(p.ColClues, slices.Clone(clue))
	}
	p.Height = len(p.RowClues)
	p.Width = len(p.ColClues)
	if err := p.validate(); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *Puzzle) validate() error {
	if p.Width == 0 || p.Height == 0 {
		return puzzleErrorf("%s: a puzzle needs at least one row and one column", p.Title)
	}
	lines := []struct {
		kind   string
		clues  [][]int
		length int
	}{{"row", p.RowClues, p.Width}, {"column", p.ColClues, p.Height}}
	for _, line := range lines {
		for i, clue := range line.clues {
			if slices.ContainsFunc(clue, func(n int) bool { return n <= 0 }) {
				return puzzleErrorf("%s: %s %d has a block that is not a positive whole number", p.Title, line.kind, i+1)
			}
			if MinLength(clue) > line.length {
				return puzzleErrorf("%s: %s %d clue %s needs %d cells but the %s has %d",
					p.Title, line.kind, i+1, FormatClue(clue), MinLength(clue), line.kind, line.length)
			}
		}
	}
	byRows, byCols := 0, 0
	for _, clue := range p.RowClues {
		byRows += Sum(clue)
	}
	for _, clue := range p.ColClues {
		byCols += Sum(clue)
	}
	if byRows != byCols {
		return puzzleErrorf("%s: row clues fill %d cells but column clues fill %d", p.Title, byRows, byCols)
	}
	return nil
}

// FilledCells is the number of cells every solution fills.
func (p *Puzzle) FilledCells() int {
	total := 0
	for _, clue := range p.RowClues {
		total += Sum(clue)
	}
	return total
}

func (p *Puzzle) String() string {
	return fmt.Sprintf("Puzzle(%s, %dx%d)", p.Title, p.Width, p.Height)
}

// ParseGrid reads a picture drawn with '#' (filled) and '.' (empty), one row per line.
func ParseGrid(text string) (Grid, error) {
	var rows []string
	for _, line := range strings.Split(text, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			rows = append(rows, line)
		}
	}
	if len(rows) == 0 {
		return nil, puzzleErrorf("picture is empty")
	}
	width := len(rows[0])
	grid := make(Grid, len(rows))
	for i, line := range rows {
		if len(line) != width {
			return nil, puzzleErrorf("picture row %d has %d cells, expected %d", i+1, len(line), width)
		}
		var unknown []byte
		for j := 0; j < len(line); j++ {
			if line[j] != '#' && line[j] != '.' && !slices.Contains(unknown, line[j]) {
				unknown = append(unknown, line[j])
			}
		}
		if len(unknown) > 0 {
			slices.Sort(unknown)
			return nil, puzzleErrorf("picture row %d has unknown symbols '%s'", i+1, unknown)
		}
		grid[i] = make([]int, width)
		for j := 0; j < width; j++ {
			if line[j] == '#' {
				grid[i][j] = Filled
			}
		}
	}
	return grid, nil
}

// FormatGrid is the inverse of ParseGrid.
func FormatGrid(grid Grid) string {
	lines := make([]string, len(grid))
	for r, row := range grid {
		var sb strings.Builder
		for _, cell := range row {
			sb.WriteString(CellChar(cell))
		}
		lines[r] = sb.String()
	}
	return strings.Join(lines, "\n")
}

// Columns returns the grid's columns, top to bottom, as slices of cells.
func Columns(grid Grid) [][]int {
	if len(grid) == 0 {
		return nil
	}
	cols := make([][]int, len(grid[0]))
	for c := range cols {
		cols[c] = make([]int, len(grid))
		for r := range grid {
			cols[c][r] = grid[r][c]
		}
	}
	return cols
}
