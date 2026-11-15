"""Orders as the kitchen sees them."""
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Order:
    id: int
    arrival: int                # minute the ticket was rung in (see clock.py)
    dishes: List[str]           # one entry per portion, in ticket order
    priority: bool = False      # delivery-app order: cooks take these first
    due: Optional[int] = None   # ready time promised to the guest, if any

    def __post_init__(self):
        if not self.dishes:
            raise ValueError(f"order {self.id} has no dishes")

    def quote(self, menu):
        """Host-stand estimate: arrival plus the slowest dish on the ticket.

        This assumes every station is idle when the ticket comes in, so it is
        only honest on a quiet afternoon. During a rush, dishes queue behind
        other tickets; see simulator.py.
        """
        return self.arrival + max(menu[dish].prep for dish in self.dishes)

    def stations(self, menu):
        """The set of stations this ticket needs."""
        return {menu[dish].station for dish in self.dishes}
