package tests

// Seeded service generator for the larger simulation tests.
//
// It uses a Park-Miller LCG, so every language's suite builds exactly the same
// services from the same seed.

import (
	"debuggym/kitchen-orders/kitchen"
)

var stadiumMenu = mustStadiumMenu()

var dishes = func() []string {
	var names []string
	for _, item := range stadiumMenu.Items() {
		names = append(names, item.Name)
	}
	return names
}()

func mustStadiumMenu() *kitchen.Menu {
	menu, err := kitchen.NewMenu([]kitchen.MenuItem{
		{Name: "smash burger", Station: "grill", Prep: 6},
		{Name: "bratwurst", Station: "grill", Prep: 4},
		{Name: "chicken wrap", Station: "grill", Prep: 5},
		{Name: "fries", Station: "fryer", Prep: 4},
		{Name: "wings", Station: "fryer", Prep: 8},
		{Name: "tenders", Station: "fryer", Prep: 6},
		{Name: "pretzel", Station: "oven", Prep: 3},
		{Name: "pizza slice", Station: "oven", Prep: 2},
		{Name: "caesar salad", Station: "salad", Prep: 3},
		{Name: "fruit cup", Station: "salad", Prep: 1},
	})
	if err != nil {
		panic(err)
	}
	return menu
}

func stadiumLine(grill, fryer, oven, salad int) []kitchen.Station {
	return []kitchen.Station{{Name: "grill", Cooks: grill}, {Name: "fryer", Cooks: fryer}, {Name: "oven", Cooks: oven}, {Name: "salad", Cooks: salad}}
}

// lcg is a Park-Miller "minimal standard" generator; below(n) returns 0..n-1.
type lcg int64

func newLCG(seed int64) *lcg {
	const mod = 2147483647
	state := seed % mod
	if state == 0 {
		state = 1
	}
	l := lcg(state)
	return &l
}

func (l *lcg) below(n int) int {
	const mod = 2147483647
	*l = lcg((int64(*l) * 48271) % mod)
	return int(int64(*l) % int64(n))
}

// generate makes count orders rung in uniformly over minutes minutes from minute
// opens. Ids are unique but unrelated to arrival, and the list is not sorted.
func generate(seed int64, count, opens, minutes int) []kitchen.Order {
	const appPercent, duePercent = 20, 35
	random := newLCG(seed)
	orders := make([]kitchen.Order, 0, count)
	for k := 0; k < count; k++ {
		arrival := opens + random.below(minutes)
		size := 1 + random.below(4)
		names := make([]string, 0, size)
		for d := 0; d < size; d++ {
			names = append(names, dishes[random.below(len(dishes))])
		}
		priority := random.below(100) < appPercent
		promised := random.below(100) < duePercent
		wait := 12 + random.below(30)
		var due *int
		if priority || promised {
			minute := arrival + wait
			due = &minute
		}
		orders = append(orders, kitchen.Order{ID: 1000 + k, Arrival: arrival, Dishes: names, Priority: priority, Due: due})
	}
	return orders
}

// fingerprint summarises a run in a way any correct simulation reproduces
// exactly: orders, sum of ready minutes, sum of id times minute, last plate,
// late orders and total minutes late.
func fingerprint(run kitchen.Run) []int {
	total, weighted, last := 0, 0, -1<<62
	for id, minute := range run.Ready {
		total += minute
		weighted += id * minute
		last = max(last, minute)
	}
	lateMinutes := 0
	for _, entry := range run.Late {
		lateMinutes += entry.MinutesLate
	}
	return []int{len(run.Ready), total, weighted, last, len(run.Late), lateMinutes}
}
