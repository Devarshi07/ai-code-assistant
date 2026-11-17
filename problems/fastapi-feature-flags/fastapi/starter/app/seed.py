"""A few sample flags for the demo and for local development."""
from app.schemas import FlagCreate
from app.services.flags import FlagService

FLAGS = [
    FlagCreate.model_validate({
        "key": "new-checkout", "description": "Redesigned checkout flow.", "rollout_percent": 25,
        "rules": [{"when": 'country == "DE"', "value": True}, {"when": 'plan == "free"', "value": False}],
    }),
    FlagCreate.model_validate({
        "key": "beta-dashboard", "description": "Dashboard beta for paying customers.",
        "rules": [{"when": 'plan in ["pro", "team"]', "value": True}],
    }),
    FlagCreate.model_validate({"key": "dark-mode", "description": "Dark theme.", "default": True}),
    FlagCreate.model_validate({
        "key": "legacy-export", "description": "Old CSV export, being retired.", "enabled": False,
        "default": True, "rollout_percent": 100,
    }),
    FlagCreate.model_validate({
        "key": "adult-content-filter", "description": "Stricter filter for younger users.", "default": True,
        "rules": [{"when": "age >= 18", "value": False}],
    }),
]


def seed_demo(service: FlagService) -> None:
    for flag in FLAGS:
        service.create_flag(flag)
