"""Pydantic v2 request and response models."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RuleSpec(BaseModel):
    """One targeting rule: when the expression matches, the flag takes ``value``."""

    when: str
    value: bool = True


class FlagCreate(BaseModel):
    key: str
    description: str = ""
    enabled: bool = True
    default: bool = False
    rollout_percent: int = 0
    rules: list[RuleSpec] = Field(default_factory=list)


class FlagUpdate(BaseModel):
    """PATCH body: only the fields that are sent change. ``key`` cannot be changed."""

    description: str | None = None
    enabled: bool | None = None
    default: bool | None = None
    rollout_percent: int | None = None
    rules: list[RuleSpec] | None = None


class Flag(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    description: str
    enabled: bool
    default: bool
    rollout_percent: int
    rules: list[RuleSpec]


class CheckResult(BaseModel):
    key: str
    user_id: str
    value: bool
    reason: str


Scalar = str | int | float | bool


class EvaluateRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    attributes: dict[str, Scalar] = Field(default_factory=dict)


class EvaluationResult(BaseModel):
    value: bool
    reason: Literal["rule", "rollout", "default", "disabled"]


class EvaluateResponse(BaseModel):
    user_id: str
    flags: dict[str, EvaluationResult]
