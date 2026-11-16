// Plans which carton each unit of an order goes into.
//
// Packing rules agreed with the carriers:
//
//  1. The contents of a carton weigh at most kind.MaxWeightG.
//  2. Once a carton holds a fragile item, its contents weigh at most
//     kind.FragileMaxWeightG (the padding needs the headroom).
//  3. A hazmat item ships alone: nothing else goes in its carton.

package shipping

import "errors"

// PackingError reports an item that cannot ship in the requested carton type
// at all, even on its own.
type PackingError struct {
	SKU    string // the item that cannot ship
	Reason string // for example "weighs 5,200 g; a Medium box takes at most 5,000 g"
}

func (e *PackingError) Error() string { return e.SKU + " " + e.Reason }

// PackItems plans cartons of the given kind for items, following the bench rule.
//
// It returns the cartons in the order they are opened, numbered from 1. It
// returns a *PackingError if some item cannot ship in kind even on its own.
func PackItems(items []Item, kind CartonType) ([]*Carton, error) {
	return nil, errors.New("phase 2: PackItems is not implemented yet")
}

// PackOrder plans cartons for every unit of an order.
func PackOrder(order *Order, kind CartonType) ([]*Carton, error) {
	return PackItems(order.Units(), kind)
}
