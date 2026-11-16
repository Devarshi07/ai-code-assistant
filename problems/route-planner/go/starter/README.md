# Harbour City journey planner

This module is the planning backend of the Harbour City transit app. The
scheduling team publishes the network as a plain-text timetable; the planner
loads it and answers riders' "how do I get from A to B?" questions.

## Timetable format

```
# comments start with '#'
line Red: Airport 4 Central 3 Harbor 6 Museum
line Ferry oneway: Harbor 8 Island Pier 5 Lighthouse 10 Harbor
```

- Each `line` entry lists the stops of one line in order, separated by the
  running time in **minutes** to the next stop.
- Station names may contain spaces (`Island Pier`) but are never plain numbers.
- Trains run **both ways** along a line with the same running times, unless
  the line name is followed by `oneway`. A line may end where it started
  (the Circle line and the harbour ferry are loops).

## Planning rules

- `FewestStops` is the "quick route" panel: fewest stops, lines ignored.
- `FastestJourney` (in progress) is the main journey planner. Riding time is
  the sum of the hop minutes; **changing lines** at a station costs a fixed
  transfer penalty (`DefaultTransferMinutes`, 5 minutes). Boarding the first
  line is free.

## Layout

All production code is in package `transit` (`debuggym/route-planner/transit`).

| File | Responsibility |
| --- | --- |
| `transit/models.go` | `Station`, `Line` (stops, minutes, `OneWay`), `Segment`, `Connection`, `Leg`, `Journey` |
| `transit/network.go` | `Network`: stations, lines and directed connections; `UnknownStationError` |
| `transit/timetable.go` | `LoadNetwork(text, name)`: parses the timetable format; `TimetableError` |
| `transit/planner.go` | `FewestStops` and `FastestJourney` |
| `transit/format.go` | Journey cards, itineraries and a network summary |
| `transit/samples.go` | The Harbour City sample timetable |
| `main.go` | Prints routes and journeys for a few common trips |

`network.Lines()` lists the lines in timetable order and `network.Line(name)`
looks one up. A `Connection` is a `{To, Line, Minutes}` struct. A `Journey`
holds its `Legs` in travel order. Each `Leg` is one continuous ride: `Line`,
`Stations` (boarding station first, alighting station last) and the riding
`Minutes` of that leg. `journey.TotalMinutes()` adds the transfer penalty for
every change between legs.

Errors are values: an unknown station name gives an `*UnknownStationError`
and a malformed timetable a `*TimetableError` (check them with `errors.As`).
"Nothing found" is not an error: `FewestStops` returns a nil route and
`FastestJourney` a nil journey.

## Running

```
go run .
go test ./tests/...
```
