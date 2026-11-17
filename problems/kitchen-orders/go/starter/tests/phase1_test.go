package tests

import (
	"errors"
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"

	"debuggym/kitchen-orders/kitchen"
)

// The helpers in this file are shared by every test file in the package.

const lunchLog = "../data/saturday_lunch.txt"

const rush = `
# printed in the order the tickets came in
11:50am order 1: burger
12:05pm order 2: fries
12:40pm order 3: house salad
1:10pm order 4: margherita
`

// assertEqual stops the test when got and want differ.
func assertEqual(t *testing.T, got, want any, what string) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("%s: got %v, want %v", what, got, want)
	}
}

func mustClock(t *testing.T, stamp string) int {
	t.Helper()
	minutes, err := kitchen.ParseClock(stamp)
	if err != nil {
		t.Fatalf("ParseClock(%q): %v", stamp, err)
	}
	return minutes
}

func mustLog(t *testing.T, text string) []kitchen.Order {
	t.Helper()
	orders, err := kitchen.ParseLog(text)
	if err != nil {
		t.Fatalf("ParseLog: %v", err)
	}
	return orders
}

func ids(orders []kitchen.Order) []int {
	out := make([]int, len(orders))
	for i, order := range orders {
		out[i] = order.ID
	}
	return out
}

func intPtr(n int) *int { return &n }

func TestPhase1Clock(t *testing.T) {
	t.Run("morning stamps", func(t *testing.T) {
		assertEqual(t, mustClock(t, "7:00am"), 420, "7:00am")
		assertEqual(t, mustClock(t, "9:05am"), 545, "9:05am")
		assertEqual(t, mustClock(t, "11:59am"), 719, "11:59am")
	})

	t.Run("afternoon and evening stamps", func(t *testing.T) {
		assertEqual(t, mustClock(t, "1:15pm"), 795, "1:15pm")
		assertEqual(t, mustClock(t, "6:30PM"), 1110, "6:30PM")
		assertEqual(t, mustClock(t, "11:45pm"), 1425, "11:45pm")
	})

	t.Run("noon hour is midday", func(t *testing.T) {
		assertEqual(t, mustClock(t, "12:00pm"), 720, "12:00pm")
		assertEqual(t, mustClock(t, "12:41pm"), 761, "12:41pm")
	})

	t.Run("every minute of the day round trips", func(t *testing.T) {
		for minute := 0; minute < 24*60; minute++ {
			stamp := kitchen.FormatClock(minute)
			got, err := kitchen.ParseClock(stamp)
			if err != nil || got != minute {
				t.Fatalf("%s should parse back to minute %d, got %d (err %v)", stamp, minute, got, err)
			}
		}
	})

	t.Run("malformed stamps are rejected", func(t *testing.T) {
		for _, stamp := range []string{"13:05pm", "9:5am", "12:60pm", "0:30am", "noon", "1205"} {
			_, err := kitchen.ParseClock(stamp)
			var clockErr *kitchen.ClockError
			if !errors.As(err, &clockErr) {
				t.Fatalf("ParseClock(%q): got error %v, want a *ClockError", stamp, err)
			}
		}
	})
}

