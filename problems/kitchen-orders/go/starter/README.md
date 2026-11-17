# Kitchen display system

Software for the kitchen display screens at **Ember & Oak**, a busy lunch
restaurant. Tickets come off the front-counter printer and the delivery-app
tablet, land on the ticket rail, and expo uses the reports here to quote pickup
times and to see which station is drowning.

```
11:58am order 106: wings | app | due 12:15pm
12:03pm order 108: chicken sandwich, fries, brownie | due 12:20pm
```

## Domain

- **Menu item**: a dish, the one station that cooks it, and its prep time in minutes.
- **Station**: grill, fryer, salad or oven, staffed by N identical cooks.
  A cook makes one dish at a time, start to finish.
- **Order**: an id, the minute it was rung in, its dishes in ticket order, a
  `Priority` flag for delivery-app orders (cooked first) and an optional
  promised `Due` time (`nil` when none was promised).
- **Times** are whole minutes since midnight (`750` is 12:30pm). The printer
  writes 12-hour stamps; `clock.go` converts both ways.

The house rules for who cooks what next are written at the top of
`kitchen/simulator.go`.

## Layout

All production code is in the `kitchen` package under `kitchen/`.

| File | Responsibility |
| --- | --- |
| `kitchen/clock.go` | Printer time stamps to minutes and back, duration formatting |
| `kitchen/menu.go` | `MenuItem`, `Station`, `Menu`, the house menu and lunch line |
| `kitchen/orders.go` | `Order` and the host-stand quote |
| `kitchen/tickets.go` | Parses the ticket printer log into the ticket rail |
| `kitchen/simulator.go` | `Simulate`: replays a service through the line (not built yet) |
| `kitchen/report.go` | Ticket rail and end-of-service report |
| `data/saturday_lunch.txt` | Last Saturday's lunch log |
| `main.go` | Prints the rail and the service report for Saturday lunch |

Functions that can fail return an error (`*ClockError`, `*MenuError`,
`*TicketError`).

## Running

```
go run .
go test ./tests/...
```
