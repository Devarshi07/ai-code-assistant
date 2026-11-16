package maze

// Level model: turns a designer's text layout into a queryable grid.
//
// Symbols
//
//	#   wall
//	.   floor
//	S   start tile (exactly one)
//	E   exit tile (exactly one)
//	$   gem
//	> < ^ v   one-way gates (see Level.MovesFrom)

import (
	"fmt"
	"slices"
	"strings"
)

// Tile symbols in level files.
const (
	wall  = '#'
	floor = '.'
	start = 'S'
	exit  = 'E'
	gem   = '$'
)

const symbols = "#.SE$><^v"

// LevelError reports a malformed level layout.
type LevelError struct {
	Level  string // the level's name
	Reason string
}

func (e *LevelError) Error() string {
	return e.Level + ": " + e.Reason
}

// Level is a parsed level layout.
type Level struct {
	Name   string
	Rows   []string // the layout, one string per row
	Height int
	Width  int
	Start  Position
	Exit   Position
	Gems   []Position // every gem, in reading order
}

// Parse builds a Level from a block of text, ignoring blank lines and the
// indentation around each row.
func Parse(name, text string) (*Level, error) {
	var rows []string
	for _, line := range strings.Split(text, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			rows = append(rows, line)
		}
	}
	return NewLevel(name, rows)
}

// NewLevel checks a layout and finds its start, exit and gems.
func NewLevel(name string, rows []string) (*Level, error) {
	if len(rows) == 0 || rows[0] == "" {
		return nil, &LevelError{name, "level is empty"}
	}
	width := len(rows[0])
	for _, row := range rows {
		if len(row) != width {
			return nil, &LevelError{name, "every row must have the same width"}
		}
	}
	var unknown []rune
	for _, row := range rows {
		for _, ch := range row {
			if !strings.ContainsRune(symbols, ch) && !slices.Contains(unknown, ch) {
				unknown = append(unknown, ch)
			}
		}
	}
	if len(unknown) > 0 {
		slices.Sort(unknown)
		return nil, &LevelError{name, fmt.Sprintf("unknown symbols '%s'", string(unknown))}
	}
	l := &Level{Name: name, Rows: slices.Clone(rows), Height: len(rows), Width: width}
	var err error
	if l.Start, err = l.findOne(start); err != nil {
		return nil, err
	}
	if l.Exit, err = l.findOne(exit); err != nil {
		return nil, err
	}
	l.Gems = l.findAll(gem)
	return l, nil
}

func (l *Level) findAll(symbol byte) []Position {
	var found []Position
	for r, line := range l.Rows {
		for c := 0; c < len(line); c++ {
			if line[c] == symbol {
				found = append(found, Position{r, c})
			}
		}
	}
	return found
}

func (l *Level) findOne(symbol byte) (Position, error) {
	found := l.findAll(symbol)
	if len(found) != 1 {
		return Position{}, &LevelError{l.Name, fmt.Sprintf("expected exactly one '%c', found %d", symbol, len(found))}
	}
	return found[0], nil
}

// InBounds reports whether pos lies on the map.
func (l *Level) InBounds(pos Position) bool {
	return pos.Row >= 0 && pos.Row < l.Height && pos.Col >= 0 && pos.Col < l.Width
}

// Cell returns the symbol at pos.
func (l *Level) Cell(pos Position) byte {
	return l.Rows[pos.Row][pos.Col]
}

// IsWalkable reports whether the player may stand on pos.
func (l *Level) IsWalkable(pos Position) bool {
	return l.InBounds(pos) && l.Cell(pos) != wall
}

// MovesFrom returns every position reachable in a single step from pos.
//
// Gates are one-way doors: a gate can only be entered while moving in its
// arrow's direction, and the next step must continue that way.
func (l *Level) MovesFrom(pos Position) []Position {
	allowed := Directions
	if gate, ok := Gates[l.Cell(pos)]; ok {
		allowed = []Direction{gate}
	}
	moves := make([]Position, 0, len(allowed))
	for _, direction := range allowed {
		next := pos.Step(direction)
		if !l.IsWalkable(next) {
			continue
		}
		if gate, ok := Gates[l.Cell(next)]; ok && gate != direction {
			continue
		}
		moves = append(moves, next)
	}
	return moves
}

func (l *Level) String() string {
	return fmt.Sprintf("Level(%s, %dx%d, gems=%d)", l.Name, l.Width, l.Height, len(l.Gems))
}
