package tests

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"debuggym/inventory-packer/shipping"
)

const tablewareExport = `order_id,sku,description,weight_kg,qty,flags
A1005,GLS-WIN-04,"Wine glasses, set of 4",1.12,3,fragile
A1005,BRD-OAK-40,Oak serving board,1.9,2,
A1005,DCN-GLS-01,Glass decanter,1.35,1,fragile
A1005,NAP-LIN-06,"Linen napkins, set of 6",0.31,2,
`

// assertValidPlanOfType is assertValidPlan for a plan that must use only cartons of kind.
func assertValidPlanOfType(t *testing.T, items []shipping.Item, cartons []*shipping.Carton, kind shipping.CartonType) {
	t.Helper()
	for index, carton := range cartons {
		if carton.Type != kind {
			t.Fatalf("carton %d is the wrong carton type: %s", index+1, carton.Type.Code)
		}
	}
	assertValidPlan(t, items, cartons, kind)
}

// fewestCartons is an exhaustive search: the fewest cartons ANY legal plan
// needs. Small inputs only.
func fewestCartons(items []shipping.Item, kind shipping.CartonType) int {
	var groups [][]shipping.Item
	best := len(items)
	fits := func(group []shipping.Item, item shipping.Item) bool {
		if item.Hazmat {
			return false
		}
		weight, anyFragile := item.WeightG, item.Fragile
		for _, other := range group {
			if other.Hazmat {
				return false
			}
			weight += other.WeightG
			anyFragile = anyFragile || other.Fragile
		}
		limit := kind.MaxWeightG
		if anyFragile {
			limit = kind.FragileMaxWeightG
		}
		return weight <= limit
	}
	var place func(index int)
	place = func(index int) {
		if len(groups) >= best {
			return
		}
		if index == len(items) {
			best = len(groups)
			return
		}
		item := items[index]
		for g := 0; g < len(groups); g++ {
			if fits(groups[g], item) {
				groups[g] = append(groups[g], item)
				place(index + 1)
				groups[g] = groups[g][:len(groups[g])-1]
			}
		}
		groups = append(groups, []shipping.Item{item})
		place(index + 1)
		groups = groups[:len(groups)-1]
	}
	place(0)
	return best
}

