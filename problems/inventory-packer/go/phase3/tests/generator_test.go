package tests

// Deterministic wholesale orders for the scale tests.

import (
	"fmt"

	"debuggym/inventory-packer/shipping"
)

// lcg is the Park-Miller "minimal standard" generator. The other language
// versions use the same one, so every version tests the same orders.
type lcg struct{ state int64 }

func newLCG(seed int64) *lcg {
	state := seed % 2147483647
	if state == 0 {
		state = 1
	}
	return &lcg{state: state}
}

func (r *lcg) below(n int) int {
	r.state = r.state * 48271 % 2147483647
	return int(r.state % int64(n))
}

// wholesaleUnits returns count units of a restock order: random catalogue
// lines, each ordered in bulk.
func wholesaleUnits(seed int64, count int) []shipping.Item {
	const catalogueSize, maxG, fragileMaxG = 400, 4900, 3400
	rng := newLCG(seed)
	catalogue := make([]shipping.Item, 0, catalogueSize)
	for n := 0; n < catalogueSize; n++ {
		roll := rng.below(100)
		isHazmat := roll < 2
		isFragile := roll >= 2 && roll < 20
		top := maxG
		if isFragile {
			top = fragileMaxG
		}
		catalogue = append(catalogue, shipping.Item{
			SKU:         fmt.Sprintf("W%04d", n),
			Description: fmt.Sprintf("wholesale line %d", n),
			WeightG:     60 + rng.below(top-59),
			Fragile:     isFragile,
			Hazmat:      isHazmat,
		})
	}
	units := make([]shipping.Item, 0, count)
	for len(units) < count {
		item := catalogue[rng.below(catalogueSize)]
		quantity := min(1+rng.below(40), count-len(units))
		for i := 0; i < quantity; i++ {
			units = append(units, item)
		}
	}
	return units
}
