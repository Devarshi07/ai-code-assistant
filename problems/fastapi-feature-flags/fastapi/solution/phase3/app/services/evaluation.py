"""Evaluating flags for a user: the single place that decides a flag's value."""
from dataclasses import dataclass, field
from typing import Any

from app.repository import StoredFlag
from app.services.bucketing import is_in_rollout


@dataclass(frozen=True)
class EvaluationContext:
    """Who is asking: a user id plus free-form attributes such as country or plan."""

    user_id: str
    attributes: dict[str, Any] = field(default_factory=dict)

    def facts(self) -> dict[str, Any]:
        """The attributes rules can see: the user's attributes plus ``user_id``."""
        return {**self.attributes, "user_id": self.user_id}


@dataclass(frozen=True)
class Evaluation:
    value: bool
    reason: str  # "rule" | "rollout" | "default" | "disabled"


class Evaluator:
    def evaluate_flag(self, flag: StoredFlag, context: EvaluationContext, facts: dict[str, Any] | None = None) -> Evaluation:
        """The value of one flag for one user, and why. See README.md for the precedence."""
        if not flag.enabled:
            return Evaluation(False, "disabled")
        if facts is None:
            facts = context.facts()
        for rule, value in flag.compiled:
            if rule.matches(facts):
                return Evaluation(value, "rule")
        if is_in_rollout(flag.key, context.user_id, flag.rollout_percent):
            return Evaluation(True, "rollout")
        return Evaluation(flag.default, "default")

    def evaluate_all(self, flags: list[StoredFlag], context: EvaluationContext) -> dict[str, Evaluation]:
        """Every flag for one user, keyed by flag key (in the order given)."""
        facts = context.facts()
        return {flag.key: self.evaluate_flag(flag, context, facts) for flag in flags}
