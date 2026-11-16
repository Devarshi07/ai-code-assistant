"""FastAPI dependencies shared by the routers."""
from typing import Annotated

from fastapi import Depends, Request

from app.services.inventory import InventoryService


def get_inventory(request: Request) -> InventoryService:
    """The service instance that belongs to this app (see create_app)."""
    return request.app.state.inventory


Inventory = Annotated[InventoryService, Depends(get_inventory)]
