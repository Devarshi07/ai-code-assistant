# Harbour City journey planner

This package is the planning backend of the Harbour City transit app. The
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

- `Planner.fewestStops` is the "quick route" panel: fewest stops, lines ignored.
- `Planner.fastestJourney` (in progress) is the main journey planner. Riding
  time is the sum of the hop minutes; **changing lines** at a station costs a
  fixed transfer penalty (5 minutes by default). Boarding the first line is
  free.

## Layout

All production code is in the `transit` package under `src/transit/`.

| Class | Responsibility |
| --- | --- |
| `Station`, `Line` (with `Line.Segment`), `Connection`, `Leg`, `Journey` | Plain data models; most are records |
| `Network` | Stations, lines and directed connections; throws `UnknownStationException` |
| `Timetable` | `loadNetwork(text)`: parses the timetable format; throws `TimetableException` |
| `Planner` | `fewestStops` and `fastestJourney` |
| `Formatting` | Journey cards, itineraries and a network summary |
| `Samples` | The Harbour City sample timetable |
| `src/Main.java` | Prints routes and journeys for a few common trips |

`network.stations()` and `network.lines()` are read-only maps keyed by name
(lines in timetable order). A `Connection` is a `(to, line, minutes)` record.
A `Journey` holds its `legs()` in travel order. Each `Leg` is one continuous
ride: `line()`, `stations()` (boarding station first, alighting station last)
and the riding `minutes()` of that leg. `journey.totalMinutes()` adds the
transfer penalty for every change between legs. Methods that find nothing
(no route, no journey) return `null`.

## Running

Java 21, no build tool. The tests are JUnit 5 classes in `tests/`
(package `tests`), run with the JUnit console launcher:

```
javac -d out $(find src -name '*.java') && java -cp out Main
javac -d out -cp junit.jar $(find src tests -name '*.java')
java -jar junit.jar execute --class-path out --scan-class-path
```
