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
 F   .  .  E  C  .  .  B  B  B  B        random_fleet(7)
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
- A shot off the board raises `OffBoardError` and is not counted.
- A match ends when the fleet is sunk or the shot budget runs out. The default
  budget is one shot per cell.

## Layout

| Module | Responsibility |
| --- | --- |
| `armada/ocean.py` | `Coord`, `Ocean`: bounds, neighbours, `A1` labels, text rendering |
| `armada/ships.py` | `Ship`, `Fleet`: placement rules, `DEFAULT_FLEET` |
| `armada/placer.py` | `Rng` (mulberry32) and `random_fleet(seed, size, ship_sizes)` |
| `armada/battle.py` | `Battle`: shot resolution, the shot log, the shooter's chart |
| `armada/match.py` | `play_match` and `run_series`: the harness that drives bots |
| `armada/bots.py` | The `Bot` contract, `ScriptedBot`, and `SeekerBot` |
| `main.py` | Demo: a seeded fleet, a replayed QA ticket, the reference bot |

## Writing a bot

Subclass `Bot`. The match runner creates a **fresh** bot for each match as
`MyBot(size, ship_sizes)` and then repeats:

```python
coord = bot.next_shot()        # a Coord on the board
result = battle.fire(coord)    # ShotResult.MISS / HIT / SUNK
bot.observe(coord, result)
```

until the fleet is sunk or the budget is spent. The fleet's make-up
(`ship_sizes`) is public; where the ships are is not. Bots must never look at
the fleet or the `Battle`. `ScriptedBot` is the simplest example.

## Reproducible fleets

QA replays the same matches in the Python and JavaScript harnesses, so
`random_fleet(seed)` must give the identical fleet in both. That's why the
placer uses its own mulberry32 generator instead of the `random` module.

## Running

```
python main.py
python -m unittest discover -s tests -v
```
