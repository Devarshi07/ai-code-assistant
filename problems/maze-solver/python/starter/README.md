# Labyrinth level tools

Labyrinth is a grid puzzle game. Level designers write levels as text, and this
package validates them: it parses the layout, finds the shortest route from the
start tile to the exit, and renders previews for the level editor.

```
#########
#S..#...#      #  wall          S  start
#.#.#.#.#      .  floor         E  exit
#.#...#E#      $  gem           > < ^ v  one-way gates
#########
```

## Movement rules

- The player moves one tile at a time: north, east, south or west.
- Walls and the outside of the map are never walkable.
- **Gates are one-way doors.** A gate can only be entered while moving in its
  arrow's direction, and the next step must continue in that direction.
  `>` can be entered from the west and is left to the east.
- Stepping on a gem collects it. Walking over the exit early does not end the run.

## Layout

| Module | Responsibility |
| --- | --- |
| `maze/geometry.py` | `Position`, compass directions, gate symbols |
| `maze/level.py` | `Level`: parsing, bounds and walkability, legal moves |
| `maze/solver.py` | Route finding: `shortest_path`, `solve`, `collect_all_gems` |
| `maze/render.py` | Text previews and compass move strings |
| `maze/levels.py` | Sample levels from the design team |
| `main.py` | Prints routes for the sample levels |

## Running

```
python main.py
python -m unittest discover -s tests -v
```
