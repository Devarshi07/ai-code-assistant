"""Targeting rules: parsing the small expression language and matching it.

A rule expression is ``<attribute> <operator> <literal>``, for example

    country == "DE"
    plan in ["pro", "team"]
    age >= 18

Literals are JSON. See README.md ("Rule expressions") for the full semantics.
"""
import json
import re
from dataclasses import dataclass
from typing import Any, Callable

_RULE = re.compile(
    r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*"
    r"(==|!=|>=|<=|>|<|(?<=\s)not\s+in(?=\s)|(?<=\s)in(?=\s))\s*(.+?)\s*$",
    re.DOTALL,
)

ORDERING = {"<", "<=", ">", ">="}

_parse_hook: Callable[[str], None] | None = None


def set_parse_hook(hook: Callable[[str], None] | None) -> None:
    """Instrumentation: ``hook(expression)`` is called every time a rule is parsed.

    Tests use it to count parses. Pass ``None`` to remove it.
    """
    global _parse_hook
    _parse_hook = hook


class RuleSyntaxError(ValueError):
    """The expression is not valid rule syntax."""


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _same_kind(a: Any, b: Any) -> bool:
    """True when two JSON values can be compared: both numbers, both strings or both booleans."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool)
    if _is_number(a) and _is_number(b):
        return True
    return isinstance(a, str) and isinstance(b, str)


def _equal(a: Any, b: Any) -> bool:
    return _same_kind(a, b) and a == b


@dataclass(frozen=True)
class Rule:
    attribute: str
    op: str
    operand: Any

    def matches(self, context: dict[str, Any]) -> bool:
        """Does the evaluation context satisfy the rule? A missing attribute never matches."""
        if self.attribute not in context:
            return False
        actual = context[self.attribute]
        op = self.op
        if op == "==":
            return _equal(actual, self.operand)
        if op == "!=":
            return not _equal(actual, self.operand)
        if op == "in":
            return any(_equal(actual, item) for item in self.operand)
        if op == "not in":
            return not any(_equal(actual, item) for item in self.operand)
        if not (_is_number(actual) and _is_number(self.operand)):
            return False
        if op == "<":
            return actual < self.operand
        if op == "<=":
            return actual <= self.operand
        if op == ">":
            return actual > self.operand
        return actual >= self.operand


def _reject_constant(name: str):
    raise ValueError(f"{name} is not allowed")


def parse_rule(expression: str) -> Rule:
    """Parses one rule expression. Raises RuleSyntaxError with a readable message."""
    if _parse_hook is not None:
        _parse_hook(expression)
    found = _RULE.match(expression)
    if not found:
        raise RuleSyntaxError('Expected "<attribute> <operator> <value>", e.g. country == "DE".')
    attribute, op, literal = found.groups()
    op = " ".join(op.split())
    try:
        operand = json.loads(literal, parse_constant=_reject_constant)
    except ValueError:
        raise RuleSyntaxError(f"The value {literal!r} is not valid JSON.") from None
    if op in ("in", "not in"):
        if not isinstance(operand, list) or not operand:
            raise RuleSyntaxError(f"'{op}' needs a non-empty JSON array.")
        if any(not isinstance(item, (str, int, float, bool)) for item in operand):
            raise RuleSyntaxError("Array items must be strings, numbers or booleans.")
    elif op in ORDERING:
        if not _is_number(operand):
            raise RuleSyntaxError(f"'{op}' needs a number.")
    elif not isinstance(operand, (str, int, float, bool)):
        raise RuleSyntaxError(f"'{op}' needs a string, number or boolean.")
    return Rule(attribute, op, operand)
