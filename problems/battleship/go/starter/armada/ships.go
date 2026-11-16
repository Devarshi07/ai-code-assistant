package armada

// Ship models and fleet placement.
//
// A Fleet owns the ships on one ocean and enforces the placement rules: every
// ship is a straight horizontal or vertical line, stays on the board and never
// shares a cell with another ship. Ships may touch side by side (studio rules).

import "fmt"

// DefaultFleet lists the ship lengths of the standard fleet: carrier,
// battleship, cruiser, submarine, destroyer.
var DefaultFleet = []int{5, 4, 3, 3, 2}

// classNames gives the class names by length. A repeated length takes the
// next name on its list.
var classNames = map[int][]string{
	5: {"Carrier"}, 4: {"Battleship"}, 3: {"Cruiser", "Submarine"}, 2: {"Destroyer"}, 1: {"Patrol boat"},
}

// PlacementError reports a ship that cannot be placed where requested.
type PlacementError struct {
	Reason string
}

func (e *PlacementError) Error() string { return e.Reason }

// Ship is one ship of a fleet.
type Ship struct {
	Name   string
	Cells  []Coord
	Damage int // hits taken so far in the current battle
}

// Size is the number of cells the ship covers.
func (s *Ship) Size() int { return len(s.Cells) }

// IsSunk reports whether the ship has taken a hit for every cell.
func (s *Ship) IsSunk() bool { return s.Damage >= s.Size() }

// TakeHit records one hit on the ship.
func (s *Ship) TakeHit() { s.Damage++ }

// Fleet is the ships hidden on one ocean.
type Fleet struct {
	ocean  *Ocean
	ships  []*Ship
	byCell map[Coord]*Ship
}

// NewFleet returns an empty fleet on ocean.
func NewFleet(ocean *Ocean) *Fleet {
	return &Fleet{ocean: ocean, byCell: map[Coord]*Ship{}}
}

// Ocean is the board the fleet is hidden on.
func (f *Fleet) Ocean() *Ocean { return f.ocean }

// Ships lists the ships in placement order.
func (f *Fleet) Ships() []*Ship { return f.ships }

// Span lists the cells a ship of this length covers, starting at origin.
func Span(length int, origin Coord, vertical bool) []Coord {
	var cells []Coord
	for i := 0; i < length; i++ {
		if vertical {
			cells = append(cells, Coord{origin.Row + i, origin.Col})
		} else {
			cells = append(cells, Coord{origin.Row, origin.Col + i})
		}
	}
	return cells
}

// Fits reports whether a ship of this length fits at origin: on the board
// and clear of every other ship.
func (f *Fleet) Fits(length int, origin Coord, vertical bool) bool {
	for _, c := range Span(length, origin, vertical) {
		if !f.ocean.InBounds(c) || f.byCell[c] != nil {
			return false
		}
	}
	return true
}

// Place adds a ship whose bow is at origin, running east (or south if
// vertical), named after its class.
func (f *Fleet) Place(length int, origin Coord, vertical bool) (*Ship, error) {
	if length < 1 {
		return nil, &PlacementError{fmt.Sprintf("a ship needs at least one cell, got %d", length)}
	}
	names, ok := classNames[length]
	if !ok {
		names = []string{fmt.Sprintf("%d-cell ship", length)}
	}
	taken := 0
	for _, ship := range f.ships {
		if ship.Size() == length {
			taken++
		}
	}
	name := fmt.Sprintf("%s %d", names[len(names)-1], taken+1)
	if taken < len(names) {
		name = names[taken]
	}
	cells := Span(length, origin, vertical)
	for _, cell := range cells {
		if !f.ocean.InBounds(cell) {
			return nil, &PlacementError{fmt.Sprintf("%s at %v runs off the board", name, origin)}
		}
		if other := f.byCell[cell]; other != nil {
			return nil, &PlacementError{fmt.Sprintf("%s at %v overlaps the %s at %v", name, origin, other.Name, cell)}
		}
	}
	ship := &Ship{Name: name, Cells: cells}
	f.ships = append(f.ships, ship)
	for _, cell := range cells {
		f.byCell[cell] = ship
	}
	return ship, nil
}

// ShipAt returns the ship covering c, or nil.
func (f *Fleet) ShipAt(c Coord) *Ship { return f.byCell[c] }

// ShipSizes lists the ships' lengths in placement order.
func (f *Fleet) ShipSizes() []int {
	sizes := make([]int, len(f.ships))
	for i, ship := range f.ships {
		sizes[i] = ship.Size()
	}
	return sizes
}

// ResetDamage repairs every ship.
func (f *Fleet) ResetDamage() {
	for _, ship := range f.ships {
		ship.Damage = 0
	}
}

// Render draws the fleet as a chart: ships are lettered A, B, C... in placement order.
func (f *Fleet) Render() string {
	letters := map[*Ship]string{}
	for i, ship := range f.ships {
		letters[ship] = string(rune('A' + i))
	}
	return f.ocean.Render(func(c Coord) string {
		if ship := f.byCell[c]; ship != nil {
			return letters[ship]
		}
		return "."
	})
}
