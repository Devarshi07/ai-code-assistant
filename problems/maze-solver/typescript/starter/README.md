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
| `src/geometry.ts` | `Position`, compass directions, gate symbols |
| `src/level.ts` | `Level`: parsing, bounds and walkability, legal moves |
| `src/solver.ts` | Route finding: `shortestPath`, `solve`, `collectAllGems` |
| `src/render.ts` | Text previews and compass move strings |
| `src/levels.ts` | Sample levels from the design team |
| `main.ts` | Prints routes for the sample levels |

Positions are plain `{ row, col }` objects; `key(pos)` in `geometry.ts` turns one
into a string for use in `Map`s and `Set`s.

## Running

Node.js runs the TypeScript files directly by stripping the types, so there is
no build step (Node 22 before 22.18 needs `--experimental-strip-types`):

```
node main.ts
node --test "tests/*.test.ts"
```
