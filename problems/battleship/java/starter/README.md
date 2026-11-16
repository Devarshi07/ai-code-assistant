# Armada

Armada is the naval-combat simulation library behind the studio's bot-testing
harness. Designers write AI opponents ("bots") for our Battleship-style game;
QA generates seeded fleets, plays every bot against them and tracks how many
shots each one needs.

```
     1  2  3  4  5  6  7  8  9 10        A  Carrier     5 cells
 A   .  .  A  A  A  A  A  .  .  .        B  Battleship  4 cells
 B   .  .  .  .  .  .  .  .  .  .        C  Cruiser     3 cells
 C   .  .  .  .  .  .  .  .  .  .        D  Submarine   3 cells
 D   .  .  .  C  .  .  .  .  .  .        E  Destroyer   2 cells
 E   .  .  .  C  .  .  .  .  .  .
 F   .  .  E  C  .  .  B  B  B  B        Placer.randomFleet(7)
 G   .  .  E  .  D  .  .  .  .  .
 H   .  .  .  .  D  .  .  .  .  .
 I   .  .  .  .  D  .  .  .  .  .
 J   .  .  .  .  .  .  .  .  .  .
```

## House rules

- The ocean is square, 10x10 by default (4 to 26 per side). Rows are lettered
  from A at the top, columns numbered from 1, so `B7` is row 1, column 6.
- The standard fleet has ships of length 5, 4, 3, 3 and 2. Ships are straight
  horizontal or vertical lines, stay on the board and never overlap. They may
  touch side by side.
- Every shot comes back `MISS`, `HIT` or `SUNK`. `SUNK` is reported by the shot
  that hits the last undamaged cell of a ship. It does not say which ship.
- **Repeats are wasted.** A shot at a cell that has already been fired at
  still counts as a shot, always comes back `MISS`, is flagged as a repeat in
  the log, and changes nothing on the board.
- A shot off the board throws `OffBoardException` and is not counted.
- A match ends when the fleet is sunk or the shot budget runs out. The default
  budget is one shot per cell.

## Layout

Everything lives in the `armada` package under `src/armada/`.

| Class | Responsibility |
| --- | --- |
| `Coord`, `Ocean` | A cell and its `A1` label; the board: bounds, neighbours, text rendering |
| `Ship`, `Fleet` | Ships and the placement rules; `Fleet.DEFAULT_FLEET` |
| `Placer` | `Placer.Rng` (mulberry32) and `randomFleet(seed, size, shipSizes)` |
| `Battle`, `ShotResult` | Shot resolution, the shot log, the shooter's chart |
| `Match`, `MatchReport` | `Match.play` and `Match.runSeries`: the harness that drives bots |
| `Bot`, `ScriptedBot`, `SeekerBot` | The bot contract and the bots |
| `src/Main.java` | Demo: a seeded fleet, a replayed QA ticket, the reference bot |

`OffBoardException`, `PlacementException` and `BotException` are unchecked.

`Coord` is a record (`new Coord(1, 6)`), so equal coordinates are
interchangeable as keys in `Set`s and `Map`s. `Coord.parse("B7")` reads a
label and `coord.label()` writes one. Methods that take a cell also accept a
label (`battle.fire("B7")`), which keeps replays and tests readable.

## Writing a bot

Extend `Bot`. The match runner creates a **fresh** bot for each match through
a `Bot.Factory` such as `MyBot::new`, which calls `new MyBot(size, shipSizes)`,
and then repeats:

```java
Coord coord = bot.nextShot();            // a Coord on the board
ShotResult result = battle.fire(coord);  // MISS, HIT or SUNK
bot.observe(coord, result);
```

until the fleet is sunk or the budget is spent. The fleet's make-up
(`shipSizes`) is public; where the ships are is not. Bots must never look at
the fleet or the `Battle`. `ScriptedBot` is the simplest example.

## Reproducible fleets

QA replays the same matches in the harness of every language the studio uses,
so `Placer.randomFleet(seed)` must give the identical fleet in all of them.
That's why the placer uses its own mulberry32 generator instead of
`java.util.Random`.

## Running

```
javac -d out $(find src -name '*.java') && java -cp out Main
javac -d out -cp /opt/junit/junit.jar $(find src tests -name '*.java')
java -jar /opt/junit/junit.jar execute --class-path out --scan-class-path
```
