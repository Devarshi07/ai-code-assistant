"""FlagService: every business rule for flags lives here."""
from dataclasses import replace
from typing import Any

from app.errors import conflict, not_found
from app.repository import FlagRepository, StoredFlag
from app.schemas import FlagCreate, FlagUpdate
from app.services.evaluation import Evaluation, EvaluationContext, Evaluator


class FlagService:
    def __init__(self, repository: FlagRepository, evaluator: Evaluator | None = None) -> None:
        self.repository = repository
        self.evaluator = evaluator or Evaluator()

    # -- CRUD -------------------------------------------------------------

    def list_flags(self) -> list[StoredFlag]:
        return self.repository.list()

    def get_flag(self, key: str) -> StoredFlag:
        flag = self.repository.get(key)
        if flag is None:
            raise not_found("Flag", key)
        return flag

    def create_flag(self, payload: FlagCreate) -> StoredFlag:
        if self.repository.get(payload.key) is not None:
            raise conflict("duplicate_flag", f"Flag '{payload.key}' already exists.", key=payload.key)
        flag = StoredFlag(
            key=payload.key,
            description=payload.description,
            enabled=payload.enabled,
            default=payload.default,
            rollout_percent=payload.rollout_percent,
            rules=tuple(payload.rules),
        )
        self.repository.save(flag)
        return flag

    def update_flag(self, key: str, changes: FlagUpdate) -> StoredFlag:
        flag = self.get_flag(key)
        sent: dict[str, Any] = {name: getattr(changes, name) for name in changes.model_fields_set}
        if "rules" in sent:
            sent["rules"] = tuple(sent["rules"])
        updated = replace(flag, **sent)
        self.repository.save(updated)
        return updated

    def delete_flag(self, key: str) -> None:
        self.get_flag(key)
        self.repository.delete(key)

    # -- Evaluation -------------------------------------------------------

    def check(self, key: str, user_id: str) -> Evaluation:
        """One flag for one user, with no attributes."""
        flag = self.get_flag(key)
        return self.evaluator.evaluate_flag(flag, EvaluationContext(user_id))

    def evaluate(self, user_id: str, attributes: dict[str, Any] | None = None) -> dict[str, Evaluation]:
        """Every flag for one user, keyed by flag key."""
        context = EvaluationContext(user_id, dict(attributes or {}))
        return self.evaluator.evaluate_all(self.repository.list(), context)
