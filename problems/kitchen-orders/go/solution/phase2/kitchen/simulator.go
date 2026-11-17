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
	"errors"
	"fmt"
	"math"
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

// Simulate runs the service described by orders through the kitchen line.
//
// menu.Get(name) gives a dish's MenuItem (or a *MenuError), and stations lists
// the Station values of the line. Orders may be given in any order.
//
// The clock advances one minute at a time. Each minute, newly arrived dishes
// join their station's queue, cooks whose dish is done are released, and every
// free cook takes the best-ranked waiting dish.
func Simulate(orders []Order, menu *Menu, stations []Station) (Run, error) {
	arrivals := make(map[int][]Order) // minute -> orders rung in then
	clock := math.MaxInt
	left := 0
	for _, order := range orders {
		arrivals[order.Arrival] = append(arrivals[order.Arrival], order)
		clock = min(clock, order.Arrival)
		left += len(order.Dishes)
	}
	waiting := make(map[string][]dish) // queued dishes per station
	stoves := make(map[string][]int)   // finish minute of each dish cooking
	for _, station := range stations {
		waiting[station.Name] = nil
		stoves[station.Name] = nil
	}
	ready := make(map[int]int)

	for left > 0 {
		for _, order := range arrivals[clock] {
			for position, name := range order.Dishes {
				item, err := menu.Get(name)
				if err != nil {
					return Run{}, err
				}
				if _, ok := waiting[item.Station]; !ok {
					return Run{}, fmt.Errorf("%q needs station %q, which is not on the line", name, item.Station)
				}
				waiting[item.Station] = append(waiting[item.Station], dish{order.Priority, order.Arrival, order.ID, position, item.Prep})
			}
		}
		for _, station := range stations {
			queue := waiting[station.Name]
			stove := stoves[station.Name][:0]
			for _, done := range stoves[station.Name] {
				if done > clock {
					stove = append(stove, done)
				}
			}
			for len(queue) > 0 && len(stove) < station.Cooks {
				best := 0
				for i := 1; i < len(queue); i++ {
					if ranksAhead(queue[i], queue[best]) {
						best = i
					}
				}
				next := queue[best]
				queue = append(queue[:best], queue[best+1:]...)
				done := clock + next.prep
				stove = append(stove, done)
				ready[next.orderID] = max(ready[next.orderID], done)
				left--
			}
			waiting[station.Name] = queue
			stoves[station.Name] = stove
		}
		clock++
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
