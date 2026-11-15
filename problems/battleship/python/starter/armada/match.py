"""Match runner: plays a bot against a hidden fleet and reports the outcome."""
from dataclasses import dataclass
from statistics import mean

from .battle import Battle
from .placer import random_fleet
from .ships import DEFAULT_FLEET


@dataclass
class MatchReport:
    bot: str
    shots: int
    won: bool      # every ship sunk within the budget
    repeats: int   # shots at cells that had already been fired at
    battle: Battle

    def summary(self) -> str:
        verdict = "sank the fleet" if self.won else "did not sink the fleet"
        return f"{self.bot} {verdict} in {self.shots} shots ({self.repeats} repeated)"


def play_match(bot, fleet, budget=None) -> MatchReport:
    """Let bot fire until the fleet is sunk or the shot budget is spent.

    The bot only ever sees coordinates and ShotResults; it never gets the
    fleet. The default budget is one shot per cell, which is enough for any
    bot that never fires at the same cell twice.
    """
    battle = Battle(fleet)
    limit = fleet.ocean.size ** 2 if budget is None else budget
    while not battle.fleet_sunk and battle.shots_fired < limit:
        result = battle.fire(bot.next_shot())
        bot.observe(battle.log[-1].coord, result)
    return MatchReport(type(bot).__name__, battle.shots_fired, battle.fleet_sunk, battle.repeats, battle)


def run_series(make_bot, seeds, size=10, ship_sizes=DEFAULT_FLEET) -> str:
    """Benchmark a bot class (or any factory taking size, ship_sizes) over seeded fleets.

    Returns a one-line summary for dashboards and the CLI.
    """
    reports = [play_match(make_bot(size, ship_sizes), random_fleet(seed, size, ship_sizes)) for seed in seeds]
    shots = [report.shots for report in reports]
    wins = sum(report.won for report in reports)
    return (f"{reports[0].bot}: {wins}/{len(reports)} fleets sunk, {mean(shots):.1f} shots "
            f"on average (best {min(shots)}, worst {max(shots)})")
