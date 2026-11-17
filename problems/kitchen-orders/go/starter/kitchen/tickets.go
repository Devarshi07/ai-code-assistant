package kitchen

// Parser for the ticket printer log.
//
// One ticket per line:
//
//	11:58am order 106: caesar salad, 2x fries | app | due 12:20pm
//
// * The stamp is when the ticket was rung in (see clock.go).
// * Dishes are comma separated. "2x fries" means two portions of fries.
// * Optional flags follow a "|": "app" marks a delivery-app order, which the
//   cooks take first, and "due <time>" is the ready time promised to the guest.
//
// Blank lines and lines starting with "#" are ignored.

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

var (
	ticketLine = regexp.MustCompile(`(?i)^(\S+)\s+order\s+(\d+)\s*:\s*(.*)$`)
	portions   = regexp.MustCompile(`(?i)^(\d+)\s*x\s+(.+)$`)
)

// TicketError is a log line that could not be read. It carries the 1-based line number.
type TicketError struct {
	LineNumber int
	Message    string
}

func (e *TicketError) Error() string {
	return fmt.Sprintf("line %d: %s", e.LineNumber, e.Message)
}

// ParseDishes turns "burger, 2x fries" into ["burger", "fries", "fries"].
func ParseDishes(text string) []string {
	var dishes []string
	for _, raw := range strings.Split(text, ",") {
		part := strings.ToLower(strings.Join(strings.Fields(raw), " "))
		if part == "" {
			continue
		}
		if match := portions.FindStringSubmatch(part); match != nil {
			count, _ := strconv.Atoi(match[1])
			for range count {
				dishes = append(dishes, match[2])
			}
		} else {
			dishes = append(dishes, part)
		}
	}
	return dishes
}

// ParseTicket parses a single log line into an Order.
func ParseTicket(line string, lineNumber int) (Order, error) {
	match := ticketLine.FindStringSubmatch(strings.TrimSpace(line))
	if match == nil {
		return Order{}, &TicketError{lineNumber, fmt.Sprintf(`expected "<time> order <id>: <dishes>", got %q`, strings.TrimSpace(line))}
	}
	parts := strings.Split(match[3], "|")
	var clockErr *ClockError
	arrival, err := ParseClock(match[1])
	if errors.As(err, &clockErr) {
		return Order{}, &TicketError{lineNumber, err.Error()}
	}
	priority := false
	var due *int
	for _, raw := range parts[1:] {
		flag := strings.ToLower(strings.TrimSpace(raw))
		switch {
		case flag == "app":
			priority = true
		case strings.HasPrefix(flag, "due "):
			minute, err := ParseClock(flag[len("due "):])
			if errors.As(err, &clockErr) {
				return Order{}, &TicketError{lineNumber, err.Error()}
			}
			due = &minute
		default:
			return Order{}, &TicketError{lineNumber, fmt.Sprintf("unknown flag %q", flag)}
		}
	}
	dishes := ParseDishes(parts[0])
	if len(dishes) == 0 {
		return Order{}, &TicketError{lineNumber, "ticket has no dishes"}
	}
	id, _ := strconv.Atoi(match[2])
	return Order{ID: id, Arrival: arrival, Dishes: dishes, Priority: priority, Due: due}, nil
}

// ParseLog parses a whole log into the ticket rail.
//
// The rail lists orders by arrival time. Tickets rung in during the same
// minute keep their printer order. Order ids must be unique.
func ParseLog(text string) ([]Order, error) {
	var orders []Order
	seen := make(map[int]bool)
	for index, line := range strings.Split(text, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		order, err := ParseTicket(line, index+1)
		if err != nil {
			return nil, err
		}
		if seen[order.ID] {
			return nil, &TicketError{index + 1, fmt.Sprintf("order %d appears twice", order.ID)}
		}
		seen[order.ID] = true
		orders = append(orders, order)
	}
	sort.SliceStable(orders, func(i, j int) bool { return orders[i].Arrival < orders[j].Arrival })
	return orders, nil
}
