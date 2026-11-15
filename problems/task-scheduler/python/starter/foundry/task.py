"""Task model: one unit of work in a pipeline."""
import re
from dataclasses import dataclass
from typing import Optional, Tuple

NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")


class PipelineError(ValueError):
    """A pipeline definition is invalid: bad syntax, unknown task, cycle, ..."""


@dataclass(frozen=True)
class Task:
    """A unit of work such as compiling the app or running a test suite.

    duration  whole minutes the task keeps one runner busy (at least 1)
    deps      names of the tasks that must finish before this one may start
    resource  optional runner label such as "macos"; informational for now
    """
    name: str
    duration: int
    deps: Tuple[str, ...] = ()
    resource: Optional[str] = None

    def __post_init__(self):
        if not isinstance(self.name, str) or not NAME_PATTERN.fullmatch(self.name):
            raise PipelineError(f"invalid task name {self.name!r}")
        if type(self.duration) is not int or self.duration < 1:
            raise PipelineError(f"{self.name}: duration must be a whole number of minutes, at least 1")
        if isinstance(self.deps, str):
            raise PipelineError(f"{self.name}: deps must be a list of task names")
        # Keep dependencies as a tuple without repeats, in the order given.
        object.__setattr__(self, "deps", tuple(dict.fromkeys(self.deps)))

    def __str__(self):
        after = f" after {', '.join(self.deps)}" if self.deps else ""
        on = f" on {self.resource}" if self.resource else ""
        return f"{self.name} ({self.duration} min){after}{on}"