func TestPhase2BenchRule(t *testing.T) {
	t.Run("empty order needs no cartons", func(t *testing.T) {
		if cartons := pack(t, []shipping.Item{}, shipping.Medium); len(cartons) != 0 {
			t.Fatalf("got %d cartons for an empty order, want none", len(cartons))
		}
	})

	t.Run("light order fits one carton", func(t *testing.T) {
		items := []shipping.Item{unit("A", 1200), unit("B", 800), unit("C", 450)}
		cartons := pack(t, items, shipping.Medium)
		assertPlan(t, cartons, [][]string{{"A", "B", "C"}}, "")
		assertValidPlanOfType(t, items, cartons, shipping.Medium)
	})

	t.Run("heaviest units are packed first", func(t *testing.T) {
		items := []shipping.Item{unit("A", 1000), unit("B", 1000), unit("C", 1000), unit("D", 3000), unit("E", 3000), unit("F", 1000)}
		cartons := pack(t, items, shipping.Medium)
		if len(cartons) != 2 {
			t.Fatalf("got %d cartons, want 2: packing in arrival order would need 3 cartons", len(cartons))
		}
		if fewest := fewestCartons(items, shipping.Medium); len(cartons) != fewest {
			t.Fatalf("got %d cartons, want %d", len(cartons), fewest)
		}
		assertPlan(t, cartons, [][]string{{"D", "A", "B"}, {"E", "C", "F"}}, "")
		assertValidPlanOfType(t, items, cartons, shipping.Medium)
	})

	t.Run("a carton may be filled exactly", func(t *testing.T) {
		assertPlan(t, pack(t, []shipping.Item{unit("A", 2500), unit("B", 2500)}, shipping.Medium), [][]string{{"A", "B"}}, "")
		assertPlan(t, pack(t, []shipping.Item{unit("X", 5000)}, shipping.Medium), [][]string{{"X"}}, "")
	})

	t.Run("each unit goes into the earliest carton that takes it", func(t *testing.T) {
		items := []shipping.Item{unit("A", 3000), unit("B", 2600), unit("C", 2100), unit("D", 1500), unit("E", 250)}
		cartons := pack(t, items, shipping.Medium)
		assertPlan(t, cartons, [][]string{{"A", "D", "E"}, {"B", "C"}}, "(E fits both cartons; the bench uses the earliest one)")
		assertValidPlanOfType(t, items, cartons, shipping.Medium)
	})

	t.Run("bench rule is followed even when a tighter plan exists", func(t *testing.T) {
		items := []shipping.Item{unit("P", 2500), unit("Q", 2000), unit("R", 2000), unit("S", 1500), unit("T", 1000), unit("U", 1000)}
		cartons := pack(t, items, shipping.Medium)
		if fewest := fewestCartons(items, shipping.Medium); fewest != 2 {
			t.Fatalf("fewestCartons = %d, want 2", fewest)
		}
		assertPlan(t, cartons, [][]string{{"P", "Q"}, {"R", "S", "T"}, {"U"}}, "(the bench follows its rule, so this order ships in 3 cartons)")
	})

	t.Run("equal weights keep order-line order", func(t *testing.T) {
		assertPlan(t, pack(t, []shipping.Item{unit("A", 2000), unit("B", 2000), unit("C", 2000)}, shipping.Medium), [][]string{{"A", "B"}, {"C"}}, "")
		assertPlan(t, pack(t, []shipping.Item{unit("C", 2000), unit("B", 2000), unit("A", 2000)}, shipping.Medium), [][]string{{"C", "B"}, {"A"}}, "")
	})
}

func TestPhase2PackingRules(t *testing.T) {
	t.Run("fragile unit lowers the carton limit", func(t *testing.T) {
		items := []shipping.Item{fragile(unit("VAS", 2000)), unit("BK1", 1500), unit("BK2", 1500)}
		cartons := pack(t, items, shipping.Medium)
		assertPlan(t, cartons, [][]string{{"VAS", "BK1"}, {"BK2"}}, "(a fragile carton takes at most 3,500 g)")
		if fewest := fewestCartons(items, shipping.Medium); len(cartons) != fewest {
			t.Fatalf("got %d cartons, want %d", len(cartons), fewest)
		}
		if !cartons[0].Fragile {
			t.Fatalf("carton 1 holds a fragile unit, but Fragile is false")
		}
		assertValidPlanOfType(t, items, cartons, shipping.Medium)
	})

	t.Run("fragile unit skips a carton that is already too heavy", func(t *testing.T) {
		items := []shipping.Item{unit("A", 3000), fragile(unit("G", 1000)), unit("B", 1000)}
		cartons := pack(t, items, shipping.Medium)
		assertPlan(t, cartons, [][]string{{"A", "B"}, {"G"}}, "")
		assertValidPlanOfType(t, items, cartons, shipping.Medium)
	})

	t.Run("hazmat ships alone", func(t *testing.T) {
		items := []shipping.Item{hazmat(unit("BAT1", 300)), unit("A", 400), unit("B", 500), hazmat(unit("BAT2", 200))}
		cartons := pack(t, items, shipping.Medium)
		assertPlan(t, cartons, [][]string{{"B", "A"}, {"BAT1"}, {"BAT2"}}, "")
		if fewest := fewestCartons(items, shipping.Medium); len(cartons) != fewest {
			t.Fatalf("got %d cartons, want %d", len(cartons), fewest)
		}
		assertValidPlanOfType(t, items, cartons, shipping.Medium)
	})

	t.Run("unit too heavy for the carton type is refused", func(t *testing.T) {
		refused := func(items []shipping.Item, kind shipping.CartonType, sku string) {
			t.Helper()
			_, err := shipping.PackItems(items, kind)
			var packingErr *shipping.PackingError
			if !errors.As(err, &packingErr) || !strings.Contains(err.Error(), sku) {
				t.Fatalf("PackItems error = %v; want a *PackingError naming %s", err, sku)
			}
		}
		refused([]shipping.Item{unit("A", 400), unit("ANV-01", 5200)}, shipping.Medium, "ANV-01")
		refused([]shipping.Item{fragile(unit("MIR-01", 3600))}, shipping.Medium, "MIR-01")
		if cartons := pack(t, []shipping.Item{fragile(unit("MIR-02", 3500))}, shipping.Medium); len(cartons) != 1 {
			t.Fatalf("got %d cartons for MIR-02, want 1", len(cartons))
		}
		_, err := shipping.PackItems([]shipping.Item{hazmat(unit("BAT", 2100))}, shipping.Small)
		var packingErr *shipping.PackingError
		if !errors.As(err, &packingErr) {
			t.Fatalf("PackItems error = %v; want a *PackingError", err)
		}
	})

	t.Run("caller's list is left alone", func(t *testing.T) {
		items := []shipping.Item{unit("A", 100), unit("B", 900), unit("C", 500)}
		pack(t, items, shipping.Medium)
		if got, want := skuList(items), []string{"A", "B", "C"}; !reflect.DeepEqual(got, want) {
			t.Fatalf("the caller's items are now %v, want %v", got, want)
		}
	})
}

