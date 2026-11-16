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

| Class | Responsibility |
| --- | --- |
| `src/maze/Position.java` | `Position` record: a tile, its neighbours, step directions |
| `src/maze/Direction.java` | Compass directions and the one-way gate symbols |
| `src/maze/Level.java` | `Level`: parsing, bounds and walkability, legal moves |
| `src/maze/LevelException.java` | Thrown for malformed layouts |
| `src/maze/Solver.java` | Route finding: `shortestPath`, `solve`, `collectAllGems` |
| `src/maze/Run.java` | `Run` record: a complete route and its move count |
| `src/maze/Render.java` | Text previews and compass move strings |
| `src/maze/Levels.java` | Sample levels from the design team |
| `src/Main.java` | Prints routes for the sample levels |

`Position` is a record, so positions can be used directly as `HashMap` keys and
`HashSet` members.

## Running

Java 21, with the JUnit 5 console launcher (`junit.jar`) for the tests:

```
javac -d out $(find src -name '*.java') && java -cp out Main
javac -d out -cp junit.jar $(find src tests -name '*.java') && java -jar junit.jar execute --class-path out --scan-class-path
```
