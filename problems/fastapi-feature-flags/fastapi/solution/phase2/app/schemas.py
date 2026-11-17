"""Pydantic v2 request and response models."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, field_validator

from app.rules import RuleSyntaxError, parse_rule

KEY_PATTERN = r"^[a-z][a-z0-9_-]{0,47}$"


class RuleSpec(BaseModel):
    """One targeting rule as stored and returned: when the expression matches, the flag takes ``value``."""

    when: str
    value: bool = True


class RuleIn(RuleSpec):
    """A rule in a request: the expression must be valid rule syntax."""

    when: str = Field(min_length=1, max_length=200)
    value: StrictBool = True

    @field_validator("when")
    @classmethod
    def _valid_expression(cls, expression: str) -> str:
        try:
            parse_rule(expression)
        except RuleSyntaxError as exc:
            raise ValueError(str(exc)) from None
        return expression


class FlagCreate(BaseModel):
    key: str = Field(pattern=KEY_PATTERN)
    description: str = Field("", max_length=200)
    enabled: StrictBool = True
    default: StrictBool = False
    rollout_percent: StrictInt = Field(0, ge=0, le=100)
    rules: list[RuleIn] = Field(default_factory=list, max_length=20)


class FlagUpdate(BaseModel):
    """PATCH body: only the fields that are sent change. ``key`` cannot be changed.

    The fields default to ``None`` only to mean "not sent"; an explicit ``null`` fails validation.
    """

    model_config = ConfigDict(extra="forbid")

    description: str = Field(None, max_length=200)
    enabled: StrictBool = None
    default: StrictBool = None
    rollout_percent: StrictInt = Field(None, ge=0, le=100)
    rules: list[RuleIn] = Field(None, max_length=20)


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
