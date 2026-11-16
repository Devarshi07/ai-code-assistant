// Package armada is the naval-combat simulation library behind the studio's
// bot-testing harness: oceans and fleets, shot resolution, and the match
// runner that plays bots against seeded fleets. See README.md for the rules.
package armada

// The ocean grid: coordinates, bounds and the A1-style labels used in logs.
//
// Rows are lettered from the top (A, B, C, ...) and columns are numbered from 1,
// so the corners of the standard 10x10 board are A1, A10, J1 and J10.
// Internally everything is zero-based: Coord{0, 0} is A1 and Coord{1, 6} is B7.
// Coords are comparable values, so they work directly as map keys.

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

const (
	MinSize = 4
	MaxSize = 26 // one letter per row
)

var labelPattern = regexp.MustCompile(`^\s*([A-Za-z])\s*(\d{1,2})\s*$`)

// Coord is one cell of the ocean.
type Coord struct {
	Row, Col int
}

// String gives the cell's label: Coord{1, 6} is "B7".
func (c Coord) String() string {
	if c.Row < 0 || c.Col < 0 {
		return fmt.Sprintf("(%d, %d)", c.Row, c.Col)
	}
	return fmt.Sprintf("%c%d", 'A'+c.Row, c.Col+1)
}

// ParseLabel turns a label such as "B7" into Coord{1, 6}. Case and
// surrounding spaces are ignored.
func ParseLabel(text string) (Coord, error) {
	match := labelPattern.FindStringSubmatch(text)
	if match == nil {
		return Coord{}, fmt.Errorf("not a board label: %q", text)
	}
	number, _ := strconv.Atoi(match[2])
	return Coord{Row: int(unicode.ToUpper(rune(match[1][0])) - 'A'), Col: number - 1}, nil
}

// MustParseLabel is ParseLabel for labels written in code. It panics if the
// label is malformed.
func MustParseLabel(text string) Coord {
	c, err := ParseLabel(text)
	if err != nil {
		panic(err)
	}
	return c
}

// ParseLabels parses a list of labels, such as a recorded shot script.
func ParseLabels(texts []string) ([]Coord, error) {
	coords := make([]Coord, len(texts))
	for i, text := range texts {
		c, err := ParseLabel(text)
		if err != nil {
			return nil, err
		}
		coords[i] = c
	}
	return coords, nil
}

// OffBoardError reports a shot or a lookup that falls outside the ocean.
type OffBoardError struct {
	Coord Coord
	Size  int
}

func (e *OffBoardError) Error() string {
	return fmt.Sprintf("%v is off the %dx%d board", e.Coord, e.Size, e.Size)
}

// Ocean is a square board of size x size cells.
type Ocean struct {
	size int
}

// NewOcean returns a size x size ocean. It panics if size is outside
// MinSize..MaxSize: board sizes are chosen in code, never by players.
func NewOcean(size int) *Ocean {
	if size < MinSize || size > MaxSize {
		panic(fmt.Sprintf("armada: board size must be between %d and %d, got %d", MinSize, MaxSize, size))
	}
	return &Ocean{size: size}
}

// Size is the length of one side of the board.
func (o *Ocean) Size() int { return o.size }

// InBounds reports whether c is on the board.
func (o *Ocean) InBounds(c Coord) bool {
	return c.Row >= 0 && c.Row < o.size && c.Col >= 0 && c.Col < o.size
}

// Check returns an *OffBoardError if c is not on the board.
func (o *Ocean) Check(c Coord) error {
	if !o.InBounds(c) {
		return &OffBoardError{Coord: c, Size: o.size}
	}
	return nil
}

// Cells lists every cell, row by row from A1.
func (o *Ocean) Cells() []Coord {
	cells := make([]Coord, 0, o.size*o.size)
	for row := 0; row < o.size; row++ {
		for col := 0; col < o.size; col++ {
			cells = append(cells, Coord{row, col})
		}
	}
	return cells
}

// Neighbours lists the on-board cells directly north, south, west and east of c.
func (o *Ocean) Neighbours(c Coord) []Coord {
	around := []Coord{{c.Row - 1, c.Col}, {c.Row + 1, c.Col}, {c.Row, c.Col - 1}, {c.Row, c.Col + 1}}
	onBoard := around[:0]
	for _, n := range around {
		if o.InBounds(n) {
			onBoard = append(onBoard, n)
		}
	}
	return onBoard
}

// Render draws the board as text, calling mark for each cell's character.
func (o *Ocean) Render(mark func(Coord) string) string {
	var text strings.Builder
	text.WriteString("   ")
	for col := 0; col < o.size; col++ {
		fmt.Fprintf(&text, "%3d", col+1)
	}
	for row := 0; row < o.size; row++ {
		fmt.Fprintf(&text, "\n %c ", 'A'+row)
		for col := 0; col < o.size; col++ {
			fmt.Fprintf(&text, "%3s", mark(Coord{row, col}))
		}
	}
	return text.String()
}
