package tests

import (
	"slices"
	"testing"
	"time"

	"debuggym/kitchen-orders/kitchen"
)

func TestPhase3Scale(t *testing.T) {
	t.Run("stadium afternoon matches reference", func(t *testing.T) {
		orders := generate(11, 4000, 16*60, 720)
		run := simulate(t, orders, stadiumMenu, stadiumLine(8, 10, 3, 2))
		var picked []int
		for _, id := range []int{1000, 1001, 1002, 4999} {
			picked = append(picked, run.Ready[id])
		}
		assertEqual(t, picked, []int{1309, 2342, 2288, 1261}, "ready minutes of orders 1000, 1001, 1002 and 4999")
		assertEqual(t, fingerprint(run), []int{4000, 7669837, 23035378252, 2918, 1099, 792208}, "fingerprint")
	})

	t.Run("burst of simultaneous orders", func(t *testing.T) {
		// 60 one-burger orders land in the same minute; every 7th is an app order.
		// Four grill cooks plate them four at a time, strictly in rank order.
		var ids []int
		var orders []kitchen.Order
		for id := 60; id >= 1; id-- {
			ids = append(ids, id)
			orders = append(orders, kitchen.Order{ID: id, Arrival: 1200, Dishes: []string{"smash burger"}, Priority: id%7 == 0})
		}
		run := simulate(t, orders, stadiumMenu, stadiumLine(4, 1, 1, 1))
		rankOf := func(id int) int {
			if id%7 == 0 {
				return 0
			}
			return 1
		}
		ranked := slices.Clone(ids)
		slices.SortFunc(ranked, func(a, b int) int {
			if rankOf(a) != rankOf(b) {
				return rankOf(a) - rankOf(b)
			}
			return a - b
		})
		expected := make(map[int]int)
		for k, id := range ranked {
			expected[id] = 1200 + 6*(k/4+1)
		}
		assertEqual(t, run.Ready, expected, "ready")
	})

	t.Run("quiet service matches the quote", func(t *testing.T) {
		// Orders 30 minutes apart never queue, so each is ready at its quote.
		var orders []kitchen.Order
		for k, o := range generate(5, 500, 0, 1) {
			due := 600 + 30*k + 5
			orders = append(orders, kitchen.Order{ID: o.ID, Arrival: 600 + 30*k, Dishes: o.Dishes, Priority: o.Priority, Due: &due})
		}
		run := simulate(t, orders, stadiumMenu, stadiumLine(4, 4, 4, 4))
		expected := make(map[int]int)
		var expectedLate []kitchen.Late
		for _, o := range orders {
			quote, err := o.Quote(stadiumMenu)
			if err != nil {
				t.Fatal(err)
			}
			expected[o.ID] = quote
			if quote > *o.Due {
				expectedLate = append(expectedLate, kitchen.Late{ID: o.ID, MinutesLate: quote - *o.Due})
			}
		}
		assertEqual(t, run.Ready, expected, "ready")
		assertEqual(t, run.Late, expectedLate, "late orders")
	})

	t.Run("game day rush is fast", func(t *testing.T) {
		orders := generate(7, 64000, 16*60, 3*24*60)
		stations := stadiumLine(37, 44, 12, 10)
		start := time.Now()
		run := simulate(t, orders, stadiumMenu, stations)
		elapsed := time.Since(start)
		assertEqual(t, fingerprint(run), []int{64000, 272343025, 8975418334516, 7643, 17775, 24585134}, "fingerprint")
		if limit := 550 * time.Millisecond; elapsed >= limit {
			t.Fatalf("took %dms; a 64,000-order game day must simulate in under %dms", elapsed.Milliseconds(), limit.Milliseconds())
		}
	})
}
