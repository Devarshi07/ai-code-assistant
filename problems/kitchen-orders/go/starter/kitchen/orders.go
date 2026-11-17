package kitchen

import "fmt"

// Order is a ticket as the kitchen sees it.
type Order struct {
	ID       int
	Arrival  int      // minute the ticket was rung in (see clock.go)
	Dishes   []string // one entry per portion, in ticket order
	Priority bool     // delivery-app order: cooks take these first
	Due      *int     // ready time promised to the guest, or nil when none was promised
}

// NewOrder validates and builds an order.
func NewOrder(id, arrival int, dishes []string, priority bool, due *int) (Order, error) {
	if len(dishes) == 0 {
		return Order{}, fmt.Errorf("order %d has no dishes", id)
	}
	return Order{ID: id, Arrival: arrival, Dishes: dishes, Priority: priority, Due: due}, nil
}

// Quote is the host-stand estimate: arrival plus the slowest dish on the ticket.
//
// It assumes every station is idle when the ticket comes in, so it is only
// honest on a quiet afternoon. During a rush, dishes queue behind other
// tickets; see simulator.go.
func (o Order) Quote(menu *Menu) (int, error) {
	slowest := 0
	for _, name := range o.Dishes {
		item, err := menu.Get(name)
		if err != nil {
			return 0, err
		}
		slowest = max(slowest, item.Prep)
	}
	return o.Arrival + slowest, nil
}

// Stations is the set of stations this ticket needs.
func (o Order) Stations(menu *Menu) (map[string]bool, error) {
	stations := make(map[string]bool)
	for _, name := range o.Dishes {
		item, err := menu.Get(name)
		if err != nil {
			return nil, err
		}
		stations[item.Station] = true
	}
	return stations, nil
}