func TestPhase1Tickets(t *testing.T) {
	t.Run("ticket with portions and flags", func(t *testing.T) {
		order, err := kitchen.ParseTicket("11:31am order 15: Caesar Salad, 2x fries | app | due 11:55am", 1)
		if err != nil {
			t.Fatal(err)
		}
		assertEqual(t, order.ID, 15, "id")
		assertEqual(t, order.Arrival, 691, "arrival")
		assertEqual(t, order.Dishes, []string{"caesar salad", "fries", "fries"}, "dishes")
		assertEqual(t, order.Priority, true, "priority")
		assertEqual(t, order.Due, intPtr(715), "due")
	})

	t.Run("rail is in arrival order", func(t *testing.T) {
		orders := mustLog(t, rush)
		assertEqual(t, ids(orders), []int{1, 2, 3, 4}, "ids")
		arrivals := make([]int, len(orders))
		for i, order := range orders {
			arrivals[i] = order.Arrival
		}
		assertEqual(t, arrivals, []int{710, 725, 760, 790}, "arrivals")
	})

	t.Run("same-minute tickets keep printer order", func(t *testing.T) {
		orders := mustLog(t, "10:15am order 9: fries\n10:15am order 3: burger\n10:05am order 5: wings\n")
		assertEqual(t, ids(orders), []int{5, 9, 3}, "ids")
	})

	t.Run("bad lines report their line number", func(t *testing.T) {
		_, err := kitchen.ParseLog("10:15am order 1: fries\n10:16am order 2: burger | rush\n")
		var ticketErr *kitchen.TicketError
		if !errors.As(err, &ticketErr) || ticketErr.LineNumber != 2 {
			t.Fatalf("got error %v, want a *TicketError for line 2", err)
		}
		_, err = kitchen.ParseLog("10:15am order 1: fries\n10:20am order 1: burger\n")
		if !errors.As(err, &ticketErr) {
			t.Fatalf("duplicate id: got error %v, want a *TicketError", err)
		}
	})
}

func TestPhase1Quotes(t *testing.T) {
	t.Run("quote is arrival plus slowest dish", func(t *testing.T) {
		order := kitchen.Order{ID: 7, Arrival: 600, Dishes: []string{"fries", "steak frites", "house salad"}}
		quote, err := order.Quote(kitchen.HouseMenu)
		if err != nil {
			t.Fatal(err)
		}
		assertEqual(t, quote, 614, "quote")
	})

	t.Run("lunch quotes stay on the same day", func(t *testing.T) {
		text, err := os.ReadFile(lunchLog)
		if err != nil {
			t.Fatal(err)
		}
		orders := mustLog(t, string(text))
		assertEqual(t, len(orders), 18, "number of orders")
		for _, order := range orders {
			quote, err := order.Quote(kitchen.HouseMenu)
			if err != nil {
				t.Fatal(err)
			}
			wait := quote - order.Arrival
			if order.Arrival < 660 || order.Arrival > 840 {
				t.Fatalf("order %d was rung in at %s, not during lunch", order.ID, kitchen.FormatClock(order.Arrival))
			}
			if wait > 14 {
				t.Fatalf("order %d quotes a %d-minute wait", order.ID, wait)
			}
			if order.Due != nil && *order.Due-order.Arrival >= 60 {
				t.Fatalf("order %d has an odd due time", order.ID)
			}
		}
	})
}

func TestPhase1Report(t *testing.T) {
	t.Run("report shows lateness and station load", func(t *testing.T) {
		orders := []kitchen.Order{
			{ID: 1, Arrival: 600, Dishes: []string{"burger", "fries"}},
			{ID: 2, Arrival: 602, Dishes: []string{"house salad"}, Priority: true, Due: intPtr(610)},
			{ID: 3, Arrival: 603, Dishes: []string{"burger"}, Due: intPtr(612)},
		}
		run := kitchen.Run{
			Ready: map[int]int{1: 607, 2: 605, 3: 616},
			Late:  []kitchen.Late{{ID: 3, MinutesLate: 4}},
		}
		text, err := kitchen.ServiceReport("Test", orders, kitchen.HouseMenu, kitchen.HouseLine, run)
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range []string{"3 orders, 4 dishes", "LATE 4m", "on time, app", "1 of 2 promised orders late"} {
			if !strings.Contains(text, want) {
				t.Fatalf("report is missing %q:\n%s", want, text)
			}
		}
		if !regexp.MustCompile(`grill\s+2\s+2\s+14m\s+44%`).MatchString(text) {
			t.Fatalf("report has no grill row with 2 cooks, 2 dishes, 14m and 44%%:\n%s", text)
		}
	})
}
