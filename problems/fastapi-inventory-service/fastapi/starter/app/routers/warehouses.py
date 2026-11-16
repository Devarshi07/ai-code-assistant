"""/warehouses: sites that hold stock."""
from fastapi import APIRouter

from app.dependencies import Inventory
from app.schemas import StockLine, Warehouse

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.post("", response_model=Warehouse, status_code=201)
def create_warehouse(payload: Warehouse, inventory: Inventory) -> Warehouse:
    return inventory.create_warehouse(payload)


@router.get("", response_model=list[Warehouse])
def list_warehouses(inventory: Inventory) -> list[Warehouse]:
    return inventory.list_warehouses()


@router.get("/{warehouse_id}", response_model=Warehouse)
def get_warehouse(warehouse_id: str, inventory: Inventory) -> Warehouse:
    return inventory.get_warehouse(warehouse_id)


@router.get("/{warehouse_id}/stock", response_model=list[StockLine])
def warehouse_stock(warehouse_id: str, inventory: Inventory) -> list[StockLine]:
    return inventory.warehouse_stock(warehouse_id)
