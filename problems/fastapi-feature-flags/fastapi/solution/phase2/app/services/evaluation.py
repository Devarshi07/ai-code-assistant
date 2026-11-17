"""Evaluating flags for a user: the single place that decides a flag's value."""
from dataclasses import dataclass, field
from typing import Any

from app.repository import StoredFlag
from app.rules import parse_rule
from app.services.bucketing import is_in_rollout


@dataclass(frozen=True)
class EvaluationContext:
    """Who is asking: a user id plus free-form attributes such as country or plan."""

    user_id: str
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Evaluation:
    value: bool
    reason: str  # "rule" | "rollout" | "default" | "disabled"


class Evaluator:
    def evaluate_flag(self, flag: StoredFlag, context: EvaluationContext) -> Evaluation:
        """The value of one flag for one user, and why. See README.md for the precedence."""
        if not flag.enabled:
            return Evaluation(False, "disabled")
        facts = {**context.attributes, "user_id": context.user_id}
        for spec in flag.rules:
            if parse_rule(spec.when).matches(facts):
                return Evaluation(spec.value, "rule")
        if is_in_rollout(flag.key, context.user_id, flag.rollout_percent):
            return Evaluation(True, "rollout")
        return Evaluation(flag.default, "default")

    def evaluate_all(self, flags: list[StoredFlag], context: EvaluationContext) -> dict[str, Evaluation]:
        """Every flag for one user, keyed by flag key (in the order given)."""
        return {flag.key: self.evaluate_flag(flag, context) for flag in flags}
