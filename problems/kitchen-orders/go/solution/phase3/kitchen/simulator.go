package kitchen

// Kitchen simulation: when will each order really be ready?
//
// The host-stand quote (Order.Quote) assumes every station is idle. On a busy
// service, dishes queue at their station behind other tickets, so expo needs a
// simulation of the line.
//
// House rules, as agreed with the head chef:
//
//  1. When an order arrives, each of its dishes joins the queue of its station.
//  2. A station has Cooks identical cooks. A cook makes one dish at a time,
//     start to finish, which takes the dish's prep minutes.
//  3. A free cook always takes the waiting dish that ranks first: delivery-app
//     orders before everything else, then the earliest order arrival, then the
//     lowest order id, then the dish's position on its ticket.
//  4. Everything that happens in a minute (cooks finishing, orders arriving)
//     counts before free cooks pick their next dish in that minute. A cook who
//     finishes at 12:10pm can start another dish at 12:10pm.
//  5. An order is ready when its last dish is finished.

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"slices"
	"sort"
)

// ErrNotImplemented is returned by the parts of the kitchen that are not built yet.
var ErrNotImplemented = errors.New("not implemented")

// Late is an order that was ready after its promised time.
type Late struct {
	ID          int
	MinutesLate int
}

// Run is the outcome of one simulated service.
type Run struct {
	Ready map[int]int // order id -> minute its last dish finished
	Late  []Late      // late orders, ascending id
}

// dish is a dish waiting at a station.
type dish struct {
	priority bool
	arrival  int
	orderID  int
	position int
	prep     int
}

// ranksAhead reports whether waiting dish a ranks ahead of b under the house rules.
func ranksAhead(a, b dish) bool {
	if a.priority != b.priority {
		return a.priority
	}
	if a.arrival != b.arrival {
		return a.arrival < b.arrival
	}
	if a.orderID != b.orderID {
		return a.orderID < b.orderID
	}
	return a.position < b.position
}

// heap is a binary min-heap ordered by a "comes first" predicate.
type heap[T any] struct {
	items  []T
	before func(a, b T) bool // true when a should pop before b
}

func (h *heap[T]) len() int { return len(h.items) }

func (h *heap[T]) peek() T { return h.items[0] }

func (h *heap[T]) push(value T) {
	h.items = append(h.items, value)
	index := len(h.items) - 1
	for index > 0 {
		parent := (index - 1) / 2
		if !h.before(value, h.items[parent]) {
			break
		}
		h.items[index] = h.items[parent]
		index = parent
	}
	h.items[index] = value
}

func (h *heap[T]) pop() T {
	top := h.items[0]
	last := h.items[len(h.items)-1]
	h.items = h.items[:len(h.items)-1]
	n := len(h.items)
	if n == 0 {
		return top
	}
	index := 0
	for {
		child := 2*index + 1
		if child >= n {
			break
		}
		if child+1 < n && h.before(h.items[child+1], h.items[child]) {
			child++
		}
		if !h.before(h.items[child], last) {
			break
		}
		h.items[index] = h.items[child]
		index = child
	}
	h.items[index] = last
	return top
}

// Simulate runs the service described by orders through the kitchen line.
//
// menu.Get(name) gives a dish's MenuItem (or a *MenuError), and stations lists
// the Station values of the line. Orders may be given in any order.
//
// Stations never share cooks or dishes, so each one is simulated on its own as
// a discrete-event loop (see runStation). An order's ready time is the latest
// finish over all of its dishes. O(D log D) for D dishes.
func Simulate(orders []Order, menu *Menu, stations []Station) (Run, error) {
	tickets := make(map[string][]dish) // every dish bound for each station
	for _, station := range stations {
		tickets[station.Name] = nil
	}
	for _, order := range orders {
		for position, name := range order.Dishes {
			item, err := menu.Get(name)
			if err != nil {
				return Run{}, err
			}
			if _, ok := tickets[item.Station]; !ok {
				return Run{}, fmt.Errorf("%q needs station %q, which is not on the line", name, item.Station)
			}
			tickets[item.Station] = append(tickets[item.Station], dish{order.Priority, order.Arrival, order.ID, position, item.Prep})
		}
	}

	ready := make(map[int]int)
	for _, station := range stations {
		dishes := tickets[station.Name]
		slices.SortFunc(dishes, func(a, b dish) int { return cmp.Compare(a.arrival, b.arrival) })
		runStation(dishes, station.Cooks, ready)
	}

	var late []Late
	for _, order := range orders {
		if order.Due != nil && ready[order.ID] > *order.Due {
			late = append(late, Late{ID: order.ID, MinutesLate: ready[order.ID] - *order.Due})
		}
	}
	sort.Slice(late, func(i, j int) bool { return late[i].ID < late[j].ID })
	return Run{Ready: ready, Late: late}, nil
}

// runStation simulates one station. dishes is sorted by arrival; ready is
// updated in place.
//
// waiting is a heap of queued dishes in house-rule order, and stove is a heap
// of finish minutes of the dishes being cooked. The clock only visits minutes
// where something happens: the next arrival when nothing is queued, or the
// next cook finishing when nobody is free.
func runStation(dishes []dish, cooks int, ready map[int]int) {
	waiting := &heap[dish]{before: ranksAhead}
	stove := &heap[int]{before: func(a, b int) bool { return a < b }}
	free := cooks
	clock := math.MinInt
	i := 0
	for i < len(dishes) || waiting.len() > 0 {
		if waiting.len() == 0 {
			clock = max(clock, dishes[i].arrival)
		} else if free == 0 {
			clock = max(clock, stove.peek())
		}
		for stove.len() > 0 && stove.peek() <= clock {
			stove.pop()
			free++
		}
		for i < len(dishes) && dishes[i].arrival <= clock {
			waiting.push(dishes[i])
			i++
		}
		for free > 0 && waiting.len() > 0 {
			next := waiting.pop()
			done := clock + next.prep
			stove.push(done)
			free--
			ready[next.orderID] = max(ready[next.orderID], done)
		}
	}
}
