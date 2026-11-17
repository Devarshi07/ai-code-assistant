package tests

// unit, pack, skus, assertPlan and assertValidPlan live in helpers_test.go,
// shared with the phase 2 tests.

import (
	"reflect"
	"slices"
	"testing"
	"time"

	"debuggym/inventory-packer/shipping"
)

func TestPhase3SamePlan(t *testing.T) {
	t.Run("bench rule on a tight order", func(t *testing.T) {
		items := []shipping.Item{unit("P", 2500), unit("Q", 2000), unit("R", 2000), unit("S", 1500), unit("T", 1000), unit("U", 1000)}
		assertPlan(t, pack(t, items, shipping.Medium), [][]string{{"P", "Q"}, {"R", "S", "T"}, {"U"}}, "")
	})

	t.Run("every rule on a mixed order", func(t *testing.T) {
		items := []shipping.Item{unit("DSK", 4000), fragile(unit("MIR", 3200)), fragile(unit("LMP", 1200)), unit("CAB", 900),
			hazmat(unit("BAT", 800)), fragile(unit("VAS", 500)), unit("PLG", 300)}
		cartons := pack(t, items, shipping.Medium)
		assertPlan(t, cartons, [][]string{{"DSK", "CAB"}, {"MIR", "PLG"}, {"LMP", "VAS"}, {"BAT"}}, "")
		assertValidPlan(t, items, cartons, shipping.Medium)
	})

	t.Run("equal weights keep order-line order", func(t *testing.T) {
		items := []shipping.Item{unit("Y", 3200), unit("X", 3000), unit("B", 1900), unit("A", 1900)}
		assertPlan(t, pack(t, items, shipping.Medium), [][]string{{"Y"}, {"X", "B"}, {"A"}}, "")
	})

	t.Run("restock order matches the bench plan", func(t *testing.T) {
		items := wholesaleUnits(5, 2000)
		cartons := pack(t, items, shipping.Medium)
		assertValidPlan(t, items, cartons, shipping.Medium)
		if len(cartons) != 906 {
			t.Fatalf("got %d cartons, want 906", len(cartons))
		}
		var sampled []int
		for i := 0; i < len(cartons); i += 100 {
			sampled = append(sampled, cartons[i].WeightG)
		}
		if want := []int{4879, 4868, 4839, 3175, 4960, 3488, 4989, 3350, 4969, 3335}; !reflect.DeepEqual(sampled, want) {
			t.Fatalf("weights of every 100th carton = %v, want %v", sampled, want)
		}
		fragileCartons, hazmatCartons := 0, 0
		for _, carton := range cartons {
			if carton.Fragile {
				fragileCartons++
			}
			if carton.Hazmat {
				hazmatCartons++
			}
		}
		if fragileCartons != 205 {
			t.Fatalf("got %d fragile cartons, want 205", fragileCartons)
		}
		if hazmatCartons != 60 {
			t.Fatalf("got %d hazmat cartons, want 60", hazmatCartons)
		}
		assertPlan(t, cartons[len(cartons)-2:], [][]string{slices.Repeat([]string{"W0308"}, 8), slices.Repeat([]string{"W0011"}, 8)}, "(the last two cartons)")
	})
}

func TestPhase3Scale(t *testing.T) {
	t.Run("large restock order is fast", func(t *testing.T) {
		const limit = 350 * time.Millisecond
		items := wholesaleUnits(11, 60000)
		start := time.Now()
		cartons, err := shipping.PackItems(items, shipping.Medium)
		elapsed := time.Since(start)
		if err != nil {
			t.Fatalf("PackItems: %v", err)
		}
		assertValidPlan(t, items, cartons, shipping.Medium)
		if len(cartons) != 33233 {
			t.Fatalf("got %d cartons, want 33233", len(cartons))
		}
		if elapsed >= limit {
			t.Fatalf("took %dms; a 60,000-unit order must plan in under %dms", elapsed.Milliseconds(), limit.Milliseconds())
		}
	})
}
