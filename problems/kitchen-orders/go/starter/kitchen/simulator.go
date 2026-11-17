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

// Simulate runs the service described by orders through the kitchen line.
//
// menu.Get(name) gives a dish's MenuItem (or a *MenuError), and stations lists
// the Station values of the line. Orders may be given in any order.
func Simulate(orders []Order, menu *Menu, stations []Station) (Run, error) {
	return Run{}, fmt.Errorf("%w: Simulate (Phase 2)", ErrNotImplemented)
}
