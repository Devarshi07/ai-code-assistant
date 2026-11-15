"""Route patterns: literal segments, `*` (one segment) and a trailing `**` (one or more)."""
from .errors import ConfigError

LITERAL, STAR, GLOBSTAR = 0, 1, 2


class Pattern:
    """A parsed, validated route pattern."""

    __slots__ = ("text", "segments", "rank")

    def __init__(self, text):
        if not isinstance(text, str) or not text.startswith("/"):
            raise ConfigError(f"pattern {text!r} must start with '/'")
        segments = text[1:].split("/")
        for index, segment in enumerate(segments):
            if not segment:
                raise ConfigError(f"pattern {text!r} has an empty segment")
            if "*" in segment and segment not in ("*", "**"):
                raise ConfigError(f"pattern {text!r}: '*' must be a whole segment")
            if segment == "**" and index != len(segments) - 1:
                raise ConfigError(f"pattern {text!r}: '**' is only allowed last")
        self.text = text
        self.segments = tuple(segments)
        # Lower rank tuples are more specific. Distinct patterns that match the
        # same route always differ at some position, so comparison never ties.
        self.rank = tuple(GLOBSTAR if s == "**" else STAR if s == "*" else LITERAL for s in segments)

    def matches(self, route_segments):
        for index, segment in enumerate(self.segments):
            if segment == "**":
                return len(route_segments) > index
            if index >= len(route_segments):
                return False
            if segment != "*" and segment != route_segments[index]:
                return False
        return len(route_segments) == len(self.segments)
