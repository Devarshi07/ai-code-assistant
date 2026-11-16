package armada

// Seeded random fleets for bot benchmarks.
//
// QA replays the same matches in the harness of every language the studio
// uses, so a seed must produce the identical fleet in all of them. No
// language's built-in random generator can promise that, so we use mulberry32:
// a tiny 32-bit generator that ports bit-for-bit.

import (
	"fmt"
	"slices"
)

const maxAttempts = 1000

// Rng is mulberry32. Same seed, same sequence, in every harness.
type Rng struct {
	state uint32
}

// NewRng returns a generator that starts from seed.
func NewRng(seed uint32) *Rng { return &Rng{state: seed} }

// NextU32 returns the next 32-bit output.
func (r *Rng) NextU32() uint32 {
	r.state += 0x6D2B79F5
	t := r.state
	t = (t ^ (t >> 15)) * (t | 1)
	t = (t + (t^(t>>7))*(t|61)) ^ t
	return t ^ (t >> 14)
}

// Below returns an integer in [0, n). The modulo bias is negligible for
// board-sized n.
func (r *Rng) Below(n int) int {
	return int(r.NextU32() % uint32(n))
}

// RandomFleet places ships largest first, each at a random spot where it fits.
// For each attempt the generator draws the orientation, then the row, then
// the column. Every other harness draws in the same order.
func RandomFleet(seed, size int, shipSizes []int) (*Fleet, error) {
	rng := NewRng(uint32(seed))
	fleet := NewFleet(NewOcean(size))
	lengths := slices.Clone(shipSizes)
	slices.Sort(lengths)
	slices.Reverse(lengths)
	for _, length := range lengths {
		if length > size {
			return nil, &PlacementError{fmt.Sprintf("a %d-cell ship cannot fit on a %dx%d board", length, size, size)}
		}
		span := size - length + 1
		placed := false
		for attempt := 0; attempt < maxAttempts && !placed; attempt++ {
			vertical := rng.Below(2) == 1
			rows, cols := size, span
			if vertical {
				rows, cols = span, size
			}
			row := rng.Below(rows)
			col := rng.Below(cols)
			if fleet.Fits(length, Coord{row, col}, vertical) {
				if _, err := fleet.Place(length, Coord{row, col}, vertical); err != nil {
					return nil, err
				}
				placed = true
			}
		}
		if !placed {
			return nil, &PlacementError{fmt.Sprintf("seed %d: no room for a %d-cell ship after %d attempts", seed, length, maxAttempts)}
		}
	}
	return fleet, nil
}
