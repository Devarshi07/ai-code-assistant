package tests

import (
	"errors"
	"os"
	"testing"

	"debuggym/kitchen-orders/kitchen"
)

var (
	menu = mustMenu()
	line = []kitchen.Station{{Name: "grill", Cooks: 1}, {Name: "fryer", Cooks: 1}, {Name: "salad", Cooks: 1}}
)

const noon = 12 * 60

func mustMenu() *kitchen.Menu {
	menu, err := kitchen.NewMenu([]kitchen.MenuItem{
		{Name: "burger", Station: "grill", Prep: 6},
		{Name: "steak", Station: "grill", Prep: 10},
		{Name: "fries", Station: "fryer", Prep: 4},
		{Name: "rings", Station: "fryer", Prep: 5},
		{Name: "salad", Station: "salad", Prep: 3},
	})
	if err != nil {
		panic(err)
	}
	return menu
}

func order(id, arrival int, dishes ...string) kitchen.Order {
	return kitchen.Order{ID: id, Arrival: arrival, Dishes: dishes}
}

func app(id, arrival int, dishes ...string) kitchen.Order {
	return kitchen.Order{ID: id, Arrival: arrival, Dishes: dishes, Priority: true}
}

func promised(id, arrival, due int, dishes ...string) kitchen.Order {
	return kitchen.Order{ID: id, Arrival: arrival, Dishes: dishes, Due: &due}
}

func simulate(t *testing.T, orders []kitchen.Order, menu *kitchen.Menu, stations []kitchen.Station) kitchen.Run {
	t.Helper()
	run, err := kitchen.Simulate(orders, menu, stations)
	if err != nil {
		t.Fatalf("Simulate: %v", err)
	}
	return run
}

func TestPhase2Simulation(t *testing.T) {
	t.Run("single order is ready when its last dish finishes", func(t *testing.T) {
		run := simulate(t, []kitchen.Order{order(1, noon, "burger", "fries", "salad")}, menu, line)
		assertEqual(t, run.Ready, map[int]int{1: noon + 6}, "ready")
		assertEqual(t, len(run.Late), 0, "number of late orders")
	})

	t.Run("one cook works through the queue in arrival order", func(t *testing.T) {
		orders := []kitchen.Order{order(1, noon, "steak"), order(2, noon+1, "burger"), order(3, noon+2, "burger")}
		assertEqual(t, simulate(t, orders, menu, line).Ready, map[int]int{1: noon + 10, 2: noon + 16, 3: noon + 22}, "ready")
	})

	t.Run("app orders jump the queue", func(t *testing.T) {
		orders := []kitchen.Order{order(1, noon, "steak"), order(2, noon+1, "burger"), app(3, noon+5, "burger")}
		assertEqual(t, simulate(t, orders, menu, line).Ready, map[int]int{1: noon + 10, 2: noon + 22, 3: noon + 16}, "ready")
	})

	t.Run("same-minute ties go to the lower order id", func(t *testing.T) {
		orders := []kitchen.Order{order(7, noon, "burger"), order(4, noon, "steak")}
		assertEqual(t, simulate(t, orders, menu, line).Ready, map[int]int{4: noon + 10, 7: noon + 16}, "ready")
	})

	t.Run("dishes on one ticket cook in ticket order", func(t *testing.T) {
		orders := []kitchen.Order{order(7, noon, "steak", "burger"), app(8, noon+5, "burger")}
		assertEqual(t, simulate(t, orders, menu, line).Ready, map[int]int{7: noon + 22, 8: noon + 16}, "ready")
	})

	t.Run("cook who finishes can take a dish arriving that minute", func(t *testing.T) {
		orders := []kitchen.Order{order(1, noon, "steak"), order(2, noon+2, "burger"), app(3, noon+10, "burger")}
		assertEqual(t, simulate(t, orders, menu, line).Ready, map[int]int{1: noon + 10, 2: noon + 22, 3: noon + 16}, "ready")
	})

	t.Run("cooks on a station work side by side", func(t *testing.T) {
		twoOnGrill := []kitchen.Station{{Name: "grill", Cooks: 2}, {Name: "fryer", Cooks: 1}, {Name: "salad", Cooks: 1}}
		orders := []kitchen.Order{order(1, noon, "steak", "burger", "burger"), order(2, noon+1, "burger")}
		assertEqual(t, simulate(t, orders, menu, twoOnGrill).Ready, map[int]int{1: noon + 12, 2: noon + 16}, "ready")
	})

	t.Run("kitchen idles until the next order", func(t *testing.T) {
		orders := []kitchen.Order{order(3, 23*60+55, "steak"), order(1, noon, "burger"), order(2, noon+30, "burger", "salad")}
		assertEqual(t, simulate(t, orders, menu, line).Ready, map[int]int{1: noon + 6, 2: noon + 36, 3: 24*60 + 5}, "ready")
	})

	t.Run("late orders report minutes late", func(t *testing.T) {
		orders := []kitchen.Order{
			promised(1, noon, noon+10, "steak"),
			promised(3, noon+1, noon+3, "fries"),
			promised(2, noon, noon+12, "burger"),
			order(4, noon+2, "burger"),
		}
		run := simulate(t, orders, menu, line)
		assertEqual(t, run.Ready, map[int]int{1: noon + 10, 2: noon + 16, 3: noon + 5, 4: noon + 22}, "ready")
		assertEqual(t, run.Late, []kitchen.Late{{ID: 2, MinutesLate: 4}, {ID: 3, MinutesLate: 2}},
			"late orders (finishing exactly on the due minute is on time)")
	})

	t.Run("unknown dish is rejected", func(t *testing.T) {
		_, err := kitchen.Simulate([]kitchen.Order{order(1, noon, "lobster")}, menu, line)
		var menuErr *kitchen.MenuError
		if !errors.As(err, &menuErr) {
			t.Fatalf("got error %v, want a *MenuError", err)
		}
	})
}

func TestPhase2Services(t *testing.T) {
	t.Run("saturday lunch", func(t *testing.T) {
		text, err := os.ReadFile(lunchLog)
		if err != nil {
			t.Fatal(err)
		}
		orders := mustLog(t, string(text))
		run := simulate(t, orders, kitchen.HouseMenu, kitchen.HouseLine)
		assertEqual(t, run.Ready, map[int]int{
			101: 707, 102: 709, 103: 715, 104: 721, 105: 749, 106: 728, 107: 736, 108: 753, 109: 736,
			110: 732, 111: 762, 112: 745, 113: 745, 114: 767, 115: 778, 116: 790, 117: 798, 118: 811,
		}, "ready")
		assertEqual(t, run.Late, []kitchen.Late{{ID: 108, MinutesLate: 13}, {ID: 111, MinutesLate: 7}}, "late orders")
	})

	t.Run("busy dinner service", func(t *testing.T) {
		orders := generate(3, 300, 18*60, 240)
		run := simulate(t, orders, stadiumMenu, stadiumLine(3, 3, 1, 1))
		var picked []int
		for _, id := range []int{1000, 1001, 1002, 1299} {
			picked = append(picked, run.Ready[id])
		}
		assertEqual(t, picked, []int{1267, 1438, 1174, 1085}, "ready minutes of orders 1000, 1001, 1002 and 1299")
		assertEqual(t, fingerprint(run), []int{300, 390664, 448924524, 1556, 63, 7199}, "fingerprint")
	})
}
