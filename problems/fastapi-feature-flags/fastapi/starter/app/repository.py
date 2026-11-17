"""In-memory storage standing in for the database table of flags."""
from dataclasses import dataclass

from app.schemas import RuleSpec


@dataclass(frozen=True)
class StoredFlag:
    """A flag as stored. Immutable: updates build a new object with ``dataclasses.replace``."""

    key: str
    description: str
    enabled: bool
    default: bool
    rollout_percent: int
    rules: tuple[RuleSpec, ...]


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
