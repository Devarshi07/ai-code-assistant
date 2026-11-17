"""FastAPI dependencies shared by the routers."""
from typing import Annotated

from fastapi import Depends, Request

from app.services.flags import FlagService


def get_flags(request: Request) -> FlagService:
    """The service instance that belongs to this app (see create_app)."""
    return request.app.state.flags


Flags = Annotated[FlagService, Depends(get_flags)]
