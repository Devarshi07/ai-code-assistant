// Package shipping is the Riverside fulfilment centre's shipping service. It
// reads the WMS order export, plans which carton every unit goes into and
// prints the manifest the pack bench works from.
package shipping

import (
	"errors"
	"fmt"
)

// Item is one sellable unit as listed in the catalogue.
//
// WeightG is the packed weight of a single unit, in whole grams. Fragile items
// need padding, which lowers the load a carton may carry. Hazmat items
// (batteries, aerosols, solvents) ship in a carton of their own.
type Item struct {
	SKU         string
	Description string
	WeightG     int
	Fragile     bool
	Hazmat      bool
}

// NewItem returns an item after checking that it has a SKU and weighs at least 1 g.
func NewItem(sku, description string, weightG int, fragile, hazmat bool) (Item, error) {
	if sku == "" {
		return Item{}, errors.New("an item needs a SKU")
	}
	if weightG < 1 {
		return Item{}, fmt.Errorf("%s: weight must be a whole number of grams, at least 1", sku)
	}
	return Item{SKU: sku, Description: description, WeightG: weightG, Fragile: fragile, Hazmat: hazmat}, nil
}

// Flags lists the item's handling flags: "fragile", "hazmat", both or neither.
func (it Item) Flags() []string {
	var flags []string
	if it.Fragile {
		flags = append(flags, "fragile")
	}
	if it.Hazmat {
		flags = append(flags, "hazmat")
	}
	return flags
}

// OrderLine is one line of an order: a catalogue item and how many units of it.
type OrderLine struct {
	Item     Item
	Quantity int
}

// WeightG is the weight of every unit on the line.
func (l OrderLine) WeightG() int {
	return l.Item.WeightG * l.Quantity
}

// Order is a customer order: its lines, in the order the export listed them.
type Order struct {
	ID    string
	Lines []OrderLine
}

// Units returns one entry per physical unit to pack, in order-line order.
func (o *Order) Units() []Item {
	var units []Item
	for _, line := range o.Lines {
		for i := 0; i < line.Quantity; i++ {
			units = append(units, line.Item)
		}
	}
	return units
}

// UnitCount is the number of units in the order.
func (o *Order) UnitCount() int {
	count := 0
	for _, line := range o.Lines {
		count += line.Quantity
	}
	return count
}

// TotalWeightG is the weight of the whole order.
func (o *Order) TotalWeightG() int {
	total := 0
	for _, line := range o.Lines {
		total += line.WeightG()
	}
	return total
}

// HasFragile reports whether any line is fragile.
func (o *Order) HasFragile() bool {
	for _, line := range o.Lines {
		if line.Item.Fragile {
			return true
		}
	}
	return false
}

// HasHazmat reports whether any line is hazmat.
func (o *Order) HasHazmat() bool {
	for _, line := range o.Lines {
		if line.Item.Hazmat {
			return true
		}
	}
	return false
}
