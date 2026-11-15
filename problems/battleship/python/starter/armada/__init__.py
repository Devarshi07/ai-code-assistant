"""Armada: the naval-combat simulation library behind the bot-testing harness."""
from .battle import Battle, ShotRecord, ShotResult
from .bots import Bot, BotError, ScriptedBot, SeekerBot
from .match import MatchReport, play_match, run_series
from .ocean import Coord, Ocean, OffBoardError, parse_label, to_coord
from .placer import Rng, random_fleet
from .ships import DEFAULT_FLEET, Fleet, PlacementError, Ship
