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

- `fewest_stops` is the "quick route" panel: fewest stops, lines ignored.
- `fastest_journey` (in progress) is the main journey planner. Riding time
  is the sum of the hop minutes; **changing lines** at a station costs a fixed
  transfer penalty (5 minutes by default). Boarding the first line is free.

## Layout

| Module | Responsibility |
| --- | --- |
| `transit/models.py` | `Station`, `Line` (stops, minutes, `one_way`), `Connection`, `Leg`, `Journey` |
| `transit/network.py` | `Network`: stations, lines and directed connections; `UnknownStationError` |
| `transit/timetable.py` | `load_network(text)`: parses the timetable format; `TimetableError` |
| `transit/planner.py` | `fewest_stops` and `fastest_journey` |
| `transit/formatting.py` | Journey cards, itineraries and a network summary |
| `transit/samples.py` | The Harbour City sample timetable |
| `main.py` | Prints routes and journeys for a few common trips |

A `Journey` holds its `legs` in travel order. Each `Leg` is one continuous
ride: `line`, `stations` (boarding station first, alighting station last) and
the riding `minutes` of that leg. `Journey.total_minutes` adds the transfer
penalty for every change between legs.

## Running

```
python main.py
python -m unittest discover -s tests -v
```
