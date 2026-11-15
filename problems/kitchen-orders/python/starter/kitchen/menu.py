"""Menu items and the stations of the kitchen line.

Every dish is cooked start to finish by one cook at exactly one station.
Prep times are whole minutes of hands-on cooking time.
"""
from dataclasses import dataclass


class MenuError(KeyError):
    """Raised when a ticket names a dish the kitchen does not make."""

    def __str__(self):
        # KeyError wraps its message in quotes; keep ours readable.
        return str(self.args[0]) if self.args else ""


@dataclass(frozen=True)
class MenuItem:
    name: str
    station: str
    prep: int  # minutes

    def __post_init__(self):
        if self.prep < 1:
            raise ValueError(f"{self.name}: prep time must be at least one minute")


@dataclass(frozen=True)
class Station:
    name: str
    cooks: int  # identical cooks working this station side by side

    def __post_init__(self):
        if self.cooks < 1:
            raise ValueError(f"station {self.name} needs at least one cook")


class Menu:
    """Dish lookup by name. Names are matched case-insensitively."""

    def __init__(self, items):
        self._items = {}
        for item in items:
            key = item.name.lower()
            if key in self._items:
                raise ValueError(f"duplicate menu item {item.name!r}")
            self._items[key] = item

    @classmethod
    def parse(cls, text):
        """Read the menu sheet: one '<dish name>  <station>  <prep> min' per line."""
        items = []
        for number, raw in enumerate(text.splitlines(), 1):
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            parts = line.rsplit(None, 3)
            if len(parts) != 4 or parts[3] != "min" or not parts[2].isdigit():
                raise ValueError(f"menu line {number}: expected '<dish> <station> <minutes> min'")
            name, station, prep, _ = parts
            items.append(MenuItem(name, station, int(prep)))
        return cls(items)

    def __getitem__(self, name):
        try:
            return self._items[name.lower()]
        except KeyError:
            raise MenuError(f"{name!r} is not on the menu") from None

    def __contains__(self, name):
        return name.lower() in self._items

    def __iter__(self):
        return iter(self._items.values())

    def __len__(self):
        return len(self._items)


HOUSE_MENU = Menu.parse("""
# dish              station  prep
burger              grill     7 min
cheeseburger        grill     8 min
chicken sandwich    grill     6 min
steak frites        grill    14 min
fries               fryer     4 min
onion rings         fryer     5 min
wings               fryer     9 min
fish and chips      fryer     8 min
house salad         salad     3 min
caesar salad        salad     4 min
tomato soup         salad     2 min   # the salad station also ladles soup
margherita          oven      9 min
flatbread           oven      6 min
brownie             oven      3 min
""")

# The lunch crew: two cooks on the grill, one everywhere else.
HOUSE_LINE = [Station("grill", 2), Station("fryer", 1), Station("salad", 1), Station("oven", 1)]
