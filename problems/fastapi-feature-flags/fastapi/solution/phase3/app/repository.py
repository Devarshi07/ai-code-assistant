"""In-memory storage standing in for the database table of flags."""
from dataclasses import dataclass, field

from app.rules import Rule, parse_rule
from app.schemas import RuleSpec


@dataclass(frozen=True)
class StoredFlag:
    """A flag as stored. Immutable: updates build a new object with ``dataclasses.replace``.

    Rules are parsed once, when the flag is built, and kept in ``compiled`` as
    ``(Rule, value)`` pairs. Evaluation never parses expressions.
    """

    key: str
    description: str
    enabled: bool
    default: bool
    rollout_percent: int
    rules: tuple[RuleSpec, ...]
    compiled: tuple[tuple[Rule, bool], ...] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        compiled = tuple((parse_rule(spec.when), spec.value) for spec in self.rules)
        object.__setattr__(self, "compiled", compiled)


class FlagRepository:
    def __init__(self) -> None:
        self._flags: dict[str, StoredFlag] = {}

    def get(self, key: str) -> StoredFlag | None:
        return self._flags.get(key)

    def list(self) -> list[StoredFlag]:
        """Every flag, ordered by key."""
        return [self._flags[key] for key in sorted(self._flags)]

    def save(self, flag: StoredFlag) -> None:
        self._flags[flag.key] = flag

    def delete(self, key: str) -> bool:
        return self._flags.pop(key, None) is not None
