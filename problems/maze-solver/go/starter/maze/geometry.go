// Package maze checks Labyrinth levels: it parses layouts, finds routes and
// renders previews for the level editor.
package maze

import "fmt"

// Position is a tile on the map. Row 0 is the top of the map, matching the
// way level files are written.
type Position struct {
	Row, Col int
}

func (p Position) String() string {
	return fmt.Sprintf("(%d, %d)", p.Row, p.Col)
}

// Direction is a compass direction. Its String form is the letter used in
// move strings: N, E, S or W.
type Direction int

const (
	North Direction = iota
	East
	South
	West
)

// Directions lists the compass directions in the order the solver tries them.
var Directions = []Direction{North, East, South, West}

// deltas holds each direction as (row delta, col delta).
var deltas = [...][2]int{North: {-1, 0}, East: {0, 1}, South: {1, 0}, West: {0, -1}}

// Gates maps each one-way gate symbol to the single direction it allows.
var Gates = map[byte]Direction{'>': East, '<': West, '^': North, 'v': South}

func (d Direction) String() string {
	return string("NESW"[d])
}

// Step returns the neighbouring position one step from p in direction d.
func (p Position) Step(d Direction) Position {
	delta := deltas[d]
	return Position{p.Row + delta[0], p.Col + delta[1]}
}

// DirectionBetween returns the compass direction of a single step from a to
// b. It panics if the positions are not adjacent.
func DirectionBetween(a, b Position) Direction {
	for _, d := range Directions {
		if a.Step(d) == b {
			return d
		}
	}
	panic(fmt.Sprintf("maze: %v and %v are not adjacent", a, b))
}

// Manhattan returns the grid distance between a and b, ignoring walls.
func Manhattan(a, b Position) int {
	return abs(a.Row-b.Row) + abs(a.Col-b.Col)
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
