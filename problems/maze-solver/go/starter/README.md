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

| File | Responsibility |
| --- | --- |
| `maze/geometry.go` | `Position`, compass directions, gate symbols |
| `maze/level.go` | `Level`: parsing, bounds and walkability, legal moves |
| `maze/solver.go` | Route finding: `ShortestPath`, `Solve`, `CollectAllGems` |
| `maze/render.go` | Text previews and compass move strings |
| `maze/levels.go` | Sample levels from the design team |
| `main.go` | Prints routes for the sample levels |

`Position` is a comparable struct, so positions work directly as map keys.
`Parse` returns a `*LevelError` for a malformed layout.

## Running

```
go run .
go test ./tests/...
```
