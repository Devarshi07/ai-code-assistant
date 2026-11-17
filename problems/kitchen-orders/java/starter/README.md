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
  writes 12-hour stamps; `Clock` converts both ways.

The house rules for who cooks what next are written at the top of
`src/kitchen/Simulator.java`.

## Layout

All production code is in the `kitchen` package under `src/kitchen/`.

| Class | Responsibility |
| --- | --- |
| `Clock`, `ClockException` | Printer time stamps to minutes and back, duration formatting |
| `MenuItem`, `Station`, `Menu`, `MenuException` | Dishes, stations, the house menu (`Menu.HOUSE_MENU`) and lunch line (`Menu.HOUSE_LINE`) |
| `Order` | An order and the host-stand quote |
| `Tickets`, `TicketException` | Parses the ticket printer log into the ticket rail |
| `Simulator`, `KitchenRun` | `Simulator.simulate`: replays a service through the line (not built yet) |
| `Report` | Ticket rail and end-of-service report |
| `data/saturday_lunch.txt` | Last Saturday's lunch log |
| `src/Main.java` | Prints the rail and the service report for Saturday lunch |

Orders are immutable records. `Order.due()` is an `Integer` that is `null`
when no time was promised.

## Running

Java 21, no build tool. The tests are JUnit 5 classes in `tests/`
(`package tests`):

```
javac -d out -cp junit-platform-console-standalone.jar $(find src tests -name '*.java')
java -cp out Main
java -jar junit-platform-console-standalone.jar execute --class-path out --scan-class-path
```

Run it from the project root: the demo and the tests read `data/saturday_lunch.txt`.