func TestPhase2OrderPacking(t *testing.T) {
	t.Run("whole order from the export", func(t *testing.T) {
		orders, err := shipping.LoadOrders(tablewareExport)
		if err != nil || len(orders) == 0 {
			t.Fatalf("LoadOrders: %v", err)
		}
		order := orders[0]
		cartons, err := shipping.PackOrder(order, shipping.Large)
		if err != nil {
			t.Fatalf("PackOrder: %v", err)
		}
		assertPlan(t, cartons, [][]string{
			{"BRD-OAK-40", "BRD-OAK-40", "DCN-GLS-01", "GLS-WIN-04", "NAP-LIN-06", "NAP-LIN-06"},
			{"GLS-WIN-04", "GLS-WIN-04"},
		}, "")
		var weights []int
		for _, carton := range cartons {
			weights = append(weights, carton.WeightG)
		}
		if want := []int{6890, 2240}; !reflect.DeepEqual(weights, want) {
			t.Fatalf("carton weights = %v, want %v", weights, want)
		}
		assertValidPlanOfType(t, order.Units(), cartons, shipping.Large)
	})

	t.Run("random small orders are valid and repeatable", func(t *testing.T) {
		seed := int64(42)
		below := func(n int) int {
			seed = seed * 48271 % 2147483647
			return int(seed % int64(n))
		}
		kinds := []shipping.CartonType{shipping.Small, shipping.Medium, shipping.Large}
		for trial := 0; trial < 60; trial++ {
			kind := kinds[below(3)]
			var items []shipping.Item
			count := 1 + below(8)
			for n := 0; n < count; n++ {
				isHazmat := below(10) == 0
				isFragile := !isHazmat && below(10) < 3
				top := kind.MaxWeightG
				if isFragile {
					top = kind.FragileMaxWeightG
				}
				item := unit(fmt.Sprintf("T%d-%d", trial, n), 100*(1+below(top/100)))
				item.Fragile, item.Hazmat = isFragile, isHazmat
				items = append(items, item)
			}
			cartons := pack(t, items, kind)
			assertValidPlanOfType(t, items, cartons, kind)
			if fewest := fewestCartons(items, kind); len(cartons) < fewest {
				t.Fatalf("trial %d: %d cartons, but no legal plan uses fewer than %d", trial, len(cartons), fewest)
			}
			if again := skus(pack(t, items, kind)); !reflect.DeepEqual(again, skus(cartons)) {
				t.Fatalf("trial %d: same order, same plan: first %v, then %v", trial, skus(cartons), again)
			}
		}
	})
}
