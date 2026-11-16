// Plans which carton each unit of an order goes into.
//
// Packing rules agreed with the carriers:
//
//  1. The contents of a carton weigh at most kind.MaxWeightG.
//  2. Once a carton holds a fragile item, its contents weigh at most
//     kind.FragileMaxWeightG (the padding needs the headroom).
//  3. A hazmat item ships alone: nothing else goes in its carton.

package shipping

import (
	"cmp"
	"fmt"
	"slices"
)

// PackingError reports an item that cannot ship in the requested carton type
// at all, even on its own.
type PackingError struct {
	SKU    string // the item that cannot ship
	Reason string // for example "weighs 5,200 g; a Medium box takes at most 5,000 g"
}

func (e *PackingError) Error() string { return e.SKU + " " + e.Reason }

// PackItems plans cartons of the given kind for items, following the bench rule.
//
// Bench rule (first-fit decreasing): take units heaviest first, keeping
// order-line order between equal weights, and put each one into the
// earliest-opened carton that may legally take it. Open a new carton only
// when none can.
//
// It returns the cartons in the order they are opened, numbered from 1. It
// returns a *PackingError if some item cannot ship in kind even on its own.
func PackItems(items []Item, kind CartonType) ([]*Carton, error) {
	for _, item := range items {
		if err := checkShippable(item, kind); err != nil {
			return nil, err
		}
	}
	ordered := slices.Clone(items)
	slices.SortStableFunc(ordered, func(a, b Item) int { return cmp.Compare(b.WeightG, a.WeightG) })
	var cartons []*Carton
	for _, item := range ordered {
		var carton *Carton
		for _, open := range cartons {
			if canTake(open, item) {
				carton = open
				break
			}
		}
		if carton == nil {
			carton = NewCarton(kind, len(cartons)+1)
			cartons = append(cartons, carton)
		}
		carton.Add(item)
	}
	return cartons, nil
}

// canTake reports whether the packing rules allow item into carton as it stands.
func canTake(carton *Carton, item Item) bool {
	if carton.Hazmat || item.Hazmat {
		return false
	}
	limit := carton.Type.MaxWeightG
	if carton.Fragile || item.Fragile {
		limit = carton.Type.FragileMaxWeightG
	}
	return carton.WeightG+item.WeightG <= limit
}

// checkShippable returns a *PackingError if item is too heavy for kind even alone.
func checkShippable(item Item, kind CartonType) error {
	limit, note := kind.MaxWeightG, ""
	if item.Fragile {
		limit, note = kind.FragileMaxWeightG, " when fragile"
	}
	if item.WeightG > limit {
		return &PackingError{SKU: item.SKU, Reason: fmt.Sprintf("weighs %s; a %s takes at most %s%s",
			FormatGrams(item.WeightG), kind.Name, FormatGrams(limit), note)}
	}
	return nil
}

// PackOrder plans cartons for every unit of an order.
func PackOrder(order *Order, kind CartonType) ([]*Carton, error) {
	return PackItems(order.Units(), kind)
}
