// Carton types stocked at the pack benches, and cartons being filled.

package shipping

import (
	"cmp"
	"fmt"
	"slices"
	"strings"
)

// CartonType is a carton size stocked at the pack benches.
type CartonType struct {
	Code string
	Name string
	// MaxWeightG is the carrier limit for the contents of one carton.
	MaxWeightG int
	// FragileMaxWeightG is the lower limit once fragile padding goes in.
	FragileMaxWeightG int
}

// The stocked carton types.
var (
	Small  = CartonType{Code: "S", Name: "Small box", MaxWeightG: 2000, FragileMaxWeightG: 1500}
	Medium = CartonType{Code: "M", Name: "Medium box", MaxWeightG: 5000, FragileMaxWeightG: 3500}
	Large  = CartonType{Code: "L", Name: "Large box", MaxWeightG: 10000, FragileMaxWeightG: 7000}
)

// CartonTypes returns every stocked carton type.
func CartonTypes() []CartonType {
	return []CartonType{Small, Medium, Large}
}

// CartonTypeFor returns the stocked carton type with this code, ignoring case.
func CartonTypeFor(code string) (CartonType, error) {
	var codes []string
	for _, kind := range CartonTypes() {
		if strings.EqualFold(kind.Code, code) {
			return kind, nil
		}
		codes = append(codes, kind.Code)
	}
	return CartonType{}, fmt.Errorf("unknown carton type %q; stocked: %s", code, strings.Join(codes, ", "))
}

// SmallestCartonFor returns the smallest stocked carton type that holds
// weightG in one carton. The second result is false when none is big enough.
func SmallestCartonFor(weightG int, fragile bool) (CartonType, bool) {
	kinds := CartonTypes()
	slices.SortFunc(kinds, func(a, b CartonType) int { return cmp.Compare(a.MaxWeightG, b.MaxWeightG) })
	for _, kind := range kinds {
		limit := kind.MaxWeightG
		if fragile {
			limit = kind.FragileMaxWeightG
		}
		if weightG <= limit {
			return kind, true
		}
	}
	return CartonType{}, false
}

// Carton is a carton at the pack bench.
//
// Carton only keeps the books. Deciding what may go in which carton is the
// packer's job (see packer.go).
type Carton struct {
	Type    CartonType
	Number  int    // 1-based position in the shipment
	Items   []Item // in the order they were packed
	WeightG int
	Fragile bool // holds at least one fragile item
	Hazmat  bool // holds a hazmat item
}

// NewCarton returns an empty carton of the given type.
func NewCarton(kind CartonType, number int) *Carton {
	return &Carton{Type: kind, Number: number}
}

// LimitG is the most the contents may weigh, given what is already inside.
func (c *Carton) LimitG() int {
	if c.Fragile {
		return c.Type.FragileMaxWeightG
	}
	return c.Type.MaxWeightG
}

// RemainingG is how much more the carton may take, by weight.
func (c *Carton) RemainingG() int {
	return c.LimitG() - c.WeightG
}

// Add puts an item in the carton and keeps its weight and flags up to date.
func (c *Carton) Add(item Item) {
	c.Items = append(c.Items, item)
	c.WeightG += item.WeightG
	c.Fragile = c.Fragile || item.Fragile
	c.Hazmat = c.Hazmat || item.Hazmat
}

func (c *Carton) String() string {
	return fmt.Sprintf("Carton(%s#%d, %d items, %d g)", c.Type.Code, c.Number, len(c.Items), c.WeightG)
}
