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
  `priority` flag for delivery-app orders (cooked first) and an optional
  promised `due` time (`null` when none was promised).
- **Times** are whole minutes since midnight (`750` is 12:30pm). The printer
  writes 12-hour stamps; `clock.ts` converts both ways.

The house rules for who cooks what next are written at the top of
`src/simulator.ts`.

## Layout

| Module | Responsibility |
| --- | --- |
| `src/clock.ts` | Printer time stamps to minutes and back, duration formatting |
| `src/menu.ts` | `MenuItem`, `Station`, `Menu`, the house menu and lunch line |
| `src/orders.ts` | `Order` and the host-stand quote |
| `src/tickets.ts` | Parses the ticket printer log into the ticket rail |
| `src/simulator.ts` | `simulate`: replays a service through the line (not built yet) |
| `src/report.ts` | Ticket rail and end-of-service report |
| `data/saturday_lunch.txt` | Last Saturday's lunch log |
| `main.ts` | Prints the rail and the service report for Saturday lunch |

## Running

```
node --experimental-strip-types main.ts
node --test --experimental-strip-types "tests/*.test.ts"
```

The sources are ES modules. Node 22 runs them directly by stripping the type
annotations (there is no separate build step and no type check at run time),
so imports keep their `.ts` extension and the code avoids `enum` and other
syntax that needs compiling.
