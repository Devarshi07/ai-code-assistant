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

// closed is the room value for cartons nothing more may enter, and for unopened slots.
const closed = -1

// PackingError reports an item that cannot ship in the requested carton type
// at all, even on its own.
type PackingError struct {
	SKU    string // the item that cannot ship
	Reason string // for example "weighs 5,200 g; a Medium box takes at most 5,000 g"
}

func (e *PackingError) Error() string { return e.SKU + " " + e.Reason }

// roomTree is a max segment tree over carton slots, answering "leftmost slot
// with room >= need".
//
// Slots are carton positions in opening order. Both set and leftmost are
// O(log n), which keeps the bench rule's "earliest carton that fits" cheap
// even with tens of thousands of open cartons.
type roomTree struct {
	size int
	best []int
}

func newRoomTree(slots int) *roomTree {
	size := 1
	for size < max(slots, 1) {
		size *= 2
	}
	best := make([]int, 2*size)
	for i := range best {
		best[i] = closed
	}
	return &roomTree{size: size, best: best}
}

func (t *roomTree) set(slot, room int) {
	node := slot + t.size
	t.best[node] = room
	for node /= 2; node > 0; node /= 2 {
		top := max(t.best[2*node], t.best[2*node+1])
		if t.best[node] == top {
			break // nothing above this node changes either
		}
		t.best[node] = top
	}
}

// leftmost returns the index of the leftmost slot with room >= need, or -1 if none has.
func (t *roomTree) leftmost(need int) int {
	if t.best[1] < need {
		return -1
	}
	node := 1
	for node < t.size {
		node *= 2
		if t.best[node] < need {
			node++
		}
	}
	return node - t.size
}

// PackItems plans cartons of the given kind for items, following the bench rule.
//
// Bench rule (first-fit decreasing): take units heaviest first, keeping
// order-line order between equal weights, and put each one into the
// earliest-opened carton that may legally take it. Open a new carton only
// when none can.
//
// Instead of scanning every open carton per unit, two segment trees track how
// much more each carton may take: one for ordinary units (its current limit
// minus its load) and one for fragile units (the fragile limit minus its
// load). The leftmost slot with enough room is exactly the carton the scan
// would have found, so the plan is identical, in O(n log n).
//
// It returns the cartons in the order they are opened, numbered from 1. It
// returns a *PackingError if some item cannot ship in kind even on its own.
func PackItems(items []Item, kind CartonType) ([]*Carton, error) {
	for _, item := range items {
		if err := checkShippable(item, kind); err != nil {
			return nil, err
		}
	}
	ordinaryRoom, fragileRoom := newRoomTree(len(items)), newRoomTree(len(items))
	ordered := slices.Clone(items)
	slices.SortStableFunc(ordered, func(a, b Item) int { return cmp.Compare(b.WeightG, a.WeightG) })
	var cartons []*Carton
	for _, item := range ordered {
		slot := -1
		if !item.Hazmat {
			tree := ordinaryRoom
			if item.Fragile {
				tree = fragileRoom
			}
			slot = tree.leftmost(item.WeightG)
		}
		if slot < 0 {
			slot = len(cartons)
			cartons = append(cartons, NewCarton(kind, slot+1))
		}
		carton := cartons[slot]
		carton.Add(item)
		if carton.Hazmat {
			ordinaryRoom.set(slot, closed)
			fragileRoom.set(slot, closed)
		} else {
			ordinaryRoom.set(slot, carton.LimitG()-carton.WeightG)
			fragileRoom.set(slot, kind.FragileMaxWeightG-carton.WeightG)
		}
	}
	return cartons, nil
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
