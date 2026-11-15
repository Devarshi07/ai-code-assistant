"""Demo: a seeded fleet, a replayed bug report, and the reference bot."""
from armada import DEFAULT_FLEET, ScriptedBot, SeekerBot, play_match, random_fleet, run_series

SEED = 7

# QA ticket #212: shots recorded from an experimental bot that got stuck
# re-firing at the same squares. It was replayed against the seed-7 fleet.
STUCK_BOT_SHOTS = ["C5", "A3", "A3", "A3", "A3", "A3", "F7", "F7", "F7", "F7",
                   "D4", "D4", "D4", "G5", "G5", "G5", "F3", "F3"]


def main():
    fleet = random_fleet(SEED)
    print(f"Hidden fleet for seed {SEED} (10x10):")
    print(fleet.render())
    for letter, ship in zip("ABCDE", fleet.ships):
        print(f"  {letter}  {ship.name:<10} {ship.size} cells from {ship.cells[0]}")
    print()

    replay = play_match(ScriptedBot(10, STUCK_BOT_SHOTS), random_fleet(SEED), budget=len(STUCK_BOT_SHOTS))
    print("Replay of ticket #212:", replay.summary())
    print("  results:", " ".join(record.result.name for record in replay.battle.log))
    print()

    try:
        report = play_match(SeekerBot(10, DEFAULT_FLEET), random_fleet(SEED))
    except NotImplementedError as exc:
        print(f"SeekerBot: {exc}")
        return
    print(report.summary())
    print(report.battle.chart())
    print()
    print("Benchmark over seeds 1-50:")
    print(" ", run_series(SeekerBot, range(1, 51)))


if __name__ == "__main__":
    main()
