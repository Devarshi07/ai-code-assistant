"""Member records and the small parsing helpers shared by the loaders."""
import re
from dataclasses import dataclass
from datetime import date

ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,31}$")
MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


class ModelError(ValueError):
    """Raised when a member record is malformed."""


def check_id(user_id):
    """Return user_id if it is a valid Campfire handle, else raise ModelError."""
    if not isinstance(user_id, str) or not ID_PATTERN.match(user_id):
        raise ModelError(f"invalid member id {user_id!r}")
    return user_id


def normalize_interest(tag):
    """'  Board Games ' -> 'board-games'."""
    return "-".join(tag.lower().split())


def parse_interests(text):
    """Parse a ';'-separated interest list into a frozenset of normalized tags."""
    return frozenset(normalize_interest(tag) for tag in text.split(";") if tag.strip())


def parse_date(text):
    """Parse a YYYY-MM-DD date from an export."""
    try:
        return date.fromisoformat(text.strip())
    except (AttributeError, ValueError):
        raise ModelError(f"invalid date {text!r}; expected YYYY-MM-DD") from None


@dataclass(eq=False)
class User:
    """One Campfire member. Members are identified by their handle, `id`."""
    id: str
    name: str
    joined: date
    interests: frozenset = frozenset()
    active: bool = True

    def __post_init__(self):
        check_id(self.id)
        if not self.name.strip():
            raise ModelError(f"{self.id}: name must not be empty")
        self.interests = frozenset(self.interests)

    @property
    def first_name(self):
        return self.name.split()[0]

    @property
    def member_since(self):
        """'Apr 2019'."""
        return f"{MONTHS[self.joined.month - 1]} {self.joined.year}"

    def __str__(self):
        return f"{self.name} (@{self.id})"
